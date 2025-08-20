import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';
import { DownloadType } from '../entities/download.entity';

export class DownloadDto {
  @ApiProperty({ 
    description: '下载类型', 
    enum: DownloadType,
    example: DownloadType.BAIDU 
  })
  @IsEnum(DownloadType, { message: '下载类型必须是有效的枚举值' })
  type: DownloadType;

  @ApiProperty({ description: '下载链接', example: 'https://pan.baidu.com/s/1ABC123DEF456' })
  @IsUrl({}, { message: '下载链接必须是有效的URL格式' })
  url: string;

  @ApiProperty({ description: '提取密码', example: '123456', required: false })
  @IsOptional()
  @IsString({ message: '提取密码必须是字符串' })
  password?: string;

  @ApiProperty({ description: '提取码', example: '1234', required: false })
  @IsOptional()
  @IsString({ message: '提取码必须是字符串' })
  extractionCode?: string;
}
