import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { EmojiPackItem } from "./emoji-pack-item.entity";

@Entity("emoji_pack")
export class EmojiPack {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 100 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  coverUrl: string | null;

  @Column({ type: "int" })
  userId: number;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ default: false })
  isPublic: boolean;

  @Column({
    type: "enum",
    enum: ["active", "inactive", "deleted"],
    default: "active",
  })
  status: "active" | "inactive" | "deleted";

  @OneToMany(() => EmojiPackItem, (packItem) => packItem.pack)
  items: EmojiPackItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
