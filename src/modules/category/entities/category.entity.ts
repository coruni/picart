import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ comment: '分类表' })
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true, comment: '分类名称' })
  name: string;

  @Column({ length: 200, nullable: true, comment: '分类描述' })
  description: string;

  @Column('int', { nullable: true, comment: '父分类ID' })
  parentId: number;

  // 新增：父分类关系
  @ManyToOne(() => Category, category => category.children, { nullable: true })
  parent: Category;

  // 新增：子分类关系
  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  @Column({ type: 'text', comment: '分类头像' })
  avatar: string;

  @Column({ type: 'text', comment: '分类背景' })
  background: string;

  @Column({ type: 'text', comment: '分类封面' })
  cover: string;

  @Column({ default: 0, comment: '排序' })
  sort: number;

  @Column({ default: 'ENABLED', comment: '分类状态', type: 'enum', enum: ['ENABLED', 'DISABLED'] })
  status: string;

  @Column({ default: 0, comment: '文章数量' })
  articleCount: number;

  @Column('int', { default: 0, comment: '关注数量' })
  followCount: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
