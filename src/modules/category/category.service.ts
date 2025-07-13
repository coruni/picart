import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ListUtil } from 'src/common/utils';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) {}

  /**
   * 创建分类
   */
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(createCategoryDto);
    return await this.categoryRepository.save(category);
  }

  /**
   * 查询所有主分类及其子分类，支持分页
   */
  async findAll(pagination: PaginationDto) {
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
    const filteredData = mainCategories.map((cat) => ({
      ...cat,
      children: Array.isArray(cat.children)
        ? cat.children.filter(
            (child) =>
              child.parentId !== 0 && child.parentId !== null && child.parentId !== child.id,
          )
        : [],
    }));

    return ListUtil.buildPaginatedList(filteredData, total, page, limit);
  }

  /**
   * 根据ID查询分类详情
   */
  async findOne(id: number) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children'],
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    // 过滤children中的主分类，只保留真正的子分类
    category.children = category.children.filter((child) => child.parentId !== child.id);

    return category;
  }

  /**
   * 更新分类
   */
  async update(id: number, updateCategoryDto: UpdateCategoryDto, currentUser?: User) {
    const category = await this.findOne(id);
    Object.assign(category, updateCategoryDto);
    return await this.categoryRepository.save(category);
  }

  /**
   * 删除分类
   */
  async remove(id: number): Promise<void> {
    // 先将子分类的父级设置为0（变为主分类）
    await this.categoryRepository.update({ parentId: id }, { parentId: 0 });

    // 再删除该分类
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
  }

  /**
   * 获取所有主分类
   */
  async findMainCategories() {
    return await this.categoryRepository.find({
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
  async findSubCategories(parentId: number) {
    return await this.categoryRepository.find({
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
  async getCategoryTree() {
    const mainCategories = await this.findMainCategories();

    // 为每个主分类加载子分类
    const categoryTree = await Promise.all(
      mainCategories.map(async (category) => {
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
  async hasChildren(id: number) {
    const count = await this.categoryRepository.count({
      where: { parentId: id },
    });
    return count > 0;
  }

  /**
   * 获取分类的文章数量
   */
  async getArticleCount(id: number) {
    const category = await this.findOne(id);
    return category.articleCount || 0;
  }

  /**
   * 增加分类的文章数量
   */
  async incrementArticleCount(id: number) {
    const category = await this.findOne(id);
    category.articleCount = (category.articleCount || 0) + 1;
    return await this.categoryRepository.save(category);
  }

  /**
   * 减少分类的文章数量
   */
  async decrementArticleCount(id: number) {
    const category = await this.findOne(id);
    if (category.articleCount && category.articleCount > 0) {
      category.articleCount -= 1;
      return await this.categoryRepository.save(category);
    }
    return category;
  }
}
