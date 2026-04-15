import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Article } from "./article.entity";

@Entity("article_dislike")
@Unique("UQ_article_dislike_user_article", ["userId", "articleId"])
export class ArticleDislike {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int", comment: "用户ID" })
  userId: number;

  @Column({ type: "int", comment: "原始文章ID" })
  articleId: number;

  @Column({ type: "int", comment: "作者ID" })
  authorId: number;

  @Column({ type: "int", nullable: true, comment: "分类ID" })
  categoryId: number | null;

  @Column({ type: "simple-json", nullable: true, comment: "标签ID快照" })
  tagIds: number[] | null;

  @Column({ type: "varchar", length: 255, nullable: true, comment: "原因" })
  reason: string | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Article, { onDelete: "CASCADE" })
  @JoinColumn({ name: "articleId" })
  article: Article;

  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}
