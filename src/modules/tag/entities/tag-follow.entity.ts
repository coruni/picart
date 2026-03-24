import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Column,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Tag } from "./tag.entity";

@Entity({ comment: "标签关注表" })
@Unique(["userId", "tagId"])
export class TagFollow {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ comment: "用户ID" })
  userId: number;

  @ManyToOne(() => Tag)
  @JoinColumn({ name: "tagId" })
  tag: Tag;

  @Column({ comment: "标签ID" })
  tagId: number;

  @CreateDateColumn({ comment: "关注时间" })
  createdAt: Date;
}