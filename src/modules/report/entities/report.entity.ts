import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Article } from '../../article/entities/article.entity';
import { Comment } from '../../comment/entities/comment.entity';

@Entity({ comment: '举报表' })
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ['USER', 'ARTICLE', 'COMMENT'],
    comment: '举报类型',
  })
  type: 'USER' | 'ARTICLE' | 'COMMENT';

  @Column({ type: 'text', comment: '举报原因' })
  reason: string;

  @Column({
    type: 'enum',
    enum: ['SPAM', 'ABUSE', 'INAPPROPRIATE', 'COPYRIGHT', 'OTHER'],
    comment: '举报分类',
  })
  category: 'SPAM' | 'ABUSE' | 'INAPPROPRIATE' | 'COPYRIGHT' | 'OTHER';

  @Column({ type: 'text', nullable: true, comment: '详细描述' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'],
    default: 'PENDING',
    comment: '处理状态',
  })
  status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';

  @Column({ type: 'text', nullable: true, comment: '处理结果' })
  result: string;

  @Column({
    type: 'enum',
    enum: ['DELETE_CONTENT', 'BAN_USER', 'WARNING', 'NONE'],
    nullable: true,
    comment: '处理动作: DELETE_CONTENT-删除内容(文章/评论), BAN_USER-封禁用户, WARNING-警告, NONE-无需处理',
  })
  action: 'DELETE_CONTENT' | 'BAN_USER' | 'WARNING' | 'NONE';

  @Column({ nullable: true, comment: '举报人ID' })
  reporterId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column({ nullable: true, comment: '被举报用户ID' })
  reportedUserId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reportedUserId' })
  reportedUser: User;

  @Column({ nullable: true, comment: '被举报文章ID' })
  reportedArticleId: number;

  @ManyToOne(() => Article, { nullable: true })
  @JoinColumn({ name: 'reportedArticleId' })
  reportedArticle: Article;

  @Column({ nullable: true, comment: '被举报评论ID' })
  reportedCommentId: number;

  @ManyToOne(() => Comment, { nullable: true })
  @JoinColumn({ name: 'reportedCommentId' })
  reportedComment: Comment;

  @Column({ nullable: true, comment: '处理人ID' })
  handlerId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'handlerId' })
  handler: User;

  @Column({ type: 'datetime', nullable: true, comment: '处理时间' })
  handledAt: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
