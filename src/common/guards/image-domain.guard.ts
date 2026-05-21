import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "../../modules/config/config.service";

/**
 * 图片URL域名白名单守卫，支持泛域名匹配
 *
 * 配置项: image_allowed_domains（逗号分隔，如 *.example.com,img.example.com）
 * 为空时不限制任何域名
 *
 * 只检查请求体中 background、avatar、cover、images 字段中的图片 URL。
 * 图片域名等于当前请求 host 时自动放行，不需要配到白名单。
 */
@Injectable()
export class ImageDomainGuard implements CanActivate {
  private readonly logger = new Logger(ImageDomainGuard.name);

  private readonly imageUrlRegex = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg|heic|heif|tiff?)/i;

  // 只检查这些字段中的图片 URL
  private readonly checkedFields = new Set(["background", "avatar", "cover", "images"]);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 只检查写操作
    const method = request.method?.toUpperCase();
    if (!["POST", "PUT", "PATCH"].includes(method)) {
      return true;
    }

    const allowedDomains = await this.configService.getImageAllowedDomains();

    // 白名单为空，不限制
    if (allowedDomains.length === 0) {
      return true;
    }

    const imageUrls = this.extractImageUrls(request.body);

    // 没有需要检查的图片 URL，直接通过
    if (imageUrls.length === 0) {
      return true;
    }

    // 当前请求的 hostname，用于隐式白名单
    const requestHostname = this.getRequestHostname(request);

    for (const url of imageUrls) {
      // 图片域名等于当前请求域名时自动放行
      if (requestHostname && this.isSameHost(url, requestHostname)) {
        continue;
      }
      if (!this.isUrlAllowed(url, allowedDomains)) {
        this.logger.warn(`Image URL domain not allowed: ${url}`);
        throw new ForbiddenException(`图片域名不在白名单内: ${new URL(url).hostname}`);
      }
    }

    return true;
  }

  /**
   * 从请求体中递归提取所有图片 URL
   */
  private extractImageUrls(body: any, urls: string[] = []): string[] {
    if (!body || typeof body !== "object") {
      return urls;
    }

    if (Array.isArray(body)) {
      for (const item of body) {
        this.extractImageUrls(item, urls);
      }
      return urls;
    }

    for (const [key, value] of Object.entries(body)) {
      if (!this.checkedFields.has(key)) continue;

      if (typeof value === "string") {
        // background、avatar、cover 是字符串 URL
        if (this.looksLikeImageUrl(value)) {
          urls.push(value);
        }
      } else if (Array.isArray(value)) {
        // images 是 Array<string>
        for (const item of value) {
          if (typeof item === "string" && this.looksLikeImageUrl(item)) {
            urls.push(item);
          }
        }
      }
    }

    return urls;
  }

  /**
   * 判断字符串看起来是否像图片 URL
   */
  private looksLikeImageUrl(value: string): boolean {
    return (
      (value.startsWith("http://") || value.startsWith("https://")) &&
      this.imageUrlRegex.test(value)
    );
  }

  /**
   * 从请求中提取 hostname，优先 x-forwarded-host
   */
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

  /**
   * 判断图片 URL 的域名是否等于当前请求域名
   */
  private isSameHost(url: string, requestHostname: string): boolean {
    try {
      const urlHostname = new URL(url).hostname.toLowerCase();
      return urlHostname === requestHostname;
    } catch {
      return false;
    }
  }

  /**
   * 检查 URL 是否在白名单内
   * 支持精确匹配和泛域名匹配（*.example.com 匹配 a.example.com, b.c.example.com）
   */
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
