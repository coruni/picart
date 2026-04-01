import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

@Entity("user_block")
@Unique("UQ_user_block_pair", ["userId", "blockedUserId"])
export class UserBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  userId: number;

  @Column({ type: "int" })
  blockedUserId: number;

  @Column({ type: "varchar", length: 255, nullable: true })
  reason: string | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "blockedUserId" })
  blockedUser: User;

  @CreateDateColumn()
  createdAt: Date;
}
