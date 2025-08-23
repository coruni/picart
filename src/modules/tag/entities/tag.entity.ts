import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ comment: "标签表" })
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true, comment: "标签名称" })
  name: string;

  @Column({ length: 200, nullable: true, comment: "标签描述" })
  description: string;

  @Column({ type: "text", comment: "标签头像", nullable: true })
  avatar: string;

  @Column({ type: "text", comment: "标签背景", nullable: true })
  background: string;

  @Column({ type: "text", comment: "标签封面", nullable: true })
  cover: string;

  @Column({ default: 0, comment: "排序" })
  sort: number;

  @Column({ default: 0, comment: "文章数量" })
  articleCount: number;

  @Column("int", { default: 0, comment: "关注数量" })
  followCount: number;

  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}
