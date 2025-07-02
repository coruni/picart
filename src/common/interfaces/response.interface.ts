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