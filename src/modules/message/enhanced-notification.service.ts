import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MessageNotificationService } from "./message-notification.service";
import { UserConfig } from "../user/entities/user-config.entity";
import { User } from "../user/entities/user.entity";

export interface NotificationOptions {
  userId: number;
  content: string;
  title?: string;
  metadata?: any;
  notificationType:
    | "system"
    | "comment"
    | "like"
    | "follow"
    | "message"
    | "order"
    | "payment"
    | "invite";
  channels?: ("email" | "sms" | "push")[];
}

@Injectable()
export class EnhancedNotificationService {
  constructor(
    private readonly messageNotificationService: MessageNotificationService,
    @InjectRepository(UserConfig)
    private readonly userConfigRepository: Repository<UserConfig>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 根据用户配置发送通知
   */
  async sendNotification(options: NotificationOptions) {
    const {
      userId,
      content,
      title,
      metadata,
      notificationType,
      channels = ["push"],
    } = options;

    // 获取用户配置
    const userConfig = await this.getUserConfig(userId);
    if (!userConfig) {
      console.warn(`用户 ${userId} 没有配置，使用默认设置`);
      return;
    }

    // 检查是否启用该类型的通知
    if (!this.isNotificationEnabled(userConfig, notificationType)) {
      console.log(`用户 ${userId} 禁用了 ${notificationType} 通知`);
      return;
    }

    // 发送系统消息通知
    if (this.shouldSendSystemMessage(userConfig, notificationType)) {
      await this.messageNotificationService.sendSystemNotification(
        content,
        title,
        [userId],
        { ...metadata, notificationType },
      );
    }

    // 发送邮件通知
    if (channels.includes("email") && userConfig.enableEmailNotification) {
      await this.sendEmailNotification(userId, content, title);
    }

    // 发送短信通知
    if (channels.includes("sms") && userConfig.enableSmsNotification) {
      await this.sendSmsNotification(userId, content);
    }

    // 发送推送通知
    if (channels.includes("push") && userConfig.enablePushNotification) {
      await this.sendPushNotification(userId, content, title);
    }
  }

  /**
   * 发送评论通知
   */
  async sendCommentNotification(
    userId: number,
    commenterName: string,
    articleTitle: string,
    commentContent: string,
  ) {
    const content = `${commenterName} 评论了您的文章"${articleTitle}"：${commentContent}`;
    const title = "新评论通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "comment",
      metadata: { commenterName, articleTitle, commentContent },
    });
  }

  /**
   * 发送点赞通知
   */
  async sendLikeNotification(
    userId: number,
    likerName: string,
    targetType: "article" | "comment",
    targetTitle: string,
  ) {
    const content = `${likerName} 点赞了您的${targetType === "article" ? "文章" : "评论"}"${targetTitle}"`;
    const title = "新点赞通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "like",
      metadata: { likerName, targetType, targetTitle },
    });
  }

  /**
   * 发送关注通知
   */
  async sendFollowNotification(userId: number, followerName: string) {
    const content = `${followerName} 关注了您`;
    const title = "新关注通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "follow",
      metadata: { followerName },
    });
  }

  /**
   * 发送私信通知
   */
  async sendMessageNotification(
    userId: number,
    senderName: string,
    messageContent: string,
  ) {
    const content = `${senderName} 给您发送了私信：${messageContent}`;
    const title = "新私信通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "message",
      metadata: { senderName, messageContent },
    });
  }

  /**
   * 发送订单通知
   */
  async sendOrderNotification(
    userId: number,
    orderNo: string,
    status: string,
    amount?: number,
  ) {
    const statusMap = {
      PAID: "支付成功",
      CANCELLED: "订单取消",
      REFUNDED: "退款成功",
      COMPLETED: "订单完成",
    };

    const content = `您的订单 ${orderNo} 状态已变更为：${statusMap[status] || status}${amount ? `，金额：${amount}元` : ""}`;
    const title = "订单状态通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "order",
      metadata: { orderNo, status, amount },
    });
  }

  /**
   * 发送支付通知
   */
  async sendPaymentNotification(
    userId: number,
    orderNo: string,
    amount: number,
    paymentMethod: string,
  ) {
    const content = `您的订单 ${orderNo} 支付成功！支付金额：${amount}元，支付方式：${paymentMethod}`;
    const title = "支付成功通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "payment",
      metadata: { orderNo, amount, paymentMethod },
    });
  }

  /**
   * 发送邀请通知
   */
  async sendInviteNotification(
    userId: number,
    inviterName: string,
    inviteCode: string,
  ) {
    const content = `${inviterName} 邀请您加入平台，邀请码：${inviteCode}`;
    const title = "邀请通知";

    await this.sendNotification({
      userId,
      content,
      title,
      notificationType: "invite",
      metadata: { inviterName, inviteCode },
    });
  }

  /**
   * 发送系统通知
   */
  async sendSystemNotification(
    userId: number,
    content: string,
    title?: string,
    metadata?: any,
  ) {
    await this.sendNotification({
      userId,
      content,
      title,
      metadata,
      notificationType: "system",
    });
  }

  /**
   * 获取用户配置
   */
  private async getUserConfig(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["config"],
    });

    console.log("user?.config", user?.config);

    return user?.config || null;
  }

  /**
   * 检查是否启用该类型的通知
   */
  private isNotificationEnabled(
    userConfig: UserConfig,
    notificationType: string,
  ): boolean {
    const notificationMap = {
      system: userConfig.enableSystemNotification,
      comment: userConfig.enableCommentNotification,
      like: userConfig.enableLikeNotification,
      follow: userConfig.enableFollowNotification,
      message: userConfig.enableMessageNotification,
      order: userConfig.enableOrderNotification,
      payment: userConfig.enablePaymentNotification,
      invite: userConfig.enableInviteNotification,
    };

    return notificationMap[notificationType] ?? true;
  }

  /**
   * 检查是否应该发送系统消息
   */
  private shouldSendSystemMessage(
    userConfig: UserConfig,
    notificationType: string,
  ): boolean {
    // 系统通知总是发送系统消息
    if (notificationType === "system") {
      return true;
    }

    // 其他类型的通知也发送系统消息（用于站内消息）
    return true;
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(
    userId: number,
    content: string,
    title?: string,
  ) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user?.email) {
        console.log(`用户 ${userId} 没有邮箱地址`);
        return;
      }

      // 这里可以集成邮件服务
      console.log(`发送邮件通知给用户 ${userId}：${title} - ${content}`);
      // await this.mailerService.sendEmail(user.email, title || '通知', content);
    } catch (error) {
      console.error(`发送邮件通知失败：${error.message}`);
    }
  }

  /**
   * 发送短信通知
   */
  private async sendSmsNotification(userId: number, content: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user?.phone) {
        console.log(`用户 ${userId} 没有手机号`);
        return;
      }

      // 这里可以集成短信服务
      console.log(`发送短信通知给用户 ${userId}：${content}`);
      // await this.smsService.sendSms(user.phone, content);
    } catch (error) {
      console.error(`发送短信通知失败：${error.message}`);
    }
  }

  /**
   * 发送推送通知
   */
  private async sendPushNotification(
    userId: number,
    content: string,
    title?: string,
  ) {
    try {
      // 这里可以集成推送服务（如 Firebase、极光推送等）
      console.log(`发送推送通知给用户 ${userId}：${title} - ${content}`);
      // await this.pushService.sendPush(userId, title || '通知', content);
    } catch (error) {
      console.error(`发送推送通知失败：${error.message}`);
    }
  }
}
