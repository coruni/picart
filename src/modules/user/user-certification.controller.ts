import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { UserCertificationService } from "./user-certification.service";
import { ApplyCertificationDto } from "./dto/apply-certification.dto";
import { AuditCertificationDto } from "./dto/audit-certification.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { PermissionGuard } from "src/common/guards/permission.guard";
import { Permissions } from "src/common/decorators/permissions.decorator";
import { NoAuth } from "src/common/decorators/no-auth.decorator";
import { USER_CERTIFICATION_CONSTANTS } from "src/common/constants";
import { User } from "./entities/user.entity";

@Controller("user/certification")
@ApiTags("用户认证")
@ApiBearerAuth()
export class UserCertificationController {
  constructor(
    private readonly userCertificationService: UserCertificationService,
  ) {}

  @Post("apply")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "申请认证（官方/创作者）" })
  @ApiBody({ type: ApplyCertificationDto })
  @ApiResponse({ status: 201, description: "申请成功，等待审核" })
  @ApiResponse({ status: 409, description: "已有待审核或已通过的认证" })
  async apply(
    @Req() req: Request & { user: User },
    @Body() dto: ApplyCertificationDto,
  ) {
    return this.userCertificationService.apply(req.user.id, dto);
  }

  // @Get("me")
  // @UseGuards(JwtAuthGuard)
  // @ApiOperation({
  //   summary: "获取我当前最新的认证记录（含申请状态，仅供本人查看）",
  // })
  // @ApiResponse({ status: 200, description: "获取成功，无认证记录时返回 null" })
  // async getMyCertification(@Req() req: Request & { user: User }) {
  //   return this.userCertificationService.getLatestCertification(req.user.id);
  // }

  @Get("identity")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "获取当前用户的认证身份（官方/创作者/普通用户）" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getMyIdentity(@Req() req: Request & { user: User }) {
    return this.userCertificationService.getIdentity(req.user.id);
  }

  @Get("identity/:userId")
  @UseGuards(JwtAuthGuard)
  @NoAuth()
  @ApiOperation({ summary: "查询指定用户的认证身份（官方/创作者/普通用户）" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getIdentityByUserId(@Param("userId", ParseIntPipe) userId: number) {
    return this.userCertificationService.getIdentity(userId);
  }

  // =======================================================================
  // 管理员接口
  // =======================================================================

  @Get("admin/applications")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions(USER_CERTIFICATION_CONSTANTS.PERMISSION)
  @ApiOperation({ summary: "管理员：分页查询认证申请列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async findApplications(
    @Query() pagination: PaginationDto,
    @Query("status") status?: string,
    @Query("type") type?: string,
  ) {
    return this.userCertificationService.findApplications(pagination, {
      status,
      type,
    });
  }

  @Patch("admin/applications/:id/audit")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions(USER_CERTIFICATION_CONSTANTS.PERMISSION)
  @ApiOperation({ summary: "管理员：审核认证申请（通过/拒绝）" })
  @ApiBody({ type: AuditCertificationDto })
  @ApiResponse({ status: 200, description: "审核完成" })
  async audit(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
    @Body() dto: AuditCertificationDto,
  ) {
    return this.userCertificationService.audit(id, req.user.id, dto);
  }

  @Post("admin/applications/:id/revoke")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permissions(USER_CERTIFICATION_CONSTANTS.PERMISSION)
  @ApiOperation({ summary: "管理员：撤销已通过的认证" })
  @ApiResponse({ status: 200, description: "撤销成功" })
  async revoke(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user: User },
    @Body("reason") reason?: string,
  ) {
    return this.userCertificationService.revoke(id, req.user.id, reason);
  }
}
