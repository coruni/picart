import { User } from "../../user/entities/user.entity";
import { Article } from "../../article/entities/article.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ comment: "评论表" })
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text", comment: "评论内容" })
  content: string;

  @Column({ default: 0, comment: "点赞数" })
  likes: number;

  @Column({ default: 0, comment: "回复数" })
  replyCount: number;

  @Column({
    default: "DRAFT",
    comment: "状态",
    type: "enum",
    enum: ["PUBLISHED", "DELETED", "REJECTED", "DRAFT"],
  })
  status: string;

  @ManyToOne(() => User)
  author: User;

  @ManyToOne(() => Article, { onDelete: "CASCADE" })
  article: Article;

  @ManyToOne(() => Comment, (comment) => comment.replies, {
    nullable: true,
    onDelete: "CASCADE",
  })
  parent: Comment;

  @Column({ nullable: true })
  rootId: number;

  @OneToMany(() => Comment, (comment) => comment.parent, {
    onDelete: "CASCADE",
  })
  replies: Comment[];

  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}
