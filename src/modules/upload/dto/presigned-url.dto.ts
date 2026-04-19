import { IsString, IsNumber, IsNotEmpty, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class PresignedUrlDto {
  @ApiProperty({ description: "文件名", example: "video.mp4" })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: "MIME 类型", example: "video/mp4" })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiProperty({ description: "文件大小（字节）", example: 104857600 })
  @IsNumber()
  @Min(1)
  size: number;
}

export class PresignedUrlResponseDto {
  @ApiProperty({ description: "预签名上传URL（前端使用）", example: "https://s3.amazonaws.com/..." })
  uploadUrl: string;

  @ApiProperty({ description: "访问URL（上传后可用）", example: "https://cdn.example.com/..." })
  accessUrl: string;

  @ApiProperty({ description: "S3 Key", example: "uploads/2024/01/01/uuid.mp4" })
  key: string;

  @ApiProperty({ description: "URL过期时间（秒）", example: 300 })
  expiresIn: number;
}
