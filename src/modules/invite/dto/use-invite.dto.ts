import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UseInviteDto {
  @ApiProperty({ description: '邀请码', example: 'INV123456' })
  @IsString()
  @IsNotEmpty()
  inviteCode: string;
} 