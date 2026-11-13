import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as sharp from "sharp";
import { ImageProcessorService } from "./image-processor.service";

const COMPRESSION_CONFIG = {
  enabled: true,
  format: "webp",
  quality: 85,
  keepOriginal: true,
  maxWidth: 3840,
  maxHeight: 2160,
  sizes: [
    { name: "thumb", width: 200, height: 200, quality: 75, fit: "cover" },
    { name: "small", width: 400, quality: 80, fit: "inside" },
  ],
};

const createService = (): ImageProcessorService =>
  new ImageProcessorService({
    get: (key: string) =>
      key === "upload.compression" ? COMPRESSION_CONFIG : undefined,
  } as any);

/**
 * 生成一个 w×h、共 frames 帧的动图 GIF
 */
const createAnimatedGif = async (
  filePath: string,
  frames: number,
  width: number,
  height: number,
): Promise<void> => {
  const frameBuffers: Buffer[] = [];
  for (let i = 0; i < frames; i++) {
    frameBuffers.push(
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: i % 2 === 0 ? "#e74c3c" : "#3498db",
        },
      })
        .png()
        .toBuffer(),
    );
  }

  const stacked = await sharp({
    create: {
      width,
      height: height * frames,
      channels: 4,
      background: "#ffffff",
    },
  })
    .composite(frameBuffers.map((input, i) => ({ input, top: i * height, left: 0 })))
    .raw()
    .toBuffer();

  await sharp(stacked, {
    raw: { width, height: height * frames, channels: 4, pageHeight: height },
  })
    .gif({ delay: Array.from({ length: frames }, () => 120), loop: 0 })
    .toFile(filePath);
};

describe("ImageProcessorService 动图处理", () => {
  let workDir: string;

  beforeAll(() => {
    // 关闭 libvips 缓存，否则 Windows 上源文件句柄不会及时释放，清理临时目录会 EBUSY
    sharp.cache(false);
  });

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "picart-gif-"));
  });

  afterEach(() => {
    fs.rmSync(workDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  });

  it("GIF 原图不转码，缩略图保留动画与逐帧延时", async () => {
    const sourcePath = path.join(workDir, "anim.gif");
    await createAnimatedGif(sourcePath, 3, 240, 180);

    const processed = await createService().processImage(
      sourcePath,
      workDir,
      "anim",
      workDir,
    );

    // 原图直接复用源文件，不做任何编码
    expect(processed.original).toBeDefined();
    expect(processed.original!.path).toBe(sourcePath);
    expect(processed.original!.url.endsWith("/anim.gif")).toBe(true);
    expect(processed.original!.width).toBe(240);
    expect(processed.original!.height).toBe(180);

    // 缩略图沿用 GIF 容器，动画帧数与延时都保留
    const thumb = processed.sizes.thumb;
    expect(thumb).toBeDefined();
    expect(thumb.path.endsWith(".gif")).toBe(true);
    expect(thumb.width).toBe(200);
    // 等比缩放：200 / 240 * 180 = 150，而不是被拉伸成 200
    expect(thumb.height).toBe(150);

    const thumbMeta = await sharp(thumb.path, { animated: true }).metadata();
    expect(thumbMeta.format).toBe("gif");
    expect(thumbMeta.pages).toBe(3);
    expect(thumbMeta.pageHeight).toBe(150);
    expect(thumbMeta.delay).toHaveLength(3);
  });

  it("动图缩略图不放大，尺寸不足时直接复用源文件", async () => {
    const sourcePath = path.join(workDir, "small.gif");
    await createAnimatedGif(sourcePath, 2, 100, 80);

    const processed = await createService().processImage(
      sourcePath,
      workDir,
      "small",
      workDir,
    );

    const small = processed.sizes.small;
    expect(small).toBeDefined();
    expect(small.width).toBe(100);
    expect(small.height).toBe(80);

    const meta = await sharp(small.path, { animated: true }).metadata();
    expect(meta.pages).toBe(2);
  });

  it("静态图仍按配置输出 WebP 缩略图", async () => {
    const sourcePath = path.join(workDir, "static.png");
    await sharp({
      create: { width: 1200, height: 800, channels: 3, background: "#336699" },
    })
      .png()
      .toFile(sourcePath);

    const processed = await createService().processImage(
      sourcePath,
      workDir,
      "static",
      workDir,
    );

    expect(processed.original!.url.endsWith("-original.webp")).toBe(true);
    expect(processed.sizes.thumb.path.endsWith("-thumb.webp")).toBe(true);
    expect(processed.sizes.thumb.width).toBe(200);
    expect(processed.sizes.thumb.height).toBe(200);
  });
});
