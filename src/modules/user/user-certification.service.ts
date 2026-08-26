import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsSelect, FindOptionsWhere, In, Repository } from "typeorm";
import { UserCertification } from "./entities/user-certification.entity";
import { ApplyCertificationDto } from "./dto/apply-certification.dto";
import { AuditCertificationDto } from "./dto/audit-certification.dto";
import { PaginationDto } from "src/common/dto/pagination.dto";
import {
  BusinessException,
  ConflictBusinessException,
  NotFoundBusinessException,
} from "src/common/exceptions/business.exception";
import {
  USER_CERTIFICATION_CONSTANTS,
  UserCertificationStatus,
  UserCertificationType,
} from "src/common/constants";

/**
 * 对外公开展示的认证徽章信息（仅包含非敏感字段）：
 * 不会暴露真实姓名、机构资料、证明材料、审核人、审核意见等敏感内容
 */
export type PublicCertificationBadge = {
  type: UserCertificationType;
  slogan: string | null;
  certifiedAt: Date | null;
};

@Injectable()
export class UserCertificationService {
  constructor(
    @InjectRepository(UserCertification)
    private readonly certificationRepository: Repository<UserCertification>,
  ) {}

  /**
   * 用户申请认证（官方/创作者）
   * 同一用户同一时间只能存在一个待审核或已通过的认证
   */
  async apply(
    userId: number,
    dto: ApplyCertificationDto,
  ): Promise<UserCertification> {
    const active = await this.certificationRepository.findOne({
      where: [
        { userId, status: USER_CERTIFICATION_CONSTANTS.STATUS.PENDING },
        { userId, status: USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED },
      ],
    });

    if (active) {
      if (active.status === USER_CERTIFICATION_CONSTANTS.STATUS.PENDING) {
        throw new ConflictBusinessException(
          "已有待审核的认证申请，请等待审核结果",
        );
      }
      throw new ConflictBusinessException("您已通过认证，无需重复申请");
    }

    // 官方认证必须填写机构名称
    if (
      dto.type === USER_CERTIFICATION_CONSTANTS.TYPE.OFFICIAL &&
      !dto.organizationName?.trim()
    ) {
      throw new BusinessException("官方认证必须填写机构名称");
    }

    const certification = this.certificationRepository.create({
      userId,
      ...dto,
      status: USER_CERTIFICATION_CONSTANTS.STATUS.PENDING,
      // 未填写标语时使用默认标语
      slogan:
        dto.slogan?.trim() ||
        (dto.type === USER_CERTIFICATION_CONSTANTS.TYPE.OFFICIAL
          ? "官方认证"
          : "创作者认证"),
    });
    return this.certificationRepository.save(certification);
  }

  /** 获取用户的认证记录列表（最新在前） */
  getMyCertifications(userId: number): Promise<UserCertification[]> {
    return this.certificationRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * 获取单个用户可公开展示的认证徽章（仅已通过的认证）
   * 未认证或非 APPROVED 时返回 null
   */
  async getPublicCertification(
    userId: number,
  ): Promise<PublicCertificationBadge | null> {
    const approved = await this.certificationRepository.findOne({
      where: { userId, status: USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED },
      order: { updatedAt: "DESC" },
    });
    return this.toPublicBadge(approved);
  }

  /**
   * 批量获取多个用户可公开展示的认证徽章
   * @returns Map<userId, PublicCertificationBadge>，无认证的用户不在 Map 中
   */
  async getPublicCertifications(
    userIds: number[],
  ): Promise<Map<number, PublicCertificationBadge>> {
    const badgeMap = new Map<number, PublicCertificationBadge>();
    if (!userIds || userIds.length === 0) {
      return badgeMap;
    }

    const uniqueIds = Array.from(new Set(userIds));
    const approvedList = await this.certificationRepository.find({
      where: {
        userId: In(uniqueIds),
        status: USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED,
      },
      order: { updatedAt: "DESC" },
    });

    // 同一用户仅保留最新一条已通过认证
    for (const certification of approvedList) {
      if (!badgeMap.has(certification.userId)) {
        badgeMap.set(certification.userId, this.toPublicBadge(certification)!);
      }
    }
    return badgeMap;
  }

  /** 转换为仅含非敏感字段的公开展示徽章 */
  private toPublicBadge(
    certification: UserCertification | null,
  ): PublicCertificationBadge | null {
    if (!certification) {
      return null;
    }
    return {
      type: certification.type,
      slogan: certification.slogan ?? null,
      certifiedAt: certification.reviewedAt ?? null,
    };
  }

  /**
   * 获取单个用户最新的一条认证记录（任意状态，含敏感字段）
   * 仅限管理员内部使用，勿用于对外接口
   */
  async getLatestCertification(
    userId: number,
  ): Promise<UserCertification | null> {
    return this.certificationRepository.findOne({
      where: { userId },
      order: { updatedAt: "DESC" },
    });
  }

  /**
   * 批量获取多个用户各自最新的一条认证记录（任意状态，含敏感字段）
   * 仅限管理员内部使用，勿用于对外接口
   */
  async getLatestCertifications(
    userIds: number[],
  ): Promise<Map<number, UserCertification>> {
    const certificationMap = new Map<number, UserCertification>();
    if (!userIds || userIds.length === 0) {
      return certificationMap;
    }

    const uniqueIds = Array.from(new Set(userIds));
    const records = await this.certificationRepository
      .createQueryBuilder("certification")
      .where("certification.userId IN (:...userIds)", {
        userIds: uniqueIds,
      })
      .orderBy("certification.updatedAt", "DESC")
      .getMany();

    // 同一用户仅保留最新一条记录
    for (const certification of records) {
      if (!certificationMap.has(certification.userId)) {
        certificationMap.set(certification.userId, certification);
      }
    }
    return certificationMap;
  }

  /**
   * 解析用户认证身份：官方(OFFICIAL) / 创作者(CREATOR) / 普通用户(USER)
   * 返回的信息均为可公开展示的非敏感字段，不包含真实姓名、证明材料、
   * 审核人等敏感内容
   */
  async getIdentity(
    userId: number,
  ): Promise<{ type: string; certification?: PublicCertificationBadge }> {
    const badge = await this.getPublicCertification(userId);
    if (!badge) {
      return { type: "USER" };
    }
    return { type: badge.type, certification: badge };
  }

  /** 管理员：分页查询认证申请列表 */
  async findApplications(
    pagination: PaginationDto,
    filter?: { status?: string; type?: string },
  ) {
    const where: FindOptionsWhere<UserCertification> = {};
    if (filter?.status) {
      where.status = filter.status as UserCertificationStatus;
    }
    if (filter?.type) {
      where.type = filter.type as UserCertificationType;
    }

    const [items, total] = await this.certificationRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  /**
   * 管理员：审核认证申请
   * 通过后自动撤销该用户其他已通过的认证，确保同一时刻仅一种身份
   */
  async audit(
    certificationId: number,
    reviewerId: number,
    dto: AuditCertificationDto,
  ): Promise<UserCertification> {
    const certification = await this.certificationRepository.findOne({
      where: { id: certificationId },
    });
    if (!certification) {
      throw new NotFoundBusinessException("认证申请不存在");
    }
    if (certification.status !== USER_CERTIFICATION_CONSTANTS.STATUS.PENDING) {
      throw new BusinessException("该认证申请已审核，不能重复操作");
    }

    if (dto.status === USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED) {
      // 撤销该用户其他已通过的认证
      await this.certificationRepository.update(
        {
          userId: certification.userId,
          status: USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED,
        },
        {
          status: USER_CERTIFICATION_CONSTANTS.STATUS.REVOKED,
          reviewerId,
          reviewReason: "新的认证通过后自动撤销旧认证",
          reviewedAt: new Date(),
        },
      );
      certification.status = USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED;
      certification.reviewReason = dto.reason ?? null;
    } else {
      certification.status = USER_CERTIFICATION_CONSTANTS.STATUS.REJECTED;
      certification.reviewReason = dto.reason ?? "未通过审核";
    }

    certification.reviewerId = reviewerId;
    certification.reviewedAt = new Date();
    return this.certificationRepository.save(certification);
  }

  /** 管理员：撤销已通过的认证 */
  async revoke(
    certificationId: number,
    reviewerId: number,
    reason?: string,
  ): Promise<UserCertification> {
    const certification = await this.certificationRepository.findOne({
      where: { id: certificationId },
    });
    if (!certification) {
      throw new NotFoundBusinessException("认证申请不存在");
    }
    if (certification.status !== USER_CERTIFICATION_CONSTANTS.STATUS.APPROVED) {
      throw new BusinessException("仅可撤销已通过的认证");
    }

    certification.status = USER_CERTIFICATION_CONSTANTS.STATUS.REVOKED;
    certification.reviewerId = reviewerId;
    certification.reviewReason = reason ?? "管理员撤销认证";
    certification.reviewedAt = new Date();
    return this.certificationRepository.save(certification);
  }
}
