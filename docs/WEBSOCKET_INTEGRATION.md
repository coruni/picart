# WebSocket 通知集成指南

本文档说明如何在各个业务模块中集成 WebSocket 消息通知功能。

## 目录

- [基础集成](#基础集成)
- [评论模块集成](#评论模块集成)
- [点赞功能集成](#点赞功能集成)
- [关注功能集成](#关注功能集成)
- [订单模块集成](#订单模块集成)
- [支付模块集成](#支付模块集成)
- [邀请模块集成](#邀请模块集成)
- [文章模块集成](#文章模块集成)

## 基础集成

### 1. 导入通知服务

在需要发送通知的模块中导入 `MessageModule`：

```typescript
// your.module.ts
import { Module } from '@nestjs/common';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
  // ...
})
export class YourModule {}
```

### 2. 注入通知服务

在服务类中注入通知服务：

```typescript
// your.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';

@Injectable()
export class YourService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}
  
  // 使用通知服务
  async someMethod() {
    await this.enhancedNotificationService.sendSystemNotification(
      userId,
      '通知内容',
      '通知标题'
    );
  }
}
```

## 评论模块集成

### 场景：用户评论文章或回复评论时通知作者

```typescript
// comment.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';
import { ArticleService } from '../article/article.service';

@Injectable()
export class CommentService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
    private readonly articleService: ArticleService,
  ) {}

  async create(createCommentDto: CreateCommentDto, user: User) {
    // 创建评论
    const comment = await this.commentRepository.save({
      ...createCommentDto,
      userId: user.id,
    });

    // 获取文章信息
    const article = await this.articleService.findOne(createCommentDto.articleId);

    // 如果是回复评论
    if (createCommentDto.parentId) {
      const parentComment = await this.commentRepository.findOne({
        where: { id: createCommentDto.parentId },
        relations: ['user'],
      });

      // 通知被回复的用户
      if (parentComment && parentComment.userId !== user.id) {
        await this.enhancedNotificationService.sendCommentNotification(
          parentComment.userId,
          user.nickname || user.username,
          article.title,
          comment.content,
          article.id,
          comment.id,
          parentComment.id
        );
      }
    } else {
      // 通知文章作者
      if (article.userId !== user.id) {
        await this.enhancedNotificationService.sendCommentNotification(
          article.userId,
          user.nickname || user.username,
          article.title,
          comment.content,
          article.id,
          comment.id
        );
      }
    }

    return comment;
  }
}
```

### 完整的评论模块集成示例

```typescript
// comment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { MessageModule } from '../message/message.module';
import { ArticleModule } from '../article/article.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment]),
    MessageModule,  // 导入消息模块
    ArticleModule,
  ],
  providers: [CommentService],
  controllers: [CommentController],
  exports: [CommentService],
})
export class CommentModule {}
```

## 点赞功能集成

### 场景：用户点赞文章或评论时通知作者

```typescript
// article.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';

@Injectable()
export class ArticleService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}

  async likeArticle(articleId: number, user: User) {
    // 获取文章
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
      relations: ['user'],
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    // 检查是否已点赞
    const existingLike = await this.articleLikeRepository.findOne({
      where: { articleId, userId: user.id },
    });

    if (existingLike) {
      throw new BadRequestException('已经点赞过了');
    }

    // 创建点赞记录
    await this.articleLikeRepository.save({
      articleId,
      userId: user.id,
    });

    // 更新点赞数
    await this.articleRepository.increment({ id: articleId }, 'likeCount', 1);

    // 通知文章作者（不通知自己）
    if (article.userId !== user.id) {
      await this.enhancedNotificationService.sendLikeNotification(
        article.userId,
        user.nickname || user.username,
        'article',
        article.title,
        article.id
      );
    }

    return { success: true, message: '点赞成功' };
  }

  async likeComment(commentId: number, user: User) {
    // 获取评论
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['user', 'article'],
    });

    if (!comment) {
      throw new NotFoundException('评论不存在');
    }

    // 创建点赞记录（省略重复检查逻辑）
    // ...

    // 通知评论作者
    if (comment.userId !== user.id) {
      await this.enhancedNotificationService.sendLikeNotification(
        comment.userId,
        user.nickname || user.username,
        'comment',
        comment.content.substring(0, 50),
        comment.id,
        comment.article.id
      );
    }

    return { success: true, message: '点赞成功' };
  }
}
```

## 关注功能集成

### 场景：用户关注其他用户时通知被关注者

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';

@Injectable()
export class UserService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}

  async followUser(followingId: number, user: User) {
    // 检查是否已关注
    const existingFollow = await this.userFollowingRepository.findOne({
      where: { followerId: user.id, followingId },
    });

    if (existingFollow) {
      throw new BadRequestException('已经关注过了');
    }

    // 不能关注自己
    if (followingId === user.id) {
      throw new BadRequestException('不能关注自己');
    }

    // 创建关注记录
    await this.userFollowingRepository.save({
      followerId: user.id,
      followingId,
    });

    // 更新关注数和粉丝数
    await this.userRepository.increment({ id: user.id }, 'followingCount', 1);
    await this.userRepository.increment({ id: followingId }, 'followerCount', 1);

    // 通知被关注的用户
    await this.enhancedNotificationService.sendFollowNotification(
      followingId,
      user.nickname || user.username
    );

    return { success: true, message: '关注成功' };
  }

  async unfollowUser(followingId: number, user: User) {
    // 取消关注逻辑
    // ...
  }
}
```

## 订单模块集成

### 场景：订单状态变更时通知用户

```typescript
// order.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}

  async create(createOrderDto: CreateOrderDto, user: User) {
    // 创建订单
    const order = await this.orderRepository.save({
      ...createOrderDto,
      userId: user.id,
      orderNo: this.generateOrderNo(),
      status: 'PENDING',
    });

    // 发送订单创建通知
    await this.enhancedNotificationService.sendOrderNotification(
      user.id,
      order.orderNo,
      'PENDING',
      order.amount
    );

    return order;
  }

  async updateStatus(orderId: number, status: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 更新订单状态
    await this.orderRepository.update(orderId, { status });

    // 发送状态变更通知
    await this.enhancedNotificationService.sendOrderNotification(
      order.userId,
      order.orderNo,
      status,
      order.amount
    );

    return { success: true, message: '订单状态更新成功' };
  }

  async cancelOrder(orderId: number, user: User) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId: user.id },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.status !== 'PENDING') {
      throw new BadRequestException('只能取消待支付的订单');
    }

    // 取消订单
    await this.orderRepository.update(orderId, { status: 'CANCELLED' });

    // 发送取消通知
    await this.enhancedNotificationService.sendOrderNotification(
      user.id,
      order.orderNo,
      'CANCELLED',
      order.amount
    );

    return { success: true, message: '订单已取消' };
  }
}
```

## 支付模块集成

### 场景：支付成功后通知用户

```typescript
// payment.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';
import { OrderService } from '../order/order.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
    private readonly orderService: OrderService,
  ) {}

  async handlePaymentCallback(paymentData: any) {
    // 验证支付回调
    // ...

    // 获取订单
    const order = await this.orderService.findByOrderNo(paymentData.orderNo);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 更新支付状态
    await this.paymentRepository.save({
      orderId: order.id,
      orderNo: order.orderNo,
      amount: paymentData.amount,
      paymentMethod: paymentData.method,
      transactionId: paymentData.transactionId,
      status: 'SUCCESS',
    });

    // 更新订单状态
    await this.orderService.updateStatus(order.id, 'PAID');

    // 发送支付成功通知
    await this.enhancedNotificationService.sendPaymentNotification(
      order.userId,
      order.orderNo,
      paymentData.amount,
      paymentData.method
    );

    // 如果是会员订单，更新会员状态
    if (order.type === 'MEMBERSHIP') {
      await this.updateMembershipStatus(order.userId, order.membershipType);
    }

    return { success: true, message: '支付成功' };
  }

  async refund(orderId: number, reason: string) {
    const order = await this.orderService.findOne(orderId);

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 执行退款逻辑
    // ...

    // 更新订单状态
    await this.orderService.updateStatus(orderId, 'REFUNDED');

    // 发送退款通知
    await this.enhancedNotificationService.sendOrderNotification(
      order.userId,
      order.orderNo,
      'REFUNDED',
      order.amount
    );

    return { success: true, message: '退款成功' };
  }
}
```

## 邀请模块集成

### 场景：邀请成功和分成发放时通知用户

```typescript
// invite.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';

@Injectable()
export class InviteService {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}

  async useInviteCode(inviteCode: string, user: User) {
    // 查找邀请码
    const invite = await this.inviteRepository.findOne({
      where: { code: inviteCode },
      relations: ['inviter'],
    });

    if (!invite) {
      throw new NotFoundException('邀请码不存在');
    }

    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('邀请码已达到使用上限');
    }

    // 更新邀请码使用次数
    await this.inviteRepository.increment({ id: invite.id }, 'usedCount', 1);

    // 创建邀请关系
    await this.inviteRelationRepository.save({
      inviterId: invite.inviterId,
      inviteeId: user.id,
      inviteCode,
    });

    // 发送邀请成功通知给邀请人
    await this.enhancedNotificationService.sendInviteNotification(
      invite.inviterId,
      user.nickname || user.username,
      inviteCode
    );

    return { success: true, message: '邀请码使用成功' };
  }

  async distributeCommission(orderId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 查找邀请关系
    const inviteRelation = await this.inviteRelationRepository.findOne({
      where: { inviteeId: order.userId },
      relations: ['inviter'],
    });

    if (!inviteRelation) {
      return; // 没有邀请关系，不分成
    }

    // 计算分成金额
    const commissionRate = inviteRelation.inviter.config?.commissionRate || 0.1;
    const commissionAmount = order.amount * commissionRate;

    // 创建分成记录
    await this.inviteCommissionRepository.save({
      inviterId: inviteRelation.inviterId,
      inviteeId: order.userId,
      orderId: order.id,
      orderAmount: order.amount,
      commissionAmount,
      status: 'PENDING',
    });

    // 发放分成到余额
    await this.walletService.addBalance(
      inviteRelation.inviterId,
      commissionAmount,
      `邀请分成 - 订单 ${order.orderNo}`
    );

    // 发送分成通知
    await this.enhancedNotificationService.sendSystemNotification(
      inviteRelation.inviterId,
      `您获得了邀请分成 ${commissionAmount} 元，来自用户 ${order.user.nickname || order.user.username} 的订单`,
      '邀请分成到账',
      {
        type: 'commission',
        orderId: order.id,
        orderNo: order.orderNo,
        amount: commissionAmount,
      }
    );

    return { success: true, message: '分成发放成功' };
  }
}
```

## 文章模块集成

### 场景：文章审核、发布等状态变更时通知作者

```typescript
// article.service.ts
import { Injectable } from '@nestjs/common';
import { MessageNotificationService } from '../message/message-notification.service';

@Injectable()
export class ArticleService {
  constructor(
    private readonly messageNotificationService: MessageNotificationService,
  ) {}

  async create(createArticleDto: CreateArticleDto, user: User) {
    // 创建文章
    const article = await this.articleRepository.save({
      ...createArticleDto,
      userId: user.id,
      status: 'DRAFT',
    });

    return article;
  }

  async publish(articleId: number, user: User) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId, userId: user.id },
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    // 更新文章状态
    await this.articleRepository.update(articleId, {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });

    // 发送发布成功通知
    await this.messageNotificationService.sendArticleNotification(
      user.id,
      article.title,
      'published'
    );

    return { success: true, message: '文章发布成功' };
  }

  async approve(articleId: number) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    // 更新文章状态
    await this.articleRepository.update(articleId, { status: 'APPROVED' });

    // 发送审核通过通知
    await this.messageNotificationService.sendArticleNotification(
      article.userId,
      article.title,
      'approved'
    );

    return { success: true, message: '文章审核通过' };
  }

  async reject(articleId: number, reason: string) {
    const article = await this.articleRepository.findOne({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException('文章不存在');
    }

    // 更新文章状态
    await this.articleRepository.update(articleId, {
      status: 'REJECTED',
      rejectReason: reason,
    });

    // 发送审核拒绝通知
    await this.messageNotificationService.sendSystemNotification(
      `您的文章"${article.title}"审核未通过。原因：${reason}`,
      '文章审核通知',
      [article.userId],
      {
        type: 'article_rejected',
        articleId: article.id,
        articleTitle: article.title,
        reason,
      }
    );

    return { success: true, message: '文章已拒绝' };
  }
}
```

## 使用事件驱动模式（推荐）

为了解耦业务逻辑和通知逻辑，推荐使用 NestJS 的事件系统：

### 1. 定义事件

```typescript
// events/article.events.ts
export class ArticlePublishedEvent {
  constructor(
    public readonly articleId: number,
    public readonly userId: number,
    public readonly title: string,
  ) {}
}

export class CommentCreatedEvent {
  constructor(
    public readonly commentId: number,
    public readonly articleId: number,
    public readonly userId: number,
    public readonly content: string,
    public readonly parentId?: number,
  ) {}
}
```

### 2. 发送事件

```typescript
// article.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ArticlePublishedEvent } from './events/article.events';

@Injectable()
export class ArticleService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async publish(articleId: number, user: User) {
    // 发布文章逻辑
    // ...

    // 发送事件
    this.eventEmitter.emit(
      'article.published',
      new ArticlePublishedEvent(articleId, user.id, article.title)
    );

    return { success: true, message: '文章发布成功' };
  }
}
```

### 3. 监听事件并发送通知

```typescript
// notification.listener.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EnhancedNotificationService } from '../message/enhanced-notification.service';
import { ArticlePublishedEvent, CommentCreatedEvent } from './events/article.events';

@Injectable()
export class NotificationListener {
  constructor(
    private readonly enhancedNotificationService: EnhancedNotificationService,
  ) {}

  @OnEvent('article.published')
  async handleArticlePublished(event: ArticlePublishedEvent) {
    await this.enhancedNotificationService.sendSystemNotification(
      event.userId,
      `您的文章"${event.title}"已成功发布`,
      '文章发布通知',
      {
        type: 'article_published',
        articleId: event.articleId,
      }
    );
  }

  @OnEvent('comment.created')
  async handleCommentCreated(event: CommentCreatedEvent) {
    // 获取文章和评论信息
    // ...

    // 发送通知
    await this.enhancedNotificationService.sendCommentNotification(
      articleAuthorId,
      commenterName,
      articleTitle,
      event.content,
      event.articleId,
      event.commentId,
      event.parentId
    );
  }
}
```

### 4. 注册监听器

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationListener } from './listeners/notification.listener';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    // ...
  ],
  providers: [NotificationListener],
})
export class AppModule {}
```

## 最佳实践

### 1. 异步处理

使用队列处理通知，避免阻塞主业务流程：

```typescript
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  async sendNotification(data: any) {
    await this.notificationQueue.add('send', data);
  }
}
```

### 2. 批量通知

对于需要通知多个用户的场景，使用批量发送：

```typescript
async notifyMultipleUsers(userIds: number[], content: string) {
  await this.messageNotificationService.sendSystemNotification(
    content,
    '系统通知',
    userIds
  );
}
```

### 3. 错误处理

添加适当的错误处理，避免通知失败影响主业务：

```typescript
async sendNotificationSafely(userId: number, content: string) {
  try {
    await this.enhancedNotificationService.sendSystemNotification(
      userId,
      content
    );
  } catch (error) {
    console.error('发送通知失败:', error);
    // 记录日志，但不抛出异常
  }
}
```

### 4. 通知去重

避免短时间内发送重复通知：

```typescript
private recentNotifications = new Map<string, number>();

async sendNotificationWithDedup(userId: number, content: string) {
  const key = `${userId}:${content}`;
  const lastSent = this.recentNotifications.get(key);
  
  if (lastSent && Date.now() - lastSent < 60000) {
    return; // 1分钟内不重复发送
  }
  
  await this.enhancedNotificationService.sendSystemNotification(
    userId,
    content
  );
  
  this.recentNotifications.set(key, Date.now());
}
```

## 总结

通过以上集成方式，可以在各个业务模块中轻松实现实时消息通知功能。建议：

1. 使用事件驱动模式解耦业务逻辑和通知逻辑
2. 使用队列处理通知，避免阻塞主业务
3. 添加适当的错误处理和日志记录
4. 根据用户配置发送通知，尊重用户偏好
5. 实现通知去重，避免骚扰用户

更多详细信息，请参考 [WebSocket 使用指南](./WEBSOCKET_GUIDE.md)。
