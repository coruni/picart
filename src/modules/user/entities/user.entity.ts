import { Role } from '../../role/entities/role.entity';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ comment: '用户表' })
export class User {
  @ApiProperty({ description: '用户ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '用户名' })
  @Column({ unique: true, comment: '用户名' })
  username: string;

  @ApiProperty({ description: '昵称' })
  @Column({ unique: true, nullable: true, comment: '昵称' })
  nickname: string;

  @ApiProperty({ description: '密码' })
  @Column({ comment: '密码' })
  password: string;

  @ApiProperty({ description: '邮箱' })
  @Column({ nullable: true, comment: '邮箱', unique: true })
  email: string;

  @ApiProperty({ description: '手机号' })
  @Column({ nullable: true, comment: '手机', unique: true })
  phone: string;

  @ApiProperty({ description: '状态' })
  @Column({ default: 'ACTIVE', comment: '状态', type: 'enum', enum: ['ACTIVE', 'INACTIVE', 'BANNED'] })
  status: string;

  @Column({ nullable: true, comment: '是否封禁' })
  banned: Date;

  @Column({ nullable: true, comment: '封禁原因' })
  banReason: string;

  @ApiProperty({ description: '头像' })
  @Column({ nullable: true, comment: '头像', type: 'text' })
  avatar: string;

  @Column({ nullable: true, comment: '描述' })
  description: string;

  @Column({ nullable: true, comment: '地址', type: 'text' })
  address: string;

  @Column({ comment: '性别', type: 'enum', enum: ['male', 'female', 'other'], default: 'other' })
  gender: string;

  @Column({ nullable: true, comment: '生日', type: 'datetime' })
  birthDate: Date;

  @Column({ default: 0, comment: '文章数量', type: 'int' })
  articleCount: number;

  @Column({ default: 0, comment: '评论数量', type: 'int' })
  followerCount: number;

  @Column({ default: 0, comment: '关注数量', type: 'int' })
  followingCount: number;

  @Column({ default: 0, comment: '等级', type: 'tinyint' })
  level: number;

  @Column({ default: 0, comment: '经验', type: 'int' })
  experience: number;

  @Column({ default: 0, comment: '积分', type: 'double' })
  score: number;

  @Column({ default: 0, comment: '钱包', type: 'double' })
  wallet: number;

  @Column({ nullable: true, comment: '最后登录时间', type: 'datetime' })
  lastLoginAt: Date;

  @Column({ nullable: true, comment: '最后活跃时间', type: 'datetime' })
  lastActiveAt: Date;

  @Column({ nullable: true, comment: '刷新令牌' })
  refreshToken: string;

  @ManyToMany(() => Role)
  @JoinTable()
  roles: Role[];

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

}
