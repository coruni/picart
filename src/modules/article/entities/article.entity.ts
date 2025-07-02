import { User } from '../../user/entities/user.entity';
import { Category } from '../../category/entities/category.entity';
import { Tag } from '../../tag/entities/tag.entity';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from 'typeorm';

@Entity({ comment: '文章表' })
export class Article {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200, comment: '文章标题' })
    title: string;

    @Column({ type: 'text', comment: '文章内容' })
    content: string;

    @Column({ type: 'text', comment: '文章图片' ,nullable:true})
    images: string;

    @Column({ length: 500, nullable: true, comment: '文章摘要' })
    summary: string;

    @Column({ default: 0, comment: '阅读量' })
    views: number;

    @Column({ default: 0, comment: '点赞数' })
    likes: number;

    @Column({ default: 'DRAFT', comment: '状态', type: 'enum', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED', 'BANNED', 'REJECTED'] })
    status: string;

    @Column({ nullable: true, comment: '封面图片' })
    cover: string;

    @ManyToOne(() => User)
    author: User;

    @ManyToOne(() => Category)
    category: Category;

    @ManyToMany(() => Tag)
    @JoinTable()
    tags: Tag[];


    @CreateDateColumn({ comment: '创建时间' })
    createdAt: Date;

    @UpdateDateColumn({ comment: '更新时间' })
    updatedAt: Date;
}
