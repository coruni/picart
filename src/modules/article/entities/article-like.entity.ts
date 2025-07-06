import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { Article } from './article.entity';

@Entity({ comment: '文章点赞记录表' })
@Index(['articleId', 'userId'], { unique: true }) // 每个用户对每篇文章只能点赞一次
export class ArticleLike {
  @ApiProperty({ description: '点赞ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '文章ID' })
  @Column({ type: 'int', comment: '文章ID' })
  articleId: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ type: 'int', comment: '用户ID' })
  userId: number;

  @ApiProperty({ description: '表情类型', enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'dislike'], default: 'like' })
  @Column({
    type: 'enum',
    enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry', 'dislike'],
    comment: '表情类型：like-点赞，love-喜爱，haha-哈哈，wow-惊讶，sad-难过，angry-愤怒，dislike-踩',
    default: 'like'
  })
  reactionType: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry' | 'dislike';

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Article, article => article.id, { onDelete: 'CASCADE' })
  article: Article;
}
