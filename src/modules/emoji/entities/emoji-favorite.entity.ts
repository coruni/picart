import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Emoji } from './emoji.entity';

@Entity('emoji_favorite')
@Index(['userId', 'emojiId'], { unique: true })
export class EmojiFavorite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  emojiId: number;

  @CreateDateColumn()
  createdAt: Date;

  // 关联关系
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Emoji, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'emojiId' })
  emoji: Emoji;
}
