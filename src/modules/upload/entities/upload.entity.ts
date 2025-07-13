import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('uploads')
export class Upload {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  hash: string; // 文件MD5哈希，用于去重

  @Column()
  originalName: string; // 原始文件名

  @Column()
  filename: string; // 存储的文件名

  @Column()
  path: string; // 文件存储路径

  @Column()
  size: number; // 文件大小（字节）

  @Column()
  mimeType: string; // 文件MIME类型

  @Column({ default: 1 })
  referenceCount: number; // 引用计数

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
