import { NotFoundException } from '@nestjs/common';
import { Repository, FindManyOptions, FindOneOptions, DeepPartial } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { User } from '../../modules/user/entities/user.entity';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BaseEntity {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export abstract class BaseService<T extends BaseEntity> {
  protected constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
  ) {}

  /**
   * 创建实体
   */
  async create(createDto: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(createDto);
    return await this.repository.save(entity);
  }

  /**
   * 分页查询所有实体
   */
  async findAll(
    pagination: PaginationDto,
    options?: FindManyOptions<T>,
  ): Promise<PaginatedResult<T>> {
    const { page, limit } = pagination;

    const findOptions: FindManyOptions<T> = {
      ...options,
      skip: (page - 1) * limit,
      take: limit,
      order: options?.order || ({ createdAt: 'DESC' } as any),
    };

    const [data, total] = await this.repository.findAndCount(findOptions);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 根据ID查询单个实体
   */
  async findOne(id: number, options?: FindOneOptions<T>): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id } as any,
      ...options,
    });

    if (!entity) {
      throw new NotFoundException(`${this.entityName}不存在`);
    }

    return entity;
  }

  /**
   * 根据条件查询单个实体
   */
  async findOneBy(options: FindOneOptions<T>): Promise<T | null> {
    return await this.repository.findOne(options);
  }

  /**
   * 检查实体是否存在
   */
  async exists(id: number): Promise<boolean> {
    const count = await this.repository.count({ where: { id } as any });
    return count > 0;
  }

  /**
   * 更新实体
   */
  async update(id: number, updateDto: DeepPartial<T>, currentUser?: User): Promise<T> {
    const entity = await this.findOne(id);
    Object.assign(entity, updateDto);
    return await this.repository.save(entity);
  }

  /**
   * 删除实体
   */
  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }

  /**
   * 软删除实体（如果实体支持软删除）
   */
  async softRemove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.softRemove(entity);
  }

  /**
   * 获取实体总数
   */
  async count(options?: FindManyOptions<T>): Promise<number> {
    return await this.repository.count(options);
  }

  /**
   * 批量创建实体
   */
  async createMany(createDtos: DeepPartial<T>[]): Promise<T[]> {
    const entities = this.repository.create(createDtos);
    return await this.repository.save(entities);
  }

  /**
   * 批量删除实体
   */
  async removeMany(ids: number[]): Promise<void> {
    await this.repository.delete(ids);
  }

  /**
   * 根据条件查询多个实体
   */
  async findBy(options: FindManyOptions<T>): Promise<T[]> {
    return await this.repository.find(options);
  }

  /**
   * 保存实体（创建或更新）
   */
  async save(entity: DeepPartial<T>): Promise<T> {
    return await this.repository.save(entity);
  }
}
