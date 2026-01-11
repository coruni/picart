import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DecorationService } from './decoration.service';

@Injectable()
export class DecorationEventService {
  constructor(private readonly decorationService: DecorationService) {}

  /**
   * 监听点赞事件
   */
  @OnEvent('article.liked')
  async handleArticleLiked(payload: { userId: number; articleId: number }) {
    try {
      await this.decorationService.updateLikeProgress(payload.userId);
    } catch (error) {
      console.error('更新点赞进度失败:', error);
    }
  }

  /**
   * 监听评论事件
   */
  @OnEvent('comment.created')
  async handleCommentCreated(payload: { userId: number; articleId: number; commentId: number }) {
    try {
      await this.decorationService.updateCommentProgress(payload.userId);
    } catch (error) {
      console.error('更新评论进度失败:', error);
    }
  }
}
