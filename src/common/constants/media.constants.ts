/**
 * 媒体类型清单（唯一来源）
 *
 * 说明：
 * - UPLOAD_* 为上传网关（multer fileFilter）实际放行的清单，是全局口径。
 * - IMAGE_PROCESSABLE 为 sharp 可处理清单，与网关口径不同（不含 bmp，含 image/jpg），
 *   改动前需确认 sharp/libvips 是否支持对应格式。
 * - PRESIGN_ALLOWED 为前端直传预签名清单，历史上是网关口径的子集，
 *   此处保留原值以避免放开直传放行范围。
 */

export const UPLOAD_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/tiff",
  "image/avif",
  "image/bmp",
] as const;

export const UPLOAD_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/avi",
  "video/mpeg",
  "video/flv",
  "video/x-flv",
  "video/x-m4v",
  "video/3gpp",
] as const;

export const UPLOAD_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
] as const;

export const UPLOAD_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
] as const;

export const UPLOAD_ALLOWED_MIME_TYPES = [
  ...UPLOAD_IMAGE_MIME_TYPES,
  ...UPLOAD_VIDEO_MIME_TYPES,
  ...UPLOAD_AUDIO_MIME_TYPES,
  ...UPLOAD_DOCUMENT_MIME_TYPES,
] as const;

export const IMAGE_PROCESSABLE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export const PRESIGN_ALLOWED_MIME_TYPES = [
  ...UPLOAD_IMAGE_MIME_TYPES.filter((type) => type !== "image/bmp"),
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  "video/avi",
  "video/flv",
  "video/x-flv",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "application/pdf",
] as const;

export const IMAGE_PROCESSABLE_MIME_TYPE_SET: ReadonlySet<string> = new Set(
  IMAGE_PROCESSABLE_MIME_TYPES,
);

/**
 * 上传迁移统计口径（historical：仅统计历史数据中常见的图片格式）。
 */
export const MIGRATION_IMAGE_STATS_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

/**
 * 表情包上传专用清单（比通用图片清单更严格）。
 */
export const EMOJI_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
