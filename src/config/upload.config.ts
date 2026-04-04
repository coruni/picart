import { registerAs } from "@nestjs/config";

export interface ImageSizeConfig {
  name: string;
  width: number;
  height?: number;
  quality: number;
  fit: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface UploadConfig {
  enabled: boolean;
  format: "webp" | "jpeg" | "png" | "avif";
  quality: number;
  sizes: ImageSizeConfig[];
  keepOriginal: boolean;
  maxWidth: number;
  maxHeight: number;
}

/**
 * 最优图片尺寸配置
 * 基于常见使用场景和性能优化设计
 */
export const defaultImageSizes: ImageSizeConfig[] = [
  {
    name: "thumb",
    width: 200,
    height: 200,
    quality: 75, // 缩略图质量略低，体积更小
    fit: "cover", // 裁剪填充，保持正方形
  },
  {
    name: "small",
    width: 400,
    quality: 80, // 列表页展示质量
    fit: "inside", // 保持比例，不裁剪
  },
  {
    name: "medium",
    width: 800,
    quality: 85, // 详情页默认展示质量
    fit: "inside",
  },
  {
    name: "large",
    width: 1600, // 大图但不过大，平衡质量和流量
    quality: 85,
    fit: "inside",
  },
];

/**
 * 上传压缩配置 - 最优默认配置
 *
 * 设计原则：
 * 1. WebP 格式：比 JPEG 节省 25-35%，比 PNG 节省 60-80%
 * 2. 渐进式加载：用户先看到模糊图，再变清晰
 * 3. 智能质量：小图用低质量，大图用高质量
 * 4. 保留原图：用于下载、放大查看等场景
 * 5. 合理尺寸：覆盖 99% 的展示场景
 */
export const uploadConfig = registerAs("upload", () => ({
  compression: {
    // 默认启用压缩（可通过环境变量关闭）
    enabled: process.env.UPLOAD_COMPRESSION_ENABLED !== "false",

    // WebP 是目前最优的 Web 图片格式
    // - 相同质量下比 JPEG 小 25-35%
    // - 支持透明（比 PNG 小 60-80%）
    // - 支持动画（替代 GIF，小 60-80%）
    format: (process.env.UPLOAD_COMPRESSION_FORMAT as any) || "webp",

    // 质量 85 是 sweet spot：
    // - 肉眼几乎看不出损失
    // - 比质量 90 节省约 15% 体积
    // - 比质量 80 画质明显更好
    quality: parseInt(process.env.UPLOAD_COMPRESSION_QUALITY || "85", 10),

    // 4K 分辨率限制，超过则压缩
    // 覆盖 99.9% 的设备屏幕
    maxWidth: parseInt(process.env.UPLOAD_COMPRESSION_MAX_WIDTH || "3840", 10),
    maxHeight: parseInt(
      process.env.UPLOAD_COMPRESSION_MAX_HEIGHT || "2160",
      10,
    ),

    // 保留原图：用于下载、放大、编辑等场景
    keepOriginal: process.env.UPLOAD_KEEP_ORIGINAL !== "false",

    // 预定义尺寸，覆盖所有展示场景
    sizes: defaultImageSizes,
  } as UploadConfig,

  // 前端预压缩建议配置
  // 建议前端在上传前预压缩，减少上传时间和带宽
  clientHint: {
    // 建议前端最大宽度（覆盖大多数手机屏幕）
    maxWidth: parseInt(process.env.UPLOAD_CLIENT_MAX_WIDTH || "1920", 10),
    // 前端预压缩质量（稍低，因为后端会重新处理）
    quality: parseInt(process.env.UPLOAD_CLIENT_QUALITY || "75", 10),
    // 建议前端输出格式
    format: process.env.UPLOAD_CLIENT_FORMAT || "webp",
  },
}));
