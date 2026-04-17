import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * 缩略图信息
 */
export interface ThumbnailInfo {
  name: string; // 尺寸名称 (thumb, small, medium, large)
  url: string; // 缩略图 URL
  path: string; // 文件路径
  size: number; // 文件大小（字节）
  width: number; // 图片宽度
  height: number; // 图片高度
}

/**
 * 原图信息（当开启压缩时存储）
 */
export interface OriginalInfo {
  url: string; // 原图 URL
  path: string; // 文件路径
  size: number; // 文件大小（字节）
  width: number; // 图片宽度
  height: number; // 图片高度
}

@Entity("uploads", { comment: "上传文件表" })
export class Upload {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  hash: string; // 文件MD5哈希，用于去重

  @Column()
  originalName: string; // 原始文件名

  @Column()
  storage: UploadStorageType; // 上传类型

  @Column()
  filename: string; // 存储的文件名

  @Column()
  path: string; // 文件存储路径

  @Column()
  url: string; // 文件URL

  @Column()
  size: number; // 文件大小（字节）

  @Column()
  mimeType: string; // 文件MIME类型

  @Column({ default: 1 })
  referenceCount: number; // 引用计数

  @Column({
    type: "json",
    nullable: true,
    comment: "原图信息（压缩后保留原图时）",
  })
  original: OriginalInfo | null;

  @Column({ type: "json", nullable: true, comment: "缩略图信息列表" })
  thumbnails: ThumbnailInfo[] | null;

  @Column({ default: false, comment: "是否已处理压缩" })
  processed: boolean;

  @Column({
    type: "enum",
    enum: ["pending", "approved", "rejected"],
    default: "pending",
    comment: "审核状态",
  })
  auditStatus: "pending" | "approved" | "rejected";

  @Column({ type: "json", nullable: true, comment: "审核结果详情" })
  auditResult: Record<string, any> | null;

  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}

export enum UploadStorageType {
  LOCAL = "local",
  S3 = "s3",
}
