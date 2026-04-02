import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { PrivateConversation } from "./private-conversation.entity";

export type PrivateMessageKind = "text" | "image" | "file" | "card";

@Entity("private_message")
@Index(["receiverId", "readAt", "recalledAt"])
@Index(["conversationId", "createdAt"])
export class PrivateMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  conversationId: number;

  @Column({ type: "int" })
  senderId: number;

  @Column({ type: "int" })
  receiverId: number;

  @Column({ type: "varchar", length: 20, default: "text" })
  messageKind: PrivateMessageKind;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "json", nullable: true })
  payload: any;

  @Column({ type: "datetime", nullable: true })
  readAt: Date | null;

  @Column({ type: "datetime", nullable: true })
  recalledAt: Date | null;

  @Column({ type: "int", nullable: true })
  recalledById: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  recallReason: string | null;

  @ManyToOne(() => PrivateConversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversationId" })
  conversation: PrivateConversation;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "senderId" })
  sender: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "receiverId" })
  receiver: User;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "recalledById" })
  recalledBy: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
