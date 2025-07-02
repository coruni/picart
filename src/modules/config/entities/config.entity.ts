import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Config {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        comment: '键',
        unique: true
    })
    key: string;

    @Column({
        comment: '值',
        nullable: true
    })
    value: string;

    @Column({
        comment: '描述',
        nullable: true
    })
    description: string;

    @Column({
        comment: '类型',
        default: 'string'
    })
    type: string;

    @Column({
        comment: '分组',
        default: 'system'
    })
    group: string;

}
