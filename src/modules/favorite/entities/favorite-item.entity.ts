import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Favorite } from './favorite.entity';
import { Article } from '../../article/entities/article.entity';
import { User } from '../../user/entities/user.entity';

@Entity({ comment: '收藏夹项目表' })
@Index(['favoriteId', 'articleId'], { unique: true })
export class FavoriteItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '收藏夹ID' })
  favoriteId: number;

  @ManyToOne(() => Favorite, (favorite) => favorite.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'favoriteId' })
  favorite: Favorite;

  @Column({ comment: '文章ID' })
  articleId: number;

  @ManyToOne(() => Article, (article) => article.favoriteItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'articleId' })
  article: Article;

  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: 0, comment: '在收藏夹中的排序' })
  sort: number;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  note: string;

  @CreateDateColumn({ comment: '收藏时间' })
  createdAt: Date;
}
