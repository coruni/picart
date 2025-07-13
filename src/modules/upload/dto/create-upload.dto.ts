import { IsString, IsOptional } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  @IsOptional()
  originalName?: string;

  @IsString()
  @IsOptional()
  hash?: string;
}
