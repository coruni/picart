import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import * as cheerio from "cheerio";

export interface SecurityCheckResult {
  passed: boolean;
  reason?: string;
  sanitizedContent?: string;
  detectedWords?: string[];
  severity?: string;
}

@Injectable()
export class ContentSecurityService {
  private readonly logger = new Logger(ContentSecurityService.name);

  // 允许的iframe域名白名单
  private readonly ALLOWED_IFRAME_DOMAINS = [
    "tiktok.com",
    "www.tiktok.com",
    "douyin.com",
    "www.douyin.com",
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "bilibili.com",
    "www.bilibili.com",
    "player.bilibili.com",
  ];

  // 危险标签列表
  private readonly DANGEROUS_TAGS = [
    "script",
    "style",
    "object",
    "embed",
    "applet",
    "meta",
    "link",
    "base",
    "form",
    "input",
    "button",
    "textarea",
    "select",
  ];

  constructor(private configService: ConfigService) {}

  /**
   * 检查文本中的敏感词
   */
  async checkSensitiveWords(text: string): Promise<SecurityCheckResult> {
    if (!text || text.trim().length === 0) {
      return { passed: true };
    }

    const sensitiveWords = await this.configService.getEnabledSensitiveWords();
    const detectedWords: string[] = [];

    const lowerText = text.toLowerCase();

    for (const word of sensitiveWords) {
      const lowerWord = word.toLowerCase();
      if (lowerText.includes(lowerWord)) {
        detectedWords.push(word);
      }
    }

    if (detectedWords.length > 0) {
      this.logger.warn(`检测到敏感词: ${detectedWords.join(", ")}`);
      return {
        passed: false,
        reason: `内容包含敏感词: ${detectedWords.slice(0, 3).join(", ")}${detectedWords.length > 3 ? "等" : ""}`,
        detectedWords,
      };
    }

    return { passed: true };
  }

  /**
   * 过滤HTML内容中的危险标签和不安全的iframe
   */
  sanitizeHtml(html: string): SecurityCheckResult {
    if (!html || html.trim().length === 0) {
      return { passed: true, sanitizedContent: html };
    }

    try {
      const $ = cheerio.load(html, {
        xmlMode: false,
      });

      let hasChanges = false;

      // 删除危险标签
      this.DANGEROUS_TAGS.forEach((tag) => {
        const elements = $(tag);
        if (elements.length > 0) {
          hasChanges = true;
          elements.remove();
          this.logger.warn(`删除危险标签: <${tag}>`);
        }
      });

      // 处理iframe标签
      $("iframe").each((_, element) => {
        const src = $(element).attr("src");
        if (!src) {
          hasChanges = true;
          $(element).remove();
          this.logger.warn("删除没有src属性的iframe");
          return;
        }

        try {
          const url = new URL(src);
          const hostname = url.hostname.toLowerCase();

          // 检查是否在白名单中
          const isAllowed = this.ALLOWED_IFRAME_DOMAINS.some(
            (domain) =>
              hostname === domain || hostname.endsWith(`.${domain}`),
          );

          if (!isAllowed) {
            hasChanges = true;
            $(element).remove();
            this.logger.warn(`删除不安全的iframe: ${hostname}`);
          }
        } catch (error) {
          // URL解析失败，删除该iframe
          hasChanges = true;
          $(element).remove();
          this.logger.warn(`删除无效URL的iframe: ${src}`);
        }
      });

      // 删除所有事件处理属性 (onclick, onerror等)
      $("*").each((_, element) => {
        const attrs = $(element).attr();
        if (attrs) {
          Object.keys(attrs).forEach((attr) => {
            if (attr.toLowerCase().startsWith("on")) {
              hasChanges = true;
              $(element).removeAttr(attr);
              this.logger.warn(`删除事件属性: ${attr}`);
            }
          });
        }
      });

      // 删除javascript:协议的链接
      $("a[href^='javascript:']").each((_, element) => {
        hasChanges = true;
        $(element).removeAttr("href");
        this.logger.warn("删除javascript:协议链接");
      });

      const sanitizedContent = $.html();

      return {
        passed: true,
        sanitizedContent: hasChanges ? sanitizedContent : html,
      };
    } catch (error) {
      this.logger.error("HTML过滤失败:", error);
      // 如果解析失败，返回原内容但标记为未通过
      return {
        passed: false,
        reason: "HTML内容解析失败",
        sanitizedContent: html,
      };
    }
  }

  /**
   * 综合检查：敏感词 + HTML安全
   */
  async checkContent(
    content: string,
    checkHtml: boolean = false,
  ): Promise<SecurityCheckResult> {
    // 1. 先检查敏感词
    const sensitiveWordResult = await this.checkSensitiveWords(content);
    if (!sensitiveWordResult.passed) {
      return sensitiveWordResult;
    }

    // 2. 如果需要且内容包含HTML标签，检查HTML安全
    if (checkHtml && this.containsHtml(content)) {
      const htmlResult = this.sanitizeHtml(content);
      return htmlResult;
    }

    return { passed: true, sanitizedContent: content };
  }

  /**
   * 检查内容是否包含HTML标签
   */
  private containsHtml(text: string): boolean {
    return /<[^>]+>/.test(text);
  }

  /**
   * 检查昵称
   */
  async checkNickname(nickname: string): Promise<SecurityCheckResult> {
    return this.checkSensitiveWords(nickname);
  }

  /**
   * 检查评论内容
   */
  async checkComment(content: string): Promise<SecurityCheckResult> {
    // 评论需要检查敏感词，如果包含HTML才进行HTML安全检查
    return this.checkContent(content, true);
  }

  /**
   * 检查文章内容
   */
  async checkArticle(
    title: string,
    content?: string,
  ): Promise<SecurityCheckResult> {
    // 先检查标题
    const titleResult = await this.checkSensitiveWords(title);
    if (!titleResult.passed) {
      return titleResult;
    }

    // 如果有内容，检查内容（如果包含HTML才进行HTML安全检查）
    if (content) {
      return this.checkContent(content, true);
    }

    return { passed: true };
  }
}
