import { ConfigService } from "@nestjs/config";

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_SIZE = 20 * 1024 * 1024;
export const DEFAULT_MAX_VIDEO_SIZE = 500 * 1024 * 1024;
export const DEFAULT_MAX_AUDIO_SIZE = 50 * 1024 * 1024;
export const DEFAULT_MAX_OTHER_SIZE = 100 * 1024 * 1024;
export const DEFAULT_MAX_FILE_COUNT = 10;

export type UploadSizeKind = "image" | "video" | "audio" | "other";

interface SizeRule {
  mbConfigKey: string;
  defaultBytes: number;
  label: string;
}

const SIZE_RULES: Record<UploadSizeKind, SizeRule> = {
  image: {
    mbConfigKey: "UPLOAD_MAX_IMAGE_SIZE",
    defaultBytes: DEFAULT_MAX_IMAGE_SIZE,
    label: "图片",
  },
  video: {
    mbConfigKey: "UPLOAD_MAX_VIDEO_SIZE",
    defaultBytes: DEFAULT_MAX_VIDEO_SIZE,
    label: "视频",
  },
  audio: {
    mbConfigKey: "UPLOAD_MAX_AUDIO_SIZE",
    defaultBytes: DEFAULT_MAX_AUDIO_SIZE,
    label: "音频",
  },
  other: {
    mbConfigKey: "UPLOAD_MAX_OTHER_SIZE",
    defaultBytes: DEFAULT_MAX_OTHER_SIZE,
    label: "文件",
  },
};

export const LEGACY_MAX_FILE_SIZE_KEY = "UPLOAD_MAX_FILE_SIZE";

export const mbToBytes = (mb: number): number => mb * 1024 * 1024;

export const bytesToMb = (bytes: number): number => bytes / 1024 / 1024;

export function resolveUploadSizeKind(mimeType?: string): UploadSizeKind {
  const type = (mimeType || "").toLowerCase();
  if (type.startsWith("image/")) {
    return "image";
  }
  if (type.startsWith("video/")) {
    return "video";
  }
  if (type.startsWith("audio/")) {
    return "audio";
  }
  return "other";
}

function readPositiveNumber(
  configService: ConfigService,
  key: string,
): number | null {
  const raw = configService.get<string | number>(key);
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * 按类型解析上限（MB 配置 → 字节），不考虑旧版通用限制。
 */
export function resolveTypeMaxSizeBytes(
  configService: ConfigService,
  mimeType?: string,
): number {
  const rule = SIZE_RULES[resolveUploadSizeKind(mimeType)];
  const configuredMB = readPositiveNumber(configService, rule.mbConfigKey);
  return configuredMB === null ? rule.defaultBytes : mbToBytes(configuredMB);
}

/**
 * 业务侧校验口径：旧版通用限制作为「上限」取两者较小值。
 */
export function resolveUploadMaxSizeBytes(
  configService: ConfigService,
  mimeType?: string,
): { maxSize: number; label: string } {
  const kind = resolveUploadSizeKind(mimeType);
  const rule = SIZE_RULES[kind];

  let maxSize = resolveTypeMaxSizeBytes(configService, mimeType);

  const legacyMaxSize = readPositiveNumber(
    configService,
    LEGACY_MAX_FILE_SIZE_KEY,
  );
  if (legacyMaxSize !== null) {
    maxSize = Math.min(maxSize, legacyMaxSize);
  }

  return { maxSize, label: rule.label };
}

/**
 * 上传网关（multer fileFilter）口径：未配置类型上限时回退到旧版通用限制。
 */
export function resolveGatewayMaxSizeBytes(
  configService: ConfigService,
  mimeType?: string,
): number {
  const kind = resolveUploadSizeKind(mimeType);
  const rule = SIZE_RULES[kind];
  const configuredMB = readPositiveNumber(configService, rule.mbConfigKey);

  if (configuredMB !== null) {
    return mbToBytes(configuredMB);
  }

  const legacyMaxSize = readPositiveNumber(
    configService,
    LEGACY_MAX_FILE_SIZE_KEY,
  );
  return legacyMaxSize === null ? rule.defaultBytes : legacyMaxSize;
}

/**
 * 全局硬上限：各类型上限中的最大值，并兼容旧版限制。
 */
export function resolveGlobalMaxFileSizeBytes(
  configService: ConfigService,
): number {
  const kinds: UploadSizeKind[] = ["image", "video", "audio", "other"];
  const maxSize = Math.max(
    ...kinds.map((kind) => {
      const configuredMB = readPositiveNumber(
        configService,
        SIZE_RULES[kind].mbConfigKey,
      );
      return configuredMB === null
        ? SIZE_RULES[kind].defaultBytes
        : mbToBytes(configuredMB);
    }),
    DEFAULT_MAX_FILE_SIZE,
  );

  const legacyMaxSize = readPositiveNumber(
    configService,
    LEGACY_MAX_FILE_SIZE_KEY,
  );
  return legacyMaxSize !== null && legacyMaxSize > maxSize
    ? legacyMaxSize
    : maxSize;
}

export function resolveMaxFileCount(configService: ConfigService): number {
  return (
    readPositiveNumber(configService, "UPLOAD_MAX_FILE_COUNT") ??
    DEFAULT_MAX_FILE_COUNT
  );
}

/**
 * 各类型上限（MB），供前端预压缩提示使用。
 */
export function resolveSizeLimitsMb(
  configService: ConfigService,
): Record<UploadSizeKind, number> {
  const kinds: UploadSizeKind[] = ["image", "video", "audio", "other"];
  return kinds.reduce(
    (acc, kind) => {
      const rule = SIZE_RULES[kind];
      const configuredMB = readPositiveNumber(configService, rule.mbConfigKey);
      acc[kind] =
        configuredMB === null ? bytesToMb(rule.defaultBytes) : configuredMB;
      return acc;
    },
    {} as Record<UploadSizeKind, number>,
  );
}

export function resolveAllowedMimeTypes(
  configService: ConfigService,
  fallback: readonly string[],
): string[] {
  const configured = configService.get<string>("UPLOAD_ALLOWED_MIME_TYPES");
  if (!configured) {
    return [...fallback];
  }

  return configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
