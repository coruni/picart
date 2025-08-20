import { Article } from "./article.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum DownloadType {
  BAIDU = "baidu", // 百度网盘
  ONEDRIVE = "onedrive", // OneDrive
  GOOGLE = "google", // 谷歌网盘
  QUARK = "quark", // 夸克网盘
  ALIYUN = "aliyun", // 阿里云
  DROPBOX = "dropbox", // Dropbox
  DIRECT = "direct", // 直链下载
  LANZOU = "lanzou", // 蓝奏云
  MEGA = "mega", // Mega
  OTHER = "other", // 其他
}

@Entity({ comment: "下载资源表" })
export class Download {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: "enum",
    enum: DownloadType,
    comment: "下载类型",
  })
  type: DownloadType;

  @Column({ type: "text", comment: "下载链接" })
  url: string;

  @Column({ nullable: true, comment: "提取密码" })
  password: string;

  @Column({ nullable: true, comment: "提取码" })
  extractionCode: string;

  @Column({ comment: "文章ID" })
  articleId: number;

  @ManyToOne(() => Article, (article) => article.downloads, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "articleId" })
  article: Article;

  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}
