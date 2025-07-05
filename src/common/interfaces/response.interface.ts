// 基础响应接口
export interface BaseResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

// 分页响应接口
export interface PaginatedResponse<T = any> {
  code: number;
  message: string;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: number;
}

// 列表响应接口（不分页）
export interface ListResponse<T = any> {
  code: number;
  message: string;
  data: T[];
  timestamp: number;
}

// 嵌套分页响应接口
export interface NestedPaginatedResponse<T = any> {
  code: number;
  message: string;
  data: {
    item: T;
    nestedList?: {
      data: any[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  };
  timestamp: number;
}

// 成功响应接口
export interface SuccessResponse<T = any> extends BaseResponse<T> {
  code: 200;
  message: 'success';
}

// 错误响应接口
export interface ErrorResponse extends BaseResponse<null> {
  code: number;
  message: string;
  data: null;
}

// 分页元数据接口
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 统一列表返回数据体
export interface ListResult<T = any> {
  data: T[];
  meta?: PaginationMeta;
}

// 嵌套列表返回数据体
export interface NestedListResult<T = any, N = any> {
  item: T;
  nestedList?: {
    data: N[];
    meta: PaginationMeta;
  };
}
