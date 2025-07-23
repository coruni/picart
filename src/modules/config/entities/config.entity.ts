import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ comment: '系统配置表' })
export class Config {
  @ApiProperty({ description: '配置ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '键' })
  @Column({
    comment: '键',
    unique: true,
  })
  key: string;

  @ApiProperty({ description: '值' })
  @Column({
    comment: '值',
    nullable: true,
  })
  value: string;

  @ApiProperty({ description: '描述' })
  @Column({
    comment: '描述',
    nullable: true,
  })
  description: string;

  @ApiProperty({ description: '类型' })
  @Column({
    comment: '类型',
    default: 'string',
  })
  type: string;

  @ApiProperty({ description: '分组' })
  @Column({
    comment: '分组',
    default: 'system',
  })
  group: string;

  @ApiProperty({ description: '是否开放' })
  @Column({
    comment: '是否开放',
    default: false,
  })
  public: boolean;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
