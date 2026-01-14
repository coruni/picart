import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { FavoriteItem } from './favorite-item.entity';

@Entity({ comment: '收藏夹表' })
export class Favorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, comment: '收藏夹名称' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '收藏夹描述' })
  description: string;

  @Column({ nullable: true, comment: '头像' })
  avatar: string;

  @Column({ nullable: true, comment: '封面图片' })
  cover: string;

  @Column({ default: false, comment: '是否公开' })
  isPublic: boolean;

  @Column({ default: 0, comment: '排序' })
  sort: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => FavoriteItem, (item) => item.favorite, { cascade: true })
  items: FavoriteItem[];

  @Column({ default: 0, comment: '收藏数量' })
  itemCount: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
