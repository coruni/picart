import { User } from '../../user/entities/user.entity';
import { Article } from './article.entity';
import { CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ comment: '文章点赞记录表' })
export class ArticleLike {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Article)
  article: Article;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
