import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "../../modules/config/config.service";

/**
 * 图片URL域名白名单守卫，支持泛域名匹配
 *
 * 配置项: image_allowed_domains（逗号分隔，如 *.example.com,img.example.com）
 * 为空时不限制任何域名
 *
 * 只检查请求体中 background、avatar、cover、images 字段中的图片 URL。
 * 图片域名等于当前请求 host 时自动放行。
 * background/avatar/cover 中不合规的链接直接删除字段；
 * images 中不合规的链接从数组中过滤掉。
 */
@Injectable()
export class ImageDomainGuard implements CanActivate {
  private readonly logger = new Logger(ImageDomainGuard.name);

  private readonly imageUrlRegex = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg|heic|heif|tiff?)/i;

  private readonly checkedFields = new Set(["background", "avatar", "cover", "images"]);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const method = request.method?.toUpperCase();
    if (!["POST", "PUT", "PATCH"].includes(method)) {
      return true;
    }

    const allowedDomains = await this.configService.getImageAllowedDomains();

    // 白名单为空，不限制
    if (allowedDomains.length === 0) {
      return true;
    }

    const body = request.body;
    if (!body || typeof body !== "object") {
      return true;
    }

    const requestHostname = this.getRequestHostname(request);

    // 遍历检查的字段
    for (const [key, value] of Object.entries(body)) {
      if (!this.checkedFields.has(key)) continue;

      if (typeof value === "string") {
        if (this.looksLikeImageUrl(value) && !this.isAllowed(value, allowedDomains, requestHostname)) {
          this.logger.warn(`Image URL not allowed, deleting field ${key}: ${value}`);
          delete body[key];
        }
      } else if (Array.isArray(value)) {
        const filtered = value.filter(
          (item) =>
            typeof item !== "string" ||
            !this.looksLikeImageUrl(item) ||
            this.isAllowed(item, allowedDomains, requestHostname),
        );
        if (filtered.length !== value.length) {
          this.logger.warn(`Image URLs not allowed, filtered ${key}: ${value.length} -> ${filtered.length}`);
          body[key] = filtered;
        }
      }
    }

    return true;
  }

  private isAllowed(
    url: string,
    allowedDomains: { domain: string; wildcard: boolean }[],
    requestHostname: string | null,
  ): boolean {
    // 图片域名等于当前请求域名时自动放行
    if (requestHostname && this.isSameHost(url, requestHostname)) {
      return true;
    }
    return this.isUrlAllowed(url, allowedDomains);
  }

  private looksLikeImageUrl(value: string): boolean {
    return (
      (value.startsWith("http://") || value.startsWith("https://")) &&
      this.imageUrlRegex.test(value)
    );
  }

  private getRequestHostname(request: any): string | null {
    try {
      const forwardedHost = request.headers["x-forwarded-host"];
      const host = Array.isArray(forwardedHost)
        ? forwardedHost[0]
        : forwardedHost || request.headers.host;
      if (!host) return null;
      return host.split(":")[0].toLowerCase();
    } catch {
      return null;
    }
  }

  private isSameHost(url: string, requestHostname: string): boolean {
    try {
      const urlHostname = new URL(url).hostname.toLowerCase();
      return urlHostname === requestHostname;
    } catch {
      return false;
    }
  }

  private isUrlAllowed(
    url: string,
    allowedDomains: { domain: string; wildcard: boolean }[],
  ): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      for (const { domain, wildcard } of allowedDomains) {
        const normalizedDomain = domain.toLowerCase();

        if (wildcard) {
          if (
            hostname === normalizedDomain ||
            hostname.endsWith("." + normalizedDomain)
          ) {
            return true;
          }
        } else {
          if (hostname === normalizedDomain) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }
}
