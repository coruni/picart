import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ comment: '用户配置表' })
export class UserConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '用户ID' })
  userId: number;

  @Column({ comment: '配置名称' })
  name: string;

  @Column({ comment: '配置值' })
  value: string;

  @Column({ comment: '配置类型' })
  type: string;

  @Column({ comment: '配置描述' })
  description: string;
}
