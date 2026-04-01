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
import { PrivateMessage } from "./private-message.entity";

@Entity("private_conversation")
export class PrivateConversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "int" })
  userOneId: number;

  @Column({ type: "int" })
  userTwoId: number;

  @Column({ type: "int", nullable: true })
  lastMessageId: number | null;

  @Column({ type: "datetime", nullable: true })
  lastMessageAt: Date | null;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userOneId" })
  userOne: User;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userTwoId" })
  userTwo: User;

  @ManyToOne(() => PrivateMessage, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "lastMessageId" })
  lastMessage: PrivateMessage | null;

  @OneToMany(() => PrivateMessage, (message) => message.conversation)
  messages: PrivateMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
