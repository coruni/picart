import { User } from '../../user/entities/user.entity';
import { Category } from '../../category/entities/category.entity';
import { Tag } from '../../tag/entities/tag.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ comment: '文章表' })
export class Article {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200, comment: '文章标题' })
  title: string;

  @Column({ default: false, comment: '是否需要登录后才能查看' })
  requireLogin: boolean;

  @Column({ default: false, comment: '是否仅关注后可查看' })
  requireFollow: boolean;

  @Column({ default: false, comment: '是否需要支付后才能查看' })
  requirePayment: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '查看所需支付金额' })
  viewPrice: number;

  @Column({ type: 'enum', enum: ['image', 'mixed'], default: 'mixed', comment: '文章类型' })
  type: 'image' | 'mixed';

  @Column({ type: 'text', nullable: true, comment: '文章内容' })
  content: string;

    @Column({ default: "", comment: '文章的delta格式数据' })
  delta: string;

  @Column({ type: 'text', nullable: true, comment: '文章图片' })
  images: string;


  @Column({ length: 500, nullable: true, comment: '文章摘要' })
  summary: string;

  @Column({ default: 0, comment: '阅读量' })
  views: number;

  @Column({ default: 0, comment: '点赞数' })
  likes: number;

  @Column({
    default: 'DRAFT',
    comment: '状态',
    type: 'enum',
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED', 'BANNED', 'REJECTED'],
  })
  status: string;

  @Column({ nullable: true, comment: '封面图片' })
  cover: string;

  @Column({ nullable: true, comment: '作者ID' })
  authorId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @ManyToOne(() => Category)
  category: Category;

  @ManyToMany(() => Tag)
  @JoinTable()
  tags: Tag[];

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
