import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { In, Repository } from 'typeorm';
import { ImageSerializer } from '../../common/utils';
import { Upload } from '../upload/entities/upload.entity';
import { ContentAuditService } from './content-audit.service';

export type MediaReferenceInspection = {
  uploads: Upload[];
  uploadMap: Map<string, Upload>;
  externalUrls: string[];
  pendingUploads: Upload[];
  rejectedUploads: Upload[];
  approvedUploads: Upload[];
};

@Injectable()
export class ContentAuditWorkflowService {
  static readonly BLOCKED_PLACEHOLDER = '/images/blocked.webp';
  static readonly PENDING_PLACEHOLDER = '/images/pending.webp';

  constructor(
    @InjectRepository(Upload)
    private readonly uploadRepository: Repository<Upload>,
    private readonly contentAuditService: ContentAuditService,
  ) {}

  extractRichTextImageUrls(html?: string | null): string[] {
    if (!html || typeof html !== 'string') {
      return [];
    }

    const imageTagRegex = /<img\b[^>]*>/gi;
    const srcSet = new Set<string>();
    const tags = html.match(imageTagRegex) || [];

    for (const tag of tags) {
      const classMatch = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
      const classNames = classMatch?.[1] || '';

      // 仅提取正文编辑器里的真实插图，避免把 emoji / 装饰图混入 images
      if (!/\bql-image\b/.test(classNames)) {
        continue;
      }

      const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const src = srcMatch?.[1]?.trim();

      if (src && !src.startsWith('data:')) {
        srcSet.add(src);
      }
    }

    return Array.from(srcSet);
  }

  collectArticleImageUrls(input: {
    images?: string | string[] | null;
    content?: string | null;
    cover?: string | null;
  }): string[] {
    const imageUrls = ImageSerializer.extractUrls(
      ImageSerializer.serialize(input.images),
    );
    const contentUrls = this.extractRichTextImageUrls(input.content);
    const allUrls = [...imageUrls, ...contentUrls];

    if (input.cover?.trim()) {
      allUrls.push(input.cover.trim());
    }

    return Array.from(
      new Set(allUrls.map((url) => url.trim()).filter((url) => url.length > 0)),
    );
  }

  buildContentFingerprint(content?: string | null, images: string[] = []): string {
    const payload = JSON.stringify({
      content: content || '',
      images: [...new Set(images)].sort(),
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  async inspectMediaReferences(urls: string[]): Promise<MediaReferenceInspection> {
    const normalizedUrls = Array.from(
      new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0)),
    );

    if (normalizedUrls.length === 0) {
      return {
        uploads: [],
        uploadMap: new Map<string, Upload>(),
        externalUrls: [],
        pendingUploads: [],
        rejectedUploads: [],
        approvedUploads: [],
      };
    }

    const uploads = await this.uploadRepository.find({
      where: { url: In(normalizedUrls) },
    });

    const uploadMap = new Map<string, Upload>();
    for (const upload of uploads) {
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

    const externalUrls = normalizedUrls.filter((url) => !uploadMap.has(url));
    const pendingUploads = uploads.filter((upload) => upload.auditStatus === 'pending');
    const rejectedUploads = uploads.filter((upload) => upload.auditStatus === 'rejected');
    const approvedUploads = uploads.filter((upload) => upload.auditStatus === 'approved');

    return {
      uploads,
      uploadMap,
      externalUrls,
      pendingUploads,
      rejectedUploads,
      approvedUploads,
    };
  }

  async assertUserImageReady(
    imageUrl: string,
    options: {
      label: string;
      userId?: number;
      scene: 'avatar' | 'image';
    },
  ) {
    const normalizedUrl = imageUrl?.trim();
    if (!normalizedUrl) {
      return;
    }

    const upload = await this.uploadRepository.findOne({
      where: { url: normalizedUrl },
    });

    if (upload) {
      if (upload.auditStatus === 'approved') {
        return;
      }

      if (upload.auditStatus === 'pending') {
        throw new ForbiddenException(
          `${options.label}正在审核中，请等待审核完成后再试`,
        );
      }

      throw new ForbiddenException(`${options.label}审核不通过: 包含违规内容`);
    }

    const result =
      options.scene === 'avatar'
        ? await this.contentAuditService.auditAvatar(normalizedUrl, options.userId)
        : await this.contentAuditService.auditImageContent(
            normalizedUrl,
            options.userId,
          );

    if (!result.passed) {
      throw new ForbiddenException(
        `${options.label}审核不通过: ${result.suggestion || '包含违规内容'}`,
      );
    }
  }
}
