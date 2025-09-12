import { Injectable } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { User } from '../user/entities/user.entity';

@Injectable()
export class MessageNotificationService {
  constructor(
    private readonly messageService: MessageService,
    private readonly messageGateway: MessageGateway,
  ) {}

  /**
   * 发送系统通知
   */
  async sendSystemNotification(
    content: string,
    title?: string,
    receiverIds?: number[],
    metadata?: any,
  ) {
    const systemUser = { 
      id: null, 
      username: 'system',
      roles: [{ name: 'admin', permissions: ['message:create'] }]
    } as unknown as User; // 系统用户，具有管理员权限

    const createMessageDto = {
      senderId: null, // 系统消息使用 null 作为发送者
      content,
      title,
      type: 'system' as const,
      isBroadcast: !receiverIds || receiverIds.length === 0,
      receiverIds,
      metadata,
    };

    const result = await this.messageService.create(createMessageDto, systemUser);

    // 实时推送
    if (receiverIds && receiverIds.length > 0) {
      receiverIds.forEach(userId => {
        this.messageGateway.notifyUser(userId, result.data);
      });
    } else {
      // 广播消息
      this.messageGateway.server.emit('newMessage', result.data);
    }

    return result;
  }

  /**
   * 发送用户注册欢迎消息
   */
  async sendWelcomeMessage(userId: number, username: string) {
    const content = `欢迎 ${username} 加入我们的平台！`;
    const title = '欢迎消息';
    
    return await this.sendSystemNotification(
      content,
      title,
      [userId],
      { type: 'welcome', username }
    );
  }

  /**
   * 发送订单状态变更通知
   */
  async sendOrderStatusNotification(
    userId: number,
    orderNo: string,
    status: string,
    amount?: number,
  ) {
    const statusMap = {
      'PAID': '支付成功',
      'CANCELLED': '订单取消',
      'REFUNDED': '退款成功',
      'COMPLETED': '订单完成',
    };

    const content = `您的订单 ${orderNo} 状态已变更为：${statusMap[status] || status}${amount ? `，金额：${amount}元` : ''}`;
    const title = '订单状态通知';

    return await this.sendSystemNotification(
      content,
      title,
      [userId],
      { type: 'order_status', orderNo, status, amount }
    );
  }

  /**
   * 发送支付成功通知
   */
  async sendPaymentSuccessNotification(
    userId: number,
    orderNo: string,
    amount: number,
    paymentMethod: string,
  ) {
    const content = `您的订单 ${orderNo} 支付成功！支付金额：${amount}元，支付方式：${paymentMethod}`;
    const title = '支付成功通知';

    return await this.sendSystemNotification(
      content,
      title,
      [userId],
      { type: 'payment_success', orderNo, amount, paymentMethod }
    );
  }

  /**
   * 发送余额变动通知
   */
  async sendBalanceChangeNotification(
    userId: number,
    changeAmount: number,
    balance: number,
    reason: string,
  ) {
    const changeType = changeAmount > 0 ? '增加' : '减少';
    const content = `您的账户余额${changeType}了 ${Math.abs(changeAmount)}元，当前余额：${balance}元。原因：${reason}`;
    const title = '余额变动通知';

    return await this.sendSystemNotification(
      content,
      title,
      [userId],
      { type: 'balance_change', changeAmount, balance, reason }
    );
  }

  /**
   * 发送文章相关通知
   */
  async sendArticleNotification(
    userId: number,
    articleTitle: string,
    action: 'published' | 'approved' | 'rejected' | 'commented',
    commentContent?: string,
  ) {
    const actionMap = {
      'published': '发布成功',
      'approved': '审核通过',
      'rejected': '审核拒绝',
      'commented': '收到评论',
    };

    let content = `您的文章"${articleTitle}"${actionMap[action]}`;
    if (action === 'commented' && commentContent) {
      content += `，评论内容：${commentContent}`;
    }

    const title = '文章通知';

    return await this.sendSystemNotification(
      content,
      title,
      [userId],
      { type: 'article_notification', articleTitle, action, commentContent }
    );
  }

  /**
   * 发送系统维护通知
   */
  async sendMaintenanceNotification(
    content: string,
    startTime?: string,
    endTime?: string,
  ) {
    const title = '系统维护通知';
    const metadata = {
      type: 'maintenance',
      startTime,
      endTime,
    };

    return await this.sendSystemNotification(content, title, undefined, metadata);
  }

  /**
   * 发送活动通知
   */
  async sendActivityNotification(
    content: string,
    activityName: string,
    receiverIds?: number[],
  ) {
    const title = '活动通知';
    const metadata = {
      type: 'activity',
      activityName,
    };

    return await this.sendSystemNotification(content, title, receiverIds, metadata);
  }

  /**
   * 发送自定义通知
   */
  async sendCustomNotification(
    content: string,
    title: string,
    receiverIds?: number[],
    metadata?: any,
  ) {
    return await this.sendSystemNotification(content, title, receiverIds, metadata);
  }
}
