import { Logger } from "@nestjs/common";
import { In } from "typeorm";
import { Upload } from "src/modules/upload/entities/upload.entity";

/**
 * 图片对象信息（返回格式）
 */
export interface ImageObject {
  url: string; // 默认 URL
  original?: string; // 原图 URL
  width?: number; // 图片宽度
  height?: number; // 图片高度
  size?: number; // 文件大小（字节）
  thumbnails?: {
    // 各尺寸缩略图
    thumb?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
}

/**
 * 图片处理选项
 */
export interface ProcessImagesOptions {
  baseUrl?: string; // 基础域名，用于拼接相对路径
}

/**
 * 图片序列化工具类
 *
 * 存储格式：保持简单的逗号分隔字符串（兼容旧数据，所有数据库都支持）
 * "url1,url2,url3"
 *
 * 返回格式：ImageObject 数组（方便前端使用）
 * [{url: "url1"}, {url: "url2"}]
 */
export class ImageSerializer {
  private static readonly logger = new Logger(ImageSerializer.name);

  /**
   * 从 Upload 实体创建 ImageObject
   */
  static createImageObjectFromUpload(
    upload: Upload,
    baseUrl?: string,
  ): ImageObject {
    const result: ImageObject = {
      url: upload.url,
      width: upload.original?.width,
      height: upload.original?.height,
      size: upload.original?.size || upload.size,
    };

    // 如果有原图信息
    if (upload.original) {
      result.original = upload.original.url;
    }

    // 如果有缩略图信息，确保返回完整 URL
    if (upload.thumbnails && upload.thumbnails.length > 0) {
      result.thumbnails = {};
      // 使用传入的 baseUrl 或从主 URL 提取
      const domain = baseUrl || this.extractBaseUrl(upload.url);

      for (const thumb of upload.thumbnails) {
        // 如果 thumbnail URL 是相对路径，拼接成完整 URL
        // 兼容旧数据（相对路径）和新数据（完整 URL）
        let fullUrl: string;
        if (thumb.url.startsWith("http")) {
          // 新数据：已经是完整 URL
          fullUrl = thumb.url;
        } else if (domain) {
          // 旧数据：有 domain，拼接成完整 URL
          // 确保相对路径以 / 开头，避免拼接错误
          const thumbPath = thumb.url.startsWith("/")
            ? thumb.url
            : `/${thumb.url}`;
          fullUrl = `${domain}${thumbPath}`;
        } else {
          // 无法获取 domain，保留原样（相对路径）
          fullUrl = thumb.url;
        }

        if (thumb.name === "thumb") result.thumbnails.thumb = fullUrl;
        if (thumb.name === "small") result.thumbnails.small = fullUrl;
        if (thumb.name === "medium") result.thumbnails.medium = fullUrl;
        if (thumb.name === "large") result.thumbnails.large = fullUrl;
      }
    }

    return result;
  }

  /**
   * 从完整 URL 提取基础域名
   * 如 http://127.0.0.1:5000/uploads/xxx.jpg → http://127.0.0.1:5000
   */
  private static extractBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch {
      return "";
    }
  }

  /**
   * 根据 URL 匹配 Upload 实体，构建 ImageObject（同步版本）
   */
  static processImagesWithUploads(
    imageUrls: string[],
    uploads: Upload[],
    baseUrl?: string,
  ): ImageObject[] {
    // 创建 URL 到 Upload 的映射
    const uploadMap = new Map<string, Upload>();

    for (const upload of uploads) {
      // 存储各种可能的 URL 格式
      uploadMap.set(upload.url, upload);
      if (upload.original?.url) {
        uploadMap.set(upload.original.url, upload);
      }
      if (upload.thumbnails) {
        for (const thumb of upload.thumbnails) {
          uploadMap.set(thumb.url, upload);
        }
      }
    }

    // 为每个 URL 查找对应的 Upload 信息
    return imageUrls.map((url) => {
      const upload = uploadMap.get(url);
      if (upload) {
        return this.createImageObjectFromUpload(upload, baseUrl);
      }
      // 找不到 Upload 信息，只返回 URL
      return { url };
    });
  }

  /**
   * 异步处理图片数据，自动查询数据库获取 Upload 信息（通用方法）
   *
   * @param data 存储的图片数据（逗号分隔的字符串）
   * @param uploadRepository Upload 表的 Repository
   * @param options 可选配置
   * @returns ImageObject 数组
   */
  static async processImagesAsync(
    data: string | null | undefined,
    uploadRepository: any,
    options?: ProcessImagesOptions,
  ): Promise<ImageObject[]> {
    if (!data || data.trim() === "") {
      return [];
    }

    // 提取所有图片 URL
    const imageUrls = this.extractUrls(data);
    if (imageUrls.length === 0) {
      return [];
    }

    // 查询数据库获取 Upload 信息
    const uploads = await uploadRepository.find({
      where: { url: In(imageUrls) },
    });

    // 构建 ImageObject 数组
    return this.processImagesWithUploads(imageUrls, uploads, options?.baseUrl);
  }

  /**
   * 序列化：将字符串或字符串数组转换为逗号分隔的存储格式
   *
   * 输入: "url" 或 ["url1", "url2"] 或 "url1,url2"
   * 输出: "url1,url2"（逗号分隔的字符串）
   *
   * @param images 图片URL（字符串或数组，字符串可能已包含逗号）
   * @returns 逗号分隔的存储字符串
   */
  static serialize(images: string | string[] | null | undefined): string {
    if (!images) {
      return "";
    }

    let urlArray: string[];

    if (Array.isArray(images)) {
      // 如果是数组，展平所有元素（处理元素本身包含逗号的情况）
      urlArray = images.flatMap((item) => this.splitUrls(item));
    } else {
      // 如果是字符串，按逗号分割（支持传入已拼接的字符串）
      urlArray = this.splitUrls(images);
    }

    // 去空、trim（保留重复 URL）
    const cleanUrls = urlArray
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    return cleanUrls.join(",");
  }

  /**
   * 反序列化：将存储的字符串转换为 ImageObject 数组（不含数据库信息）
   *
   * 支持:
   * 1. 逗号分隔: "url1,url2,url3"
   * 2. JSON格式: "[{\"url\":\"url1\"}]"（兼容可能存在的旧JSON数据）
   *
   * @param data 存储的图片数据
   * @returns ImageObject 数组（仅包含 URL）
   */
  static deserialize(data: string | null | undefined): ImageObject[] {
    if (!data || data.trim() === "") {
      return [];
    }

    // 尝试解析为 JSON（兼容可能存在的旧JSON数据）
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => this.normalizeImageObject(item));
      }
      if (typeof parsed === "object" && parsed !== null) {
        return [this.normalizeImageObject(parsed)];
      }
    } catch {
      // 不是 JSON，按逗号分隔处理
    }

    // 处理逗号分隔的 URL 字符串
    const urls = this.splitUrls(data);

    return urls.map((url) => ({ url }));
  }

  /**
   * 批量处理图片数据（同步版本，不查询数据库）
   *
   * @param data 存储的图片数据（字符串或字符串数组）
   * @returns ImageObject 数组
   */
  static processImages(
    data: string | string[] | null | undefined,
  ): ImageObject[] {
    if (!data) {
      return [];
    }

    // 如果已经是数组（可能是旧代码直接返回的 string[]）
    if (Array.isArray(data)) {
      return data.map((item) =>
        typeof item === "string"
          ? { url: item }
          : this.normalizeImageObject(item),
      );
    }

    // 字符串类型，反序列化
    return this.deserialize(data);
  }

  /**
   * 获取图片 URL 列表（从存储字符串中提取）
   */
  static extractUrls(data: string | null | undefined): string[] {
    if (!data || data.trim() === "") {
      return [];
    }

    // 尝试解析为 JSON
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item : item.url || ""))
          .filter(Boolean);
      }
    } catch {
      // 不是 JSON
    }

    // 按逗号分隔
    return this.splitUrls(data);
  }

  /**
   * 按逗号分割 URL 字符串
   * 处理 "url1,url2" → ["url1", "url2"]
   */
  private static splitUrls(urlString: string): string[] {
    return urlString
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
  }

  /**
   * 规范化图片对象
   */
  private static normalizeImageObject(obj: any): ImageObject {
    if (typeof obj === "string") {
      return { url: obj };
    }

    const result: ImageObject = {
      url: obj.url || obj.imageUrl || "",
    };

    if (obj.original) result.original = obj.original;
    if (typeof obj.width === "number") result.width = obj.width;
    if (typeof obj.height === "number") result.height = obj.height;
    if (typeof obj.size === "number") result.size = obj.size;

    if (obj.thumbnails && typeof obj.thumbnails === "object") {
      result.thumbnails = {};
      if (obj.thumbnails.thumb) result.thumbnails.thumb = obj.thumbnails.thumb;
      if (obj.thumbnails.small) result.thumbnails.small = obj.thumbnails.small;
      if (obj.thumbnails.medium)
        result.thumbnails.medium = obj.thumbnails.medium;
      if (obj.thumbnails.large) result.thumbnails.large = obj.thumbnails.large;
    }

    return result;
  }

  /**
   * 获取指定尺寸的图片 URL
   */
  static getImageUrlBySize(
    image: ImageObject,
    size?: "thumb" | "small" | "medium" | "large",
  ): string {
    if (!size) {
      return image.url;
    }

    if (image.thumbnails?.[size]) {
      return image.thumbnails[size];
    }

    // 降级策略
    if (image.thumbnails) {
      const sizes: ("large" | "medium" | "small" | "thumb")[] = [
        "large",
        "medium",
        "small",
        "thumb",
      ];
      for (const s of sizes) {
        if (image.thumbnails[s]) {
          return image.thumbnails[s];
        }
      }
    }

    return image.url;
  }
}
