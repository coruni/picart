import { ApiProperty } from "@nestjs/swagger";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class AuditCertificationDto {
  @ApiProperty({
    description: "审核结果：APPROVED-通过，REJECTED-拒绝",
    enum: ["APPROVED", "REJECTED"],
  })
  @IsNotEmpty({ message: "审核结果不能为空" })
  @IsIn(["APPROVED", "REJECTED"], {
    message: "审核结果必须是 APPROVED（通过）或 REJECTED（拒绝）",
  })
  status: "APPROVED" | "REJECTED";

  @ApiProperty({
    description: "审核意见/拒绝原因（拒绝时建议填写）",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "审核意见必须是字符串" })
  @MaxLength(500, { message: "审核意见长度不能超过500个字符" })
  reason?: string;
}
