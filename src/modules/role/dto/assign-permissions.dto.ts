import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({
    description: '权限ID列表',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsNotEmpty({ message: '权限ID列表不能为空' })
  @IsArray({ message: '权限ID列表必须是数组' })
  @IsNumber({}, { message: '权限ID必须是数字', each: true })
  permissionIds: number[];
}
