import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import {
  USER_CERTIFICATION_CONSTANTS,
  UserCertificationType,
  UserCertificationStatus,
} from "../../../common/constants";

@Entity({ comment: "用户认证表（官方/创作者认证）" })
@Index(["userId", "status"])
@Index(["type", "status"])
export class UserCertification {
  @ApiProperty({ description: "认证ID" })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: "用户ID" })
  @Column({ type: "int", comment: "用户ID" })
  userId: number;

  @ApiProperty({
    description: "认证类型：OFFICIAL-官方，CREATOR-创作者",
    enum: ["OFFICIAL", "CREATOR"],
  })
  @Column({
    type: "enum",
    enum: USER_CERTIFICATION_CONSTANTS.TYPE_VALUES,
    comment: "认证类型：OFFICIAL-官方，CREATOR-创作者",
  })
  type: UserCertificationType;

  @ApiProperty({
    description:
      "认证状态：PENDING-待审核，APPROVED-已通过，REJECTED-已拒绝，REVOKED-已撤销",
    enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED"],
  })
  @Column({
    type: "enum",
    enum: [
      USER_CERTIFICATION_CONSTANTS.STATUS.PENDING,
      USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED,
      USER_CERTIFICATION_CONSTANTS.STATUS.REJECTED,
      USER_CERTIFICATION_CONSTANTS.STATUS.REVOKED,
    ],
    default: USER_CERTIFICATION_CONSTANTS.STATUS.PENDING,
    comment: "认证状态",
  })
  status: UserCertificationStatus;

  @ApiProperty({ description: "真实姓名/主体名称", required: false })
  @Column({ nullable: true, comment: "真实姓名/主体名称" })
  realName: string;

  @ApiProperty({ description: "机构名称（官方认证）", required: false })
  @Column({ nullable: true, comment: "机构名称（官方认证）" })
  organizationName: string;

  @ApiProperty({ description: "认证说明", required: false })
  @Column({ nullable: true, type: "text", comment: "认证说明" })
  description: string;

  @ApiProperty({
    description: "认证标语（作为认证标识公开展示，不暴露私人信息）",
    required: false,
  })
  @Column({
    nullable: true,
    type: "varchar",
    length: 80,
    comment: "认证标语（公开展示用）",
  })
  slogan: string;

  @ApiProperty({ description: "证明材料（文件URL等）", required: false })
  @Column({ nullable: true, type: "json", comment: "证明材料（文件URL等）" })
  materials: string[];

  @ApiProperty({ description: "审核人ID", required: false })
  @Column({ nullable: true, type: "int", comment: "审核人ID" })
  reviewerId: number | null;

  @ApiProperty({ description: "审核意见/拒绝原因", required: false })
  @Column({ nullable: true, type: "text", comment: "审核意见/拒绝原因" })
  reviewReason: string | null;

  @ApiProperty({ description: "审核时间", required: false })
  @Column({ nullable: true, type: "datetime", comment: "审核时间" })
  reviewedAt: Date | null;

  @ApiProperty({ description: "创建时间" })
  @CreateDateColumn({ comment: "创建时间" })
  createdAt: Date;

  @ApiProperty({ description: "更新时间" })
  @UpdateDateColumn({ comment: "更新时间" })
  updatedAt: Date;
}
