import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInviteDto } from './dto/create-invite.dto';
import { UseInviteDto } from './dto/use-invite.dto';
import { Invite } from './entities/invite.entity';
import { InviteCommission } from './entities/invite-commission.entity';
import { User } from '../user/entities/user.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ListUtil } from 'src/common/utils';

@Injectable()
export class InviteService {
  constructor(
    @InjectRepository(Invite)
    private inviteRepository: Repository<Invite>,
    @InjectRepository(InviteCommission)
    private inviteCommissionRepository: Repository<InviteCommission>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * 生成邀请码
   */
  private generateInviteCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `INV${timestamp}${random}`.toUpperCase();
  }

  /**
   * 创建邀请
   */
  async createInvite(userId: number, createInviteDto: CreateInviteDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    const inviteCode = this.generateInviteCode();
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/register?invite=${inviteCode}`;

    const inviteData = {
      inviterId: userId,
      inviteCode,
      inviteUrl,
      type: createInviteDto.type || 'GENERAL',
      commissionRate: createInviteDto.commissionRate || 0.05,
      expiredAt: createInviteDto.expiredAt ? new Date(createInviteDto.expiredAt) : null,
      remark: createInviteDto.remark,
    };

    const invite = this.inviteRepository.create(inviteData);
    const savedInvite = await this.inviteRepository.save(invite);
    return {
      success: true,
      message: 'response.success.inviteCreate',
      data: savedInvite,
    };
  }

  /**
   * 使用邀请码（已注册用户补填邀请码）
   */
  async useInvite(
    userId: number,
    useInviteDto: UseInviteDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    // 检查用户是否已经使用过邀请码
    if (user.inviteCode) {
      throw new ConflictException('response.error.inviteCodeAlreadyUsed');
    }

    // 先查找是否是用户的固定邀请码
    const inviter = await this.userRepository.findOne({
      where: { myInviteCode: useInviteDto.inviteCode },
    });

    if (!inviter) {
      // 如果不是固定邀请码，再查找临时邀请码
      const invite = await this.inviteRepository.findOne({
        where: { inviteCode: useInviteDto.inviteCode },
        relations: ['inviter'],
      });

      if (!invite) {
        throw new NotFoundException('response.error.inviteCodeNotExist');
      }

      // 检查邀请码状态
      if (invite.status !== 'PENDING') {
        throw new BadRequestException('response.error.inviteCodeInvalid');
      }

      // 检查是否过期
      if (invite.expiredAt && invite.expiredAt < new Date()) {
        invite.status = 'EXPIRED';
        await this.inviteRepository.save(invite);
        throw new BadRequestException('response.error.inviteCodeExpired');
      }

      // 检查是否自己邀请自己
      if (invite.inviterId === userId) {
        throw new BadRequestException('response.error.cannotUseOwnInviteCode');
      }

      // 更新邀请记录
      invite.inviteeId = userId;
      invite.status = 'USED';
      invite.usedAt = new Date();
      await this.inviteRepository.save(invite);

      // 更新用户信息
      user.inviterId = invite.inviterId;
      user.inviteCode = invite.inviteCode;
      await this.userRepository.save(user);

      // 更新邀请人的邀请数量
      const inviterUser = await this.userRepository.findOne({
        where: { id: invite.inviterId },
      });
      if (inviterUser) {
        inviterUser.inviteCount += 1;
        await this.userRepository.save(inviterUser);
      }
    } else {
      // 使用固定邀请码
      // 检查是否自己邀请自己
      if (inviter.id === userId) {
        throw new BadRequestException('response.error.cannotUseOwnInviteCode');
      }

      // 创建邀请记录
      const invite = this.inviteRepository.create({
        inviterId: inviter.id,
        inviteeId: userId,
        inviteCode: useInviteDto.inviteCode,
        inviteUrl: '',
        type: 'GENERAL',
        commissionRate: 0.05,
        status: 'USED',
        usedAt: new Date(),
      });
      await this.inviteRepository.save(invite);

      // 更新用户信息
      user.inviterId = inviter.id;
      user.inviteCode = useInviteDto.inviteCode;
      await this.userRepository.save(user);

      // 更新邀请人的邀请数量
      inviter.inviteCount += 1;
      await this.userRepository.save(inviter);
    }

    return {
      success: true,
      message: '邀请码使用成功',
    };
  }

  /**
   * 获取我的邀请列表
   */
  async getMyInvites(userId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.inviteRepository.findAndCount({
      where: { inviterId: userId },
      relations: ['invitee'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 获取邀请详情
   */
  async getInviteDetail(userId: number, inviteId: number): Promise<Invite> {
    const invite = await this.inviteRepository.findOne({
      where: { id: inviteId, inviterId: userId },
      relations: ['invitee', 'inviter'],
    });

    if (!invite) {
      throw new NotFoundException('response.error.inviteRecordNotExist');
    }

    return invite;
  }

  /**
   * 处理邀请分成
   */
  async handleInviteCommission(
    orderId: number,
    orderType: string,
    orderAmount: number,
    authorId: number,
    buyerId: number,
  ): Promise<{ success: boolean; commission?: InviteCommission }> {
    // 检查买家是否是通过邀请注册的
    const buyer = await this.userRepository.findOne({
      where: { id: buyerId },
    });

    if (!buyer || !buyer.inviterId) {
      return { success: false };
    }

    // 获取邀请记录
    const invite = await this.inviteRepository.findOne({
      where: {
        inviterId: buyer.inviterId,
        inviteeId: buyerId,
        status: 'USED',
      },
    });

    if (!invite) {
      return { success: false };
    }

    // 计算邀请分成
    const commissionAmount = orderAmount * invite.commissionRate;

    // 创建分成记录
    const inviteCommission = this.inviteCommissionRepository.create({
      inviteId: invite.id,
      inviterId: invite.inviterId,
      inviteeId: buyerId,
      orderId,
      orderType,
      orderAmount,
      commissionRate: invite.commissionRate,
      commissionAmount,
      status: 'PENDING',
    });

    const savedCommission = await this.inviteCommissionRepository.save(inviteCommission);

    // 更新邀请人钱包
    const inviter = await this.userRepository.findOne({
      where: { id: invite.inviterId },
    });
    if (inviter) {
      inviter.wallet += commissionAmount;
      inviter.inviteEarnings += commissionAmount;
      await this.userRepository.save(inviter);
    }

    // 更新分成记录状态
    savedCommission.status = 'PAID';
    savedCommission.paidAt = new Date();
    await this.inviteCommissionRepository.save(savedCommission);

    return {
      success: true,
      commission: savedCommission,
    };
  }

  /**
   * 获取我的邀请收益
   */
  async getMyInviteEarnings(userId: number, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const [data, total] = await this.inviteCommissionRepository.findAndCount({
      where: { inviterId: userId },
      relations: ['invitee', 'order'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return ListUtil.fromFindAndCount([data, total], page, limit);
  }

  /**
   * 获取邀请统计信息
   */
  async getInviteStats(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('response.error.userNotExist');
    }

    // 获取邀请人数
    const inviteCount = await this.inviteRepository.count({
      where: { inviterId: userId, status: 'USED' },
    });

    // 获取总收益
    const totalEarnings = await this.inviteCommissionRepository
      .createQueryBuilder('commission')
      .select('SUM(commission.commissionAmount)', 'total')
      .where('commission.inviterId = :userId', { userId })
      .andWhere('commission.status = :status', { status: 'PAID' })
      .getRawOne();

    // 获取本月收益
    const thisMonthEarnings = await this.inviteCommissionRepository
      .createQueryBuilder('commission')
      .select('SUM(commission.commissionAmount)', 'total')
      .where('commission.inviterId = :userId', { userId })
      .andWhere('commission.status = :status', { status: 'PAID' })
      .andWhere('DATE_FORMAT(commission.createdAt, "%Y-%m") = DATE_FORMAT(NOW(), "%Y-%m")')
      .getRawOne();

    return {
      inviteCount,
      totalEarnings: parseFloat(totalEarnings?.total || '0'),
      thisMonthEarnings: parseFloat(thisMonthEarnings?.total || '0'),
      userInviteEarnings: user.inviteEarnings,
    };
  }
}
