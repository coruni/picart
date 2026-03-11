import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "../config/config.service";

@Injectable()
export class TelegramDownloadService {
  constructor(private configService: ConfigService) {}

  /**
   * 获取 Telegram 文件下载链接
   * @param fileId Telegram file_id
   */
  async getFileDownloadUrl(fileId: string): Promise<{ url: string; fileName?: string }> {
    const { botToken, proxyEnabled, proxyUrl } = await this.configService.getTelegramConfig();

    if (!botToken) {
      throw new BadRequestException("Telegram Bot Token 未配置");
    }

    // 构建 API 基础 URL
    const baseUrl =
      proxyEnabled && proxyUrl
        ? proxyUrl.replace(/\/$/, "")
        : "https://api.telegram.org";

    // 调用 getFile API
    const response = await fetch(
      `${baseUrl}/bot${botToken}/getFile?file_id=${fileId}`
    );
    const data = await response.json();

    if (!data.ok) {
      throw new BadRequestException(`获取文件失败: ${data.description}`);
    }

    const filePath = data.result.file_path;
    const fileName = filePath.split("/").pop();

    // 构建下载链接
    const downloadUrl = `${baseUrl}/file/bot${botToken}/${filePath}`;

    return { url: downloadUrl, fileName };
  }
}