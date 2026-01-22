import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Article } from './article.entity';
import { User } from '../../user/entities/user.entity';

@Entity({ comment: '文章收藏表' })
@Index(['userId', 'articleId'], { unique: true })
export class ArticleFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ comment: '文章ID' })
  articleId: number;

  @ManyToOne(() => Article, (article) => article.articleFavorites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'articleId' })
  article: Article;

  @CreateDateColumn({ comment: '收藏时间' })
  createdAt: Date;
}
