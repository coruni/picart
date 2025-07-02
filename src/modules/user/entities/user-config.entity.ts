import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ comment: '用户配置表' })
export class UserConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  
}
