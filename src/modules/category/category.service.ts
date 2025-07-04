import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { BaseService, PaginatedResult } from 'src/common/services/base.service';
import { User } from '../user/entities/user.entity';

@Injectable()
export class CategoryService extends BaseService<Category> {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {
    super(categoryRepository, '分类');
  }

  /**
   * 创建分类
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    return await super.create(createCategoryDto);
  }

  /**
   * 查询所有主分类及其子分类，支持分页
   */
  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Category>> {
    const { page, limit } = pagination;

    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.children', 'children')
      .where(
        'category.parentId = 0 OR category.parentId IS NULL OR category.parentId = category.id',
      )
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('category.id', 'ASC');

    const [mainCategories, total] = await qb.getManyAndCount();

    // 过滤children中的主分类，只保留真正的子分类
    const filteredData = mainCategories.map(cat => ({
      ...cat,
      children: Array.isArray(cat.children)
        ? cat.children.filter(
            child => child.parentId !== 0 && child.parentId !== null && child.parentId !== child.id,
          )
        : [],
    }));

    return {
      data: filteredData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 根据ID查询分类详情
   */
  async findOne(id: number): Promise<Category> {
    const category = await super.findOne(id, {
      relations: ['children'],
    });

    // 过滤children中的主分类，只保留真正的子分类
    category.children = category.children.filter(child => child.parentId !== child.id);

    return category;
  }

  /**
   * 更新分类
   */
  async update(id: number, updateCategoryDto: UpdateCategoryDto, currentUser?: User): Promise<Category> {
    return await super.update(id, updateCategoryDto, currentUser);
  }

  /**
   * 删除分类
   */
  async remove(id: number): Promise<void> {
    // 先将子分类的父级设置为0（变为主分类）
    await this.categoryRepository.update({ parentId: id }, { parentId: 0 });

    // 再删除该分类
    await super.remove(id);
  }

  /**
   * 获取所有主分类
   */
  async findMainCategories(): Promise<Category[]> {
    return await this.findBy({
      where: [{ parentId: 0 }, { parentId: IsNull() }],
      order: {
        sort: 'ASC',
        id: 'ASC',
      },
    });
  }

  /**
   * 获取指定分类的子分类
   */
  async findSubCategories(parentId: number): Promise<Category[]> {
    return await this.findBy({
      where: { parentId },
      order: {
        sort: 'ASC',
        id: 'ASC',
      },
    });
  }

  /**
   * 获取分类树结构
   */
  async getCategoryTree(): Promise<Category[]> {
    const mainCategories = await this.findMainCategories();

    // 为每个主分类加载子分类
    const categoryTree = await Promise.all(
      mainCategories.map(async category => {
        const children = await this.findSubCategories(category.id);
        return {
          ...category,
          children,
        };
      }),
    );

    return categoryTree;
  }

  /**
   * 检查分类是否有子分类
   */
  async hasChildren(id: number): Promise<boolean> {
    const count = await this.count({
      where: { parentId: id },
    });
    return count > 0;
  }

  /**
   * 获取分类的文章数量
   */
  async getArticleCount(id: number): Promise<number> {
    const category = await this.findOne(id);
    return category.articleCount || 0;
  }

  /**
   * 增加分类的文章数量
   */
  async incrementArticleCount(id: number): Promise<Category> {
    const category = await this.findOne(id);
    category.articleCount = (category.articleCount || 0) + 1;
    return await this.save(category);
  }

  /**
   * 减少分类的文章数量
   */
  async decrementArticleCount(id: number): Promise<Category> {
    const category = await this.findOne(id);
    if (category.articleCount && category.articleCount > 0) {
      category.articleCount -= 1;
      return await this.save(category);
    }
    return category;
  }
}
