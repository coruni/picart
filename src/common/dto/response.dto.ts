import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T = any> {
  @ApiProperty({ example: 0, description: '业务状态码' })
  code: number;

  @ApiProperty({ example: '操作成功', description: '提示信息' })
  message: string;

  @ApiProperty({ description: '数据体', required: false })
  data: T;

  @ApiProperty({ example: 1620000000000, description: '时间戳' })
  timestamp: number;

  @ApiProperty({ example: '/api/v1/article', description: '路径' })
  path?: string;
}

export class PaginatedResponseDto<T = any> {
  @ApiProperty({ example: 0, description: '业务状态码' })
  code: number;

  @ApiProperty({ example: '操作成功', description: '提示信息' })
  message: string;

  @ApiProperty({ description: '数据列表' })
  data: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export class ListResponseDto<T = any> {
  @ApiProperty({ example: 0, description: '业务状态码' })
  code: number;

  @ApiProperty({ example: '操作成功', description: '提示信息' })
  message: string;

  @ApiProperty({ type: [Object], description: '数据列表' })
  data: T[];

  @ApiProperty({ example: 1620000000000, description: '时间戳' })
  timestamp: number;
}
