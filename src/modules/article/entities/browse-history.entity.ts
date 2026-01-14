import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Article } from './article.entity';

@Entity('browse_history')
@Index(['userId', 'articleId'], { unique: true })
@Index(['userId', 'updatedAt'])
export class BrowseHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '文章ID' })
  articleId: number;

  @Column({ type: 'int', default: 1, comment: '浏览次数' })
  viewCount: number;

  @Column({ type: 'int', default: 0, comment: '浏览进度（百分比）' })
  progress: number;

  @Column({ type: 'int', default: 0, comment: '停留时长（秒）' })
  duration: number;

  @CreateDateColumn({ comment: '首次浏览时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '最后浏览时间' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'articleId' })
  article: Article;
}
