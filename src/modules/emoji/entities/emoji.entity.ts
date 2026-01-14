import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('emoji')
export class Emoji {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  code: string; // 表情代码，如 :smile:

  @Column({ type: 'enum', enum: ['system', 'user'], default: 'user' })
  type: 'system' | 'user';

  @Column({ nullable: true })
  userId: number | null; // 系统表情为 null

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string; // 分类：开心、难过、搞笑等

  @Column({ type: 'text', nullable: true })
  tags: string; // 标签，逗号分隔

  @Column({ default: 0 })
  useCount: number; // 使用次数

  @Column({ default: true })
  isPublic: boolean; // 是否公开（用户表情可以设置为公开供他人使用）

  @Column({ default: 'active' })
  status: 'active' | 'inactive' | 'deleted';

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column({ type: 'int', nullable: true })
  fileSize: number; // 文件大小（字节）

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType: string; // 文件类型

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;
}
