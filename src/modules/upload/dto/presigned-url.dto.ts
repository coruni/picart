import { IsString, IsNumber, IsNotEmpty, IsOptional, IsIn, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

  @ApiPropertyOptional({
    description:
      "上传场景；调用 /upload/confirm 时也需要传相同值。头像传 avatar，不会添加水印",
    enum: ["avatar", "image", "other"],
    default: "image",
  })
  @IsOptional()
  @IsIn(["avatar", "image", "other"], {
    message: "scene 必须是 avatar、image 或 other",
  })
  scene?: string;
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
