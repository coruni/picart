import { Role } from "../../role/entities/role.entity";
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { UserConfig } from "./user-config.entity";
import { Order } from "../../order/entities/order.entity";
@Entity({ comment: "用户表" })
export class User {
  @ApiProperty({ description: "用户ID" })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: "用户名" })
  @Column({ unique: true, comment: "用户名" })
  username: string;

  @ApiProperty({ description: "昵称" })
  @Column({ unique: true, nullable: true, comment: "昵称" })
  nickname: string;

  @ApiProperty({ description: "密码" })
  @Column({ comment: "密码" })
  password: string;

  @ApiProperty({ description: "邮箱" })
  @Column({ nullable: true, comment: "邮箱", unique: true })
  email: string;

  @ApiProperty({ description: "手机号" })
  @Column({ nullable: true, comment: "手机", unique: true })
  phone: string;

  @ApiProperty({ description: "状态" })
  @Column({
    default: "ACTIVE",
    comment: "状态",
    type: "enum",
    enum: ["ACTIVE", "INACTIVE", "BANNED"],
  })
  status: string;

  @Column({ nullable: true, comment: "是否封禁" })
  banned: Date;

  @Column({ nullable: true, comment: "封禁原因" })
  banReason: string;

  @ApiProperty({ description: "头像" })
  @Column({ nullable: true, comment: "头像", type: "text" })
  avatar: string;

  @Column({ nullable: true, comment: "描述" })
  description: string;

  @Column({ nullable: true, comment: "地址", type: "text" })
  address: string;

  @Column({
    comment: "性别",
    type: "enum",
    enum: ["male", "female", "other"],
    default: "other",
  })
  gender: string;

  @Column({ nullable: true, comment: "生日", type: "datetime" })
  birthDate: Date;

  @Column({ default: 0, comment: "文章数量", type: "int" })
  articleCount: number;

  @Column({ default: 0, comment: "粉丝数量", type: "int" })
  followerCount: number;

  @Column({ default: 0, comment: "关注数量", type: "int" })
  followingCount: number;

  @Column({ default: 0, comment: "等级", type: "tinyint" })
  level: number;

  @Column({ default: 0, comment: "经验", type: "int" })
  experience: number;

  @Column({ default: 0, comment: "积分", type: "double" })
  score: number;

  @Column({ default: 0, comment: "钱包", type: "double" })
  wallet: number;

  @Column({
    default: 0,
    comment:
      "会员等级：0-普通用户，1-青铜会员，2-白银会员，3-黄金会员，4-钻石会员，5-至尊会员",
  })
  membershipLevel: number;

  @Column({
    default: "普通用户",
    comment: "会员等级名称",
  })
  membershipLevelName: string;

  @Column({
    default: "INACTIVE",
    comment: "会员状态：ACTIVE-活跃，INACTIVE-非活跃",
    type: "enum",
    enum: ["ACTIVE", "INACTIVE"],
  })
  membershipStatus: string;

  @Column({
    nullable: true,
    type: "datetime",
    comment: "会员开通时间",
  })
  membershipStartDate: Date;

  @Column({
    nullable: true,
    type: "datetime",
    comment: "会员到期时间",
  })
  membershipEndDate: Date;

  @Column({ nullable: true, comment: "最后登录时间", type: "datetime" })
  lastLoginAt: Date;

  @Column({ nullable: true, comment: "最后活跃时间", type: "datetime" })
  lastActiveAt: Date;

  @Column({ nullable: true, comment: "刷新令牌" })
  refreshToken: string;

  @ApiProperty({ description: "邀请人ID" })
  @Column({ nullable: true, comment: "邀请人ID", type: "int" })
  inviterId: number | null;

  @ApiProperty({ description: "邀请码" })
  @Column({
    nullable: true,
    comment: "使用的邀请码",
    type: "varchar",
    length: 255,
  })
  inviteCode: string | null;

  @ApiProperty({ description: "邀请总收益" })
  @Column({
    default: 0,
    type: "decimal",
    precision: 10,
    scale: 2,
    comment: "邀请总收益（元）",
  })
  inviteEarnings: number;

  @ApiProperty({ description: "邀请人数" })
  @Column({ default: 0, comment: "成功邀请人数", type: "int" })
  inviteCount: number;

  @ManyToMany(() => Role)
  @JoinTable()
  roles: Role[];

  @ManyToMany(() => User, (user) => user.followers, { cascade: true })
  @JoinTable({
    name: "user_followings",
    joinColumn: {
      name: "followerId",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "followingId",
      referencedColumnName: "id",
    },
  })
  following: User[];

  @ManyToMany(() => User, (user) => user.following)
  followers: User[];

  @OneToOne(() => UserConfig, (userConfig) => userConfig.user, {
    cascade: true,
  })
  config: UserConfig;

  @ApiProperty({ description: "用户订单" })
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @ApiProperty({ description: "创建时间" })
  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @ApiProperty({ description: "更新时间" })
  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}
