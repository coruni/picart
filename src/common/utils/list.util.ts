import { PaginationMeta, ListResult, NestedListResult } from '../interfaces/response.interface';

/**
 * 列表返回工具类
 * 提供统一的列表数据构建方法，保持解耦
 */
export class ListUtil {
  /**
   * 构建分页列表结果
   * @param data 数据列表
   * @param total 总数
   * @param page 当前页
   * @param limit 每页数量
   * @returns 分页列表结果
   */
  static buildPaginatedList<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): ListResult<T> {
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
   * 构建简单列表结果（不分页）
   * @param data 数据列表
   * @returns 简单列表结果
   */
  static buildSimpleList<T>(data: T[]): ListResult<T> {
    return {
      data,
    };
  }

  /**
   * 构建嵌套分页列表结果
   * @param item 主项目
   * @param nestedData 嵌套数据列表
   * @param nestedTotal 嵌套数据总数
   * @param nestedPage 嵌套数据当前页
   * @param nestedLimit 嵌套数据每页数量
   * @returns 嵌套分页列表结果
   */
  static buildNestedList<T, N>(
    item: T,
    nestedData?: N[],
    nestedTotal?: number,
    nestedPage?: number,
    nestedLimit?: number,
  ): NestedListResult<T, N> {
    const result: NestedListResult<T, N> = {
      item,
    };

    if (
      nestedData &&
      nestedTotal !== undefined &&
      nestedPage !== undefined &&
      nestedLimit !== undefined
    ) {
      result.nestedList = {
        data: nestedData,
        meta: {
          total: nestedTotal,
          page: nestedPage,
          limit: nestedLimit,
          totalPages: Math.ceil(nestedTotal / nestedLimit),
        },
      };
    }

    return result;
  }

  /**
   * 构建分页元数据
   * @param total 总数
   * @param page 当前页
   * @param limit 每页数量
   * @returns 分页元数据
   */
  static buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 从 TypeORM 的 findAndCount 结果构建分页列表
   * @param result TypeORM findAndCount 结果 [data, total]
   * @param page 当前页
   * @param limit 每页数量
   * @returns 分页列表结果
   */
  static fromFindAndCount<T>(result: [T[], number], page: number, limit: number): ListResult<T> {
    const [data, total] = result;
    return this.buildPaginatedList(data, total, page, limit);
  }
}
