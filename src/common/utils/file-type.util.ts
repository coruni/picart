import * as fs from "fs";
import fileTypeChecker from "file-type-checker";

export interface DetectedFileType {
  extension: string;
  mimeType: string;
  description: string;
}

const IMAGE_EXTENSIONS = [
  "jpeg",
  "png",
  "gif",
  "webp",
  "tiff",
  "bmp",
  "heic",
];

const VIDEO_EXTENSIONS = [
  "mp4",
  "webm",
  "ogg",
  "mov",
  "avi",
  "mkv",
  "flv",
  "mpeg",
  "m4v",
  "3gpp",
];

const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "ogg",
  "aac",
  "flac",
  "m4a",
  "amr",
];

const DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "rtf",
];

const ARCHIVE_EXTENSIONS = [
  "zip",
  "rar",
  "7z",
];

const DEFAULT_CHUNK_SIZE = 64;
const ZIP_CHUNK_SIZE = 30000;

export class FileTypeUtil {
  static detectFromBuffer(buffer: Buffer): DetectedFileType | null {
    const result = fileTypeChecker.detectFile(buffer.buffer as ArrayBuffer, {
      chunkSize: buffer.length,
    });
    return result ? this.normalizeResult(result) : null;
  }

  static async detectFromFilePath(filePath: string): Promise<DetectedFileType | null> {
    const handle = await fs.promises.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(DEFAULT_CHUNK_SIZE);
      const { bytesRead } = await handle.read(buffer, 0, DEFAULT_CHUNK_SIZE, 0);
      if (bytesRead === 0) return null;

      const result = fileTypeChecker.detectFile(buffer.subarray(0, bytesRead).buffer as ArrayBuffer, {
        chunkSize: bytesRead,
      });

      if (result) {
        return this.normalizeResult(result);
      }

      const zipBuffer = Buffer.alloc(ZIP_CHUNK_SIZE);
      const { bytesRead: zipBytesRead } = await handle.read(zipBuffer, 0, ZIP_CHUNK_SIZE, 0);
      if (zipBytesRead < DEFAULT_CHUNK_SIZE) return null;

      const zipResult = fileTypeChecker.detectFile(zipBuffer.subarray(0, zipBytesRead).buffer as ArrayBuffer, {
        chunkSize: ZIP_CHUNK_SIZE,
      });

      return zipResult ? this.normalizeResult(zipResult) : null;
    } finally {
      await handle.close();
    }
  }

  static validateFromBuffer(buffer: Buffer, allowedExtensions: string[]): boolean {
    return fileTypeChecker.validateFileType(buffer.buffer as ArrayBuffer, allowedExtensions, {
      chunkSize: buffer.length,
    });
  }

  static async validateFromFilePath(
    filePath: string,
    allowedExtensions: string[],
  ): Promise<boolean> {
    const handle = await fs.promises.open(filePath, "r");
    try {
      const hasZipOrArchive = allowedExtensions.some((ext) =>
        [...ARCHIVE_EXTENSIONS, "zip", "rar", "7z"].includes(ext.toLowerCase()),
      );
      const chunkSize = hasZipOrArchive ? ZIP_CHUNK_SIZE : DEFAULT_CHUNK_SIZE;

      const buffer = Buffer.alloc(chunkSize);
      const { bytesRead } = await handle.read(buffer, 0, chunkSize, 0);
      if (bytesRead === 0) return false;

      return fileTypeChecker.validateFileType(
        buffer.subarray(0, bytesRead).buffer as ArrayBuffer,
        allowedExtensions,
        { chunkSize: bytesRead },
      );
    } finally {
      await handle.close();
    }
  }

  static isImage(mimeTypeOrExt: string): boolean {
    const ext = mimeTypeOrExt.includes("/")
      ? mimeTypeOrExt.split("/")[1]?.toLowerCase()
      : mimeTypeOrExt.toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
  }

  static isVideo(mimeTypeOrExt: string): boolean {
    const ext = mimeTypeOrExt.includes("/")
      ? mimeTypeOrExt.split("/")[1]?.toLowerCase()
      : mimeTypeOrExt.toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
  }

  static isAudio(mimeTypeOrExt: string): boolean {
    const ext = mimeTypeOrExt.includes("/")
      ? mimeTypeOrExt.split("/")[1]?.toLowerCase()
      : mimeTypeOrExt.toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
  }

  static isDocument(mimeTypeOrExt: string): boolean {
    const ext = mimeTypeOrExt.includes("/")
      ? mimeTypeOrExt.split("/")[1]?.toLowerCase()
      : mimeTypeOrExt.toLowerCase();
    return DOCUMENT_EXTENSIONS.includes(ext);
  }

  static isArchive(mimeTypeOrExt: string): boolean {
    const ext = mimeTypeOrExt.includes("/")
      ? mimeTypeOrExt.split("/")[1]?.toLowerCase()
      : mimeTypeOrExt.toLowerCase();
    return ARCHIVE_EXTENSIONS.includes(ext);
  }

  static getImageExtensions(): string[] {
    return [...IMAGE_EXTENSIONS];
  }

  static getVideoExtensions(): string[] {
    return [...VIDEO_EXTENSIONS];
  }

  static getAudioExtensions(): string[] {
    return [...AUDIO_EXTENSIONS];
  }

  static getDocumentExtensions(): string[] {
    return [...DOCUMENT_EXTENSIONS];
  }

  static getArchiveExtensions(): string[] {
    return [...ARCHIVE_EXTENSIONS];
  }

  private static normalizeResult(result: any): DetectedFileType {
    return {
      extension: result.extension,
      mimeType: result.mimeType,
      description: result.description,
    };
  }
}
