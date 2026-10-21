import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as fontkit from "fontkit";
import * as sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import {
  WatermarkConfig,
  WatermarkPosition,
} from "src/config/upload.config";

export interface WatermarkUser {
  id?: number;
  username?: string;
  nickname?: string;
  config?: { watermarkEnabled?: boolean } | null;
}

const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: true,
  fontPath: "assets/fonts/NotoSansSC-Regular.woff2",
  textTemplate: "{nickname}",
  color: "#FFFFFF",
  opacity: 0.55,
  fontSizeRatio: 0.035,
  minFontSize: 14,
  maxFontSize: 72,
  margin: 16,
  position: "bottom-right",
};

// sharp 可以原地重写的图片格式；动图与 HEIC 等格式不做原地处理
const WATERMARKABLE_FORMATS = new Set([
  "jpeg",
  "jpg",
  "png",
  "webp",
  "gif",
  "avif",
  "tiff",
]);

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);
  private readonly config: WatermarkConfig;
  private font: fontkit.Font | null = null;
  private fontLoaded = false;

  constructor(private readonly configService: ConfigService) {
    const watermarkConfig =
      this.configService.get<WatermarkConfig>("upload.watermark");
    const merged = {
      ...DEFAULT_WATERMARK_CONFIG,
      ...(watermarkConfig || {}),
    };

    const numberOr = (value: number, fallback: number) =>
      Number.isFinite(value) ? value : fallback;
    const fontSizeRatio = numberOr(
      merged.fontSizeRatio,
      DEFAULT_WATERMARK_CONFIG.fontSizeRatio,
    );

    this.config = {
      ...merged,
      enabled: merged.enabled !== false,
      opacity: this.clamp01(merged.opacity, DEFAULT_WATERMARK_CONFIG.opacity),
      fontSizeRatio:
        fontSizeRatio > 0
          ? fontSizeRatio
          : DEFAULT_WATERMARK_CONFIG.fontSizeRatio,
      minFontSize: Math.max(1, numberOr(merged.minFontSize, 14)),
      maxFontSize: Math.max(1, numberOr(merged.maxFontSize, 72)),
      margin: Math.max(0, numberOr(merged.margin, 16)),
      color: this.sanitizeColor(merged.color, DEFAULT_WATERMARK_CONFIG.color),
    };

    if (this.config.maxFontSize < this.config.minFontSize) {
      this.config.maxFontSize = this.config.minFontSize;
    }
  }

  /**
   * 判断本次上传是否需要添加水印
   * - 全局水印开关关闭时不添加
   * - 头像场景不添加
   * - 用户关闭了水印时不添加
   */
  shouldApply(user?: WatermarkUser, scene?: string): boolean {
    if (!this.config.enabled || !user) {
      return false;
    }

    if (scene === "avatar") {
      return false;
    }

    // 用户未创建配置记录时按开启处理
    return user.config?.watermarkEnabled !== false;
  }

  /**
   * 根据用户信息生成水印文字，返回 null 表示无需添加
   */
  buildText(user?: WatermarkUser): string | null {
    if (!user) {
      return null;
    }

    const nickname = user.nickname || user.username || "";
    const text = (this.config.textTemplate || "{nickname}")
      .replace(/\{nickname\}/g, nickname)
      .replace(/\{username\}/g, user.username || "")
      .replace(/\{id\}/g, user.id != null ? String(user.id) : "")
      .trim();

    return text || null;
  }

  /**
   * 将水印直接写入源文件（保持原格式与文件路径）
   *
   * 这样 upload.url 指向的主图、后续压缩生成的 original/thumbnails 都会带水印。
   * 处理失败时返回 false，不阻塞上传流程。
   */
  async applyToFile(filePath: string, text?: string | null): Promise<boolean> {
    if (!this.config.enabled || !text) {
      return false;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }

    try {
      // 直接交给 libvips 从文件读取，避免把整图读进 JS 堆
      const metadata = await sharp(filePath).metadata();

      if (!metadata.format || !metadata.width || !metadata.height) {
        this.logger.warn(`Skip watermark: invalid metadata for ${filePath}`);
        return false;
      }

      if (!WATERMARKABLE_FORMATS.has(metadata.format)) {
        this.logger.warn(
          `Skip watermark: unsupported format ${metadata.format} for ${filePath}`,
        );
        return false;
      }

      // 动图逐帧合成会破坏动画，直接跳过
      if ((metadata.pages || 1) > 1) {
        this.logger.warn(
          `Skip watermark: animated image (${metadata.pages} pages) ${filePath}`,
        );
        return false;
      }

      const fontSize = this.resolveFontSize(metadata.width);
      const overlay = this.buildOverlay(text, fontSize);
      if (!overlay) {
        return false;
      }

      const { left, top } = this.resolvePosition(
        metadata.width,
        metadata.height,
        overlay.width,
        overlay.height,
      );

      const pipeline = sharp(filePath)
        .composite([{ input: overlay.svg, top, left }])
        .keepMetadata();

      // 先写临时文件再原子替换，避免半成品覆盖原图
      const tempPath = `${filePath}.wm-${process.pid}-${Date.now()}.tmp`;
      try {
        await this.applyEncoder(pipeline, metadata.format).toFile(tempPath);
        await fs.promises.rename(tempPath, filePath);
      } finally {
        await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
      }

      this.logger.log(
        `Watermark applied to ${path.basename(filePath)} (${metadata.width}x${metadata.height}, font ${fontSize}px)`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to apply watermark to ${filePath}:`, error);
      return false;
    }
  }

  private resolveFontSize(imageWidth: number): number {
    const ratioSize = imageWidth * this.config.fontSizeRatio;
    return Math.round(
      Math.min(
        this.config.maxFontSize,
        Math.max(this.config.minFontSize, ratioSize),
      ),
    );
  }

  private resolvePosition(
    imageWidth: number,
    imageHeight: number,
    overlayWidth: number,
    overlayHeight: number,
  ): { left: number; top: number } {
    const margin = Math.max(0, this.config.margin);
    const maxLeft = Math.max(0, imageWidth - overlayWidth - margin);
    const maxTop = Math.max(0, imageHeight - overlayHeight - margin);

    switch (this.config.position as WatermarkPosition) {
      case "top-left":
        return { left: margin, top: margin };
      case "top-right":
        return { left: maxLeft, top: margin };
      case "bottom-left":
        return { left: margin, top: maxTop };
      case "center":
        return {
          left: Math.max(0, Math.round((imageWidth - overlayWidth) / 2)),
          top: Math.max(0, Math.round((imageHeight - overlayHeight) / 2)),
        };
      case "bottom-right":
      default:
        return { left: maxLeft, top: maxTop };
    }
  }

  /**
   * 使用 fontkit 将文字转换为 SVG 路径
   *
   * 不依赖系统字体，Docker 中只需要字体文件本身即可正常渲染。
   */
  private buildOverlay(
    text: string,
    fontSize: number,
  ): { svg: Buffer; width: number; height: number } | null {
    const font = this.getFont();
    if (!font) {
      return null;
    }

    const run = font.layout(text);
    if (!run.glyphs.length) {
      return null;
    }

    const scale = fontSize / font.unitsPerEm;
    const paths: string[] = [];
    let penX = 0;

    for (let i = 0; i < run.glyphs.length; i++) {
      const glyph = run.glyphs[i];
      const position = run.positions[i];

      // 跳过字体中不存在的字符（如 emoji），避免输出 .notdef 方块
      if (glyph.id !== 0) {
        const pathData = glyph.path.toSVG();
        if (pathData) {
          paths.push(
            `<path d="${pathData}" transform="translate(${(penX + position.xOffset).toFixed(2)} ${position.yOffset.toFixed(2)})"/>`,
          );
        }
      }

      penX += position.xAdvance;
    }

    if (!paths.length) {
      return null;
    }

    const ascent = font.ascent;
    const descent = font.descent;
    const unitsWidth = Math.max(penX, 1);
    const unitsHeight = Math.max(ascent - descent, 1);

    const width = Math.max(1, Math.ceil(unitsWidth * scale));
    const height = Math.max(1, Math.ceil(unitsHeight * scale));

    // 阴影偏移需要换算到字体坐标单位
    const color = this.sanitizeColor(this.config.color, "#FFFFFF");
    const opacity = this.clamp01(this.config.opacity, 0.55);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${unitsWidth} ${unitsHeight}"><g fill="${color}" fill-opacity="${opacity}" transform="translate(0 ${ascent}) scale(1 -1)">${paths.join(
      "",
    )}</g></svg>`;

    return { svg: Buffer.from(svg), width, height };
  }

  private getFont(): fontkit.Font | null {
    if (this.fontLoaded) {
      return this.font;
    }

    this.fontLoaded = true;

    try {
      const resolvedPath = path.isAbsolute(this.config.fontPath)
        ? this.config.fontPath
        : path.join(process.cwd(), this.config.fontPath);

      if (!fs.existsSync(resolvedPath)) {
        this.logger.error(
          `Watermark font not found: ${resolvedPath}. Watermark will be skipped.`,
        );
        return null;
      }

      const opened = fontkit.openSync(resolvedPath);
      this.font =
        "unitsPerEm" in opened ? opened : opened.fonts[0] || null;

      if (!this.font) {
        this.logger.error(`No usable font in ${resolvedPath}`);
      }

      return this.font;
    } catch (error) {
      this.logger.error(
        `Failed to load watermark font ${this.config.fontPath}:`,
        error,
      );
      return null;
    }
  }

  private applyEncoder(pipeline: sharp.Sharp, format: string): sharp.Sharp {
    switch (format) {
      case "jpeg":
      case "jpg":
        return pipeline.jpeg({ quality: 95 });
      case "png":
        return pipeline.png({ compressionLevel: 9 });
      case "webp":
        return pipeline.webp({ quality: 95 });
      case "gif":
        return pipeline.gif();
      case "avif":
        return pipeline.avif({ quality: 90 });
      case "tiff":
        return pipeline.tiff();
      default:
        throw new Error(`Unsupported watermark output format: ${format}`);
    }
  }

  private sanitizeColor(value: string, fallback: string): string {
    return typeof value === "string" && HEX_COLOR_RE.test(value)
      ? value
      : fallback;
  }

  private clamp01(value: number, fallback: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(1, Math.max(0, value));
  }
}
