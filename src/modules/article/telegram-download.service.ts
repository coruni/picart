import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "../config/config.service";

interface MessageLinkInfo {
  chatId: string | number;
  messageId: number;
  isPrivate: boolean;
}

@Injectable()
export class TelegramDownloadService {
  constructor(private configService: ConfigService) {}

  /**
   * 获取 Telegram 文件下载链接
   * @param input file_id 或消息链接
   */
  async getFileDownloadUrl(input: string): Promise<{ url: string; fileName?: string }> {
    const { botToken, proxyEnabled, proxyUrl, forwardChatId } = await this.configService.getTelegramConfig();

    if (!botToken) {
      throw new BadRequestException("Telegram Bot Token 未配置");
    }

    // 构建 API 基础 URL
    const baseUrl =
      proxyEnabled && proxyUrl
        ? proxyUrl.replace(/\/$/, "")
        : "https://api.telegram.org";

    // 判断是消息链接还是 file_id
    if (this.isMessageLink(input)) {
      // 处理消息链接
      return this.handleMessageLink(input, botToken, baseUrl, forwardChatId);
    } else {
      // 处理 file_id
      return this.handleFileId(input, botToken, baseUrl);
    }
  }

  /**
   * 判断是否为消息链接
   */
  private isMessageLink(input: string): boolean {
    return input.startsWith("https://t.me/") || input.startsWith("t.me/");
  }

  /**
   * 解析消息链接
   * 支持格式:
   * - https://t.me/username/message_id
   * - https://t.me/c/channel_id/message_id (私有频道)
   * - https://t.me/username/message_id?single (相册单张)
   */
  private parseMessageLink(link: string): MessageLinkInfo {
    // 标准化链接
    let url = link;
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);

      if (pathParts.length < 2) {
        throw new Error("无效的消息链接格式");
      }

      const messageId = parseInt(pathParts[pathParts.length - 1], 10);
      if (isNaN(messageId)) {
        throw new Error("无效的消息ID");
      }

      // 私有频道链接: t.me/c/channel_id/message_id
      if (pathParts[0] === "c" && pathParts.length >= 3) {
        const channelId = pathParts[1];
        return {
          chatId: `-100${channelId}`,
          messageId,
          isPrivate: true,
        };
      }

      // 公开频道/群组链接: t.me/username/message_id
      const username = pathParts[0];
      return {
        chatId: `@${username}`,
        messageId,
        isPrivate: false,
      };
    } catch (error) {
      throw new BadRequestException(`解析消息链接失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  /**
   * 处理消息链接获取文件
   */
  private async handleMessageLink(
    link: string,
    botToken: string,
    baseUrl: string,
    forwardChatId?: string
  ): Promise<{ url: string; fileName?: string }> {
    const linkInfo = this.parseMessageLink(link);

    // 方法1: 尝试直接转发到内部频道获取文件
    if (forwardChatId) {
      return this.getFileByForward(linkInfo, botToken, baseUrl, forwardChatId);
    }

    // 方法2: 如果没有配置转发频道，提示用户
    throw new BadRequestException(
      "消息链接需要配置转发频道ID (telegram_forward_chat_id)。请先将 Bot 添加到频道并配置频道ID。"
    );
  }

  /**
   * 通过转发消息获取文件
   */
  private async getFileByForward(
    linkInfo: MessageLinkInfo,
    botToken: string,
    baseUrl: string,
    forwardChatId: string
  ): Promise<{ url: string; fileName?: string }> {
    // 转发消息到内部频道
    const forwardUrl = `${baseUrl}/bot${botToken}/copyMessage`;
    const forwardResponse = await fetch(forwardUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: forwardChatId,
        from_chat_id: linkInfo.chatId,
        message_id: linkInfo.messageId,
      }),
    });

    const forwardData = await forwardResponse.json();

    if (!forwardData.ok) {
      // 如果转发失败，可能是 Bot 没有权限
      if (forwardData.error_code === 403) {
        throw new BadRequestException(
          "Bot 没有权限访问该频道/群组的消息。请确保 Bot 已添加到频道并具有读取消息的权限。"
        );
      }
      throw new BadRequestException(`转发消息失败: ${forwardData.description}`);
    }

    // 获取转发后的消息详情
    const forwardedMessageId = forwardData.result.message_id;
    const messageUrl = `${baseUrl}/bot${botToken}/getMessage?chat_id=${forwardChatId}&message_id=${forwardedMessageId}`;
    const messageResponse = await fetch(messageUrl);
    const messageData = await messageResponse.json();

    if (!messageData.ok) {
      throw new BadRequestException(`获取消息详情失败: ${messageData.description}`);
    }

    // 从消息中提取文件信息
    const message = messageData.result;
    const fileInfo = this.extractFileInfo(message);

    if (!fileInfo) {
      throw new BadRequestException("消息中未找到可下载的文件");
    }

    // 获取文件下载链接
    const downloadUrl = await this.handleFileId(fileInfo.fileId, botToken, baseUrl);

    // 删除转发的临时消息
    await fetch(
      `${baseUrl}/bot${botToken}/deleteMessage?chat_id=${forwardChatId}&message_id=${forwardedMessageId}`
    );

    return downloadUrl;
  }

  /**
   * 从消息中提取文件信息
   */
  private extractFileInfo(message: any): { fileId: string; type: string } | null {
    // 检查各种文件类型
    if (message.document) {
      return { fileId: message.document.file_id, type: "document" };
    }
    if (message.video) {
      return { fileId: message.video.file_id, type: "video" };
    }
    if (message.audio) {
      return { fileId: message.audio.file_id, type: "audio" };
    }
    if (message.photo) {
      // 获取最大尺寸的图片
      const photos = message.photo;
      const largestPhoto = photos[photos.length - 1];
      return { fileId: largestPhoto.file_id, type: "photo" };
    }
    if (message.voice) {
      return { fileId: message.voice.file_id, type: "voice" };
    }
    if (message.video_note) {
      return { fileId: message.video_note.file_id, type: "video_note" };
    }
    if (message.animation) {
      return { fileId: message.animation.file_id, type: "animation" };
    }
    if (message.sticker) {
      return { fileId: message.sticker.file_id, type: "sticker" };
    }

    return null;
  }

  /**
   * 处理 file_id 获取下载链接
   */
  private async handleFileId(
    fileId: string,
    botToken: string,
    baseUrl: string
  ): Promise<{ url: string; fileName?: string }> {
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