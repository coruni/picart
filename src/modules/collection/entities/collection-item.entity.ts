import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Collection } from './collection.entity';
import { Article } from '../../article/entities/article.entity';
import { User } from '../../user/entities/user.entity';

@Entity('collection_item', { comment: '合集项目表' })
@Index(['collectionId', 'articleId'], { unique: true })
export class CollectionItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '合集ID' })
  collectionId: number;

  @ManyToOne(() => Collection, (collection) => collection.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;

  @Column({ comment: '文章ID' })
  articleId: number;

  @ManyToOne(() => Article, (article) => article.collectionItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'articleId' })
  article: Article;

  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: 0, comment: '在合集中中的排序' })
  sort: number;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  note: string;

  @CreateDateColumn({ comment: '收藏时间' })
  createdAt: Date;
}
