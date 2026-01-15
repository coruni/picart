import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like, In, FindOptions, FindOptionsWhere, Or } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ListUtil, PermissionUtil } from 'src/common/utils';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
  ) { }

  /**
   * 创建分类
   */
  async create(createCategoryDto: CreateCategoryDto) {
    const category = this.categoryRepository.create(createCategoryDto);
    const savedCategory = await this.categoryRepository.save(category);
    return {
      success: true,
      message: 'response.success.categoryCreate',
      data: savedCategory,
    };
  }

  /**
   * 查询所有分类，支持分页和条件筛选
   */
  async findAll(
    pagination: PaginationDto,
    name?: string,
    status?: string,
    parentId?: number,
    currentUser?: User,
  ) {
    const hasPermission =
      currentUser && PermissionUtil.hasPermission(currentUser, "category:manage");

    // 根据 parentId 判断查询主分类还是子分类
    let where: FindOptionsWhere<Category> | FindOptionsWhere<Category>[];

    if (parentId !== undefined && parentId !== null && parentId > 0) {
      // 查询指定父分类的子分类
      where = {
        ...(!hasPermission ? { status: "ENABLED" } : {}),
        ...(name && { name: Like(`%${name}%`) }),
        ...(status && { status: status }),
        parentId: parentId
      };
    } else {
      // 查询主分类 - parentId 为 null 或 0
      where = [
        {
          ...(!hasPermission ? { status: "ENABLED" } : {}),
          ...(name && { name: Like(`%${name}%`) }),
          ...(status && { status: status }),
          parentId: IsNull()
        },
        {
          ...(!hasPermission ? { status: "ENABLED" } : {}),
          ...(name && { name: Like(`%${name}%`) }),
          ...(status && { status: status }),
          parentId: 0
        }
      ];
    }


    const { page, limit } = pagination;

    const [data, total] = await this.categoryRepository.findAndCount({
      where,
      relations: ["children"],
      order: {
        sort: "ASC",
        id: "ASC",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 过滤children，防止循环引用和无效数据
    const filteredData = data.map(category => {
      if (category.children) {
        category.children = category.children.filter(
          child => child && child.id !== category.id && child.parentId === category.id
        );
      }
      return category;
    });

    return ListUtil.buildPaginatedList(filteredData, total, page, limit);
  }

  /**
   * 根据ID查询分类详情
   */
  async findOne(id: number) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'parent'],
      order: {
        children: {
          sort: 'ASC',
          id: 'ASC',
        },
      },
    });

    if (!category) {
      throw new NotFoundException('response.error.categoryNotFound');
    }

    return category;
  }

  /**
   * 更新分类
   */
  async update(id: number, updateCategoryDto: UpdateCategoryDto, currentUser?: User) {
    const category = await this.findOne(id);
    Object.assign(category, updateCategoryDto);
    const updatedCategory = await this.categoryRepository.save(category);
    return {
      success: true,
      message: 'response.success.categoryUpdate',
      data: updatedCategory,
    };
  }

  /**
   * 删除分类
   */
  async remove(id: number) {
    // 先将子分类的父级设置为0（变为主分类）
    await this.categoryRepository.update({ parentId: id }, { parentId: 0 });

    // 再删除该分类
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    return { success: true, message: 'response.success.categoryDelete' };
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
