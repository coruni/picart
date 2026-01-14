import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { Comment } from './comment.entity';

@Entity({ comment: '评论点赞记录表' })
@Index(['commentId', 'userId'], { unique: true })
export class CommentLike {
  @ApiProperty({ description: '点赞ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: '评论ID' })
  @Column({ type: 'int', comment: '评论ID' })
  commentId: number;

  @ApiProperty({ description: '用户ID' })
  @Column({ type: 'int', comment: '用户ID' })
  userId: number;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Comment, (comment) => comment.id, { onDelete: 'CASCADE' })
  comment: Comment;
}
