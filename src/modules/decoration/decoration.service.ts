import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Decoration } from './entities/decoration.entity';
import { UserDecoration } from './entities/user-decoration.entity';
import { DecorationActivity } from './entities/decoration-activity.entity';
import { UserActivityProgress } from './entities/user-activity-progress.entity';
import { WalletService } from '../user/wallet.service';
import { CreateDecorationDto } from './dto/create-decoration.dto';
import { PurchaseDecorationDto } from './dto/purchase-decoration.dto';
import { GiftDecorationDto } from './dto/gift-decoration.dto';

@Injectable()
export class DecorationService {
  constructor(
    @InjectRepository(Decoration)
    private decorationRepository: Repository<Decoration>,
    @InjectRepository(UserDecoration)
    private userDecorationRepository: Repository<UserDecoration>,
    @InjectRepository(DecorationActivity)
    private activityRepository: Repository<DecorationActivity>,
    @InjectRepository(UserActivityProgress)
    private progressRepository: Repository<UserActivityProgress>,
    private walletService: WalletService,
  ) {}

  /**
   * 创建装饰品
   */
  async create(createDecorationDto: CreateDecorationDto) {
    const decoration = this.decorationRepository.create(createDecorationDto);
    return await this.decorationRepository.save(decoration);
  }

  /**
   * 获取装饰品列表（包含用户拥有状态）
   */
  async findAll(userId?: number, type?: string, status?: string) {
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const decorations = await this.decorationRepository.find({
      where,
      order: { sort: 'DESC', createdAt: 'DESC' },
    });

    if (!userId) {
      return decorations.map(decoration => ({
        ...decoration,
        isOwned: false,
        canDirectEquip: decoration.obtainMethod === 'DEFAULT' && Number(decoration.price) === 0,
      }));
    }

    // 获取用户拥有的装饰品
    const userDecorations = await this.userDecorationRepository.find({
      where: { userId },
    });

    const userDecorationMap = new Map(
      userDecorations.map(ud => [ud.decorationId, ud])
    );

    return decorations.map(decoration => {
      const userDecoration = userDecorationMap.get(decoration.id);
      const isOwned = userDecoration && (
        userDecoration.isPermanent || 
        (userDecoration.expiresAt && userDecoration.expiresAt > new Date())
      );

      return {
        ...decoration,
        isOwned: !!isOwned,
        isUsing: userDecoration?.isUsing || false,
        canDirectEquip: !isOwned && decoration.obtainMethod === 'DEFAULT' && Number(decoration.price) === 0,
        expiresAt: userDecoration?.expiresAt,
        isPermanent: userDecoration?.isPermanent,
      };
    });
  }

  /**
   * 获取装饰品基本信息（内部使用）
   */
  private async getDecoration(id: number) {
    const decoration = await this.decorationRepository.findOne({
      where: { id },
    });

    if (!decoration) {
      throw new NotFoundException('装饰品不存在');
    }

    return decoration;
  }

  /**
   * 获取装饰品详情（包含用户拥有状态）
   */
  async findOne(id: number, userId?: number) {
    const decoration = await this.getDecoration(id);

    // 如果没有提供 userId，只返回装饰品基本信息
    if (!userId) {
      return {
        ...decoration,
        isOwned: false,
        isUsing: false,
        canDirectEquip: decoration.obtainMethod === 'DEFAULT' && Number(decoration.price) === 0,
      };
    }

    // 查询用户是否拥有该装饰品
    const userDecoration = await this.userDecorationRepository.findOne({
      where: { userId, decorationId: id },
    });

    const isOwned = userDecoration && (
      userDecoration.isPermanent || 
      (userDecoration.expiresAt && userDecoration.expiresAt > new Date())
    );

    return {
      ...decoration,
      isOwned: !!isOwned,
      isUsing: userDecoration?.isUsing || false,
      canDirectEquip: !isOwned && decoration.obtainMethod === 'DEFAULT' && Number(decoration.price) === 0,
      expiresAt: userDecoration?.expiresAt,
      isPermanent: userDecoration?.isPermanent,
      obtainedAt: userDecoration?.createdAt,
    };
  }

  /**
   * 更新装饰品
   */
  async update(id: number, updateDecorationDto: Partial<CreateDecorationDto>) {
    const decoration = await this.getDecoration(id);
    Object.assign(decoration, updateDecorationDto);
    return await this.decorationRepository.save(decoration);
  }

  /**
   * 删除装饰品
   */
  async remove(id: number) {
    const decoration = await this.getDecoration(id);
    await this.decorationRepository.remove(decoration);
    return { message: '删除成功' };
  }

  /**
   * 购买装饰品
   */
  async purchase(userId: number, purchaseDto: PurchaseDecorationDto) {
    const { decorationId } = purchaseDto;

    // 查找装饰品
    const decoration = await this.getDecoration(decorationId);

    if (!decoration.isPurchasable) {
      throw new BadRequestException('该装饰品不可购买');
    }

    if (decoration.status !== 'ACTIVE') {
      throw new BadRequestException('该装饰品已下架');
    }

    // 检查用户是否已拥有
    const existing = await this.userDecorationRepository.findOne({
      where: { userId, decorationId },
    });

    if (existing && (existing.isPermanent || (existing.expiresAt && existing.expiresAt > new Date()))) {
      throw new BadRequestException('您已拥有该装饰品');
    }

    // 使用钱包服务扣除余额（带事务）
    const { transaction } = await this.walletService.deductBalance(
      userId,
      decoration.price,
      'PAYMENT',
      `购买装饰品：${decoration.name}`,
      undefined,
      undefined,
      `购买${decoration.type === 'AVATAR_FRAME' ? '头像框' : '评论气泡'}`,
    );

    // 计算过期时间
    let expiresAt: Date | undefined = undefined;
    if (!decoration.isPermanent && decoration.validDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + decoration.validDays);
    }

    // 如果已存在但过期，更新记录
    if (existing) {
      existing.isPermanent = decoration.isPermanent;
      existing.expiresAt = expiresAt ?? null;
      existing.obtainMethod = 'PURCHASE';
      existing.orderId = null;
      await this.userDecorationRepository.save(existing);
      return {
        success: true,
        message: '购买成功',
        data: existing,
      };
    }

    // 创建用户装饰品记录
    const userDecoration = new UserDecoration();
    userDecoration.userId = userId;
    userDecoration.decorationId = decorationId;
    userDecoration.obtainMethod = 'PURCHASE';
    userDecoration.isPermanent = decoration.isPermanent;
    userDecoration.expiresAt = expiresAt ?? null;
    userDecoration.orderId = null;

    const saved = await this.userDecorationRepository.save(userDecoration);

    return {
      success: true,
      message: '购买成功',
      data: saved,
    };
  }

  /**
   * 赠送装饰品
   */
  async gift(fromUserId: number, giftDto: GiftDecorationDto) {
    const { toUserId, decorationId, message } = giftDto;

    // 检查赠送者是否拥有该装饰品
    const fromUserDecoration = await this.userDecorationRepository.findOne({
      where: { userId: fromUserId, decorationId },
    });

    if (!fromUserDecoration) {
      throw new BadRequestException('您没有该装饰品');
    }

    if (!fromUserDecoration.isPermanent && fromUserDecoration.expiresAt && fromUserDecoration.expiresAt <= new Date()) {
      throw new BadRequestException('该装饰品已过期');
    }

    // 查找装饰品
    const decoration = await this.getDecoration(decorationId);

    // 检查接收者是否已拥有
    const existing = await this.userDecorationRepository.findOne({
      where: { userId: toUserId, decorationId },
    });

    if (existing && (existing.isPermanent || (existing.expiresAt && existing.expiresAt > new Date()))) {
      throw new BadRequestException('对方已拥有该装饰品');
    }

    // 计算过期时间（赠送的装饰品有效期与原装饰品相同）
    let expiresAt: Date | undefined = undefined;
    if (!decoration.isPermanent && decoration.validDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + decoration.validDays);
    }

    // 如果已存在但过期，更新记录
    if (existing) {
      existing.isPermanent = decoration.isPermanent;
      existing.expiresAt = expiresAt ?? null;
      existing.obtainMethod = 'GIFT';
      existing.giftFromUserId = fromUserId;
      existing.remark = message ?? null;
      await this.userDecorationRepository.save(existing);
      return {
        success: true,
        message: '赠送成功',
        data: existing,
      };
    }

    // 创建接收者的装饰品记录
    const userDecoration = new UserDecoration();
    userDecoration.userId = toUserId;
    userDecoration.decorationId = decorationId;
    userDecoration.obtainMethod = 'GIFT';
    userDecoration.isPermanent = decoration.isPermanent;
    userDecoration.expiresAt = expiresAt ?? null;
    userDecoration.giftFromUserId = fromUserId;
    userDecoration.remark = message ?? null;
    userDecoration.orderId = null;
    userDecoration.activityId = null;

    const saved = await this.userDecorationRepository.save(userDecoration);

    return {
      success: true,
      message: '赠送成功',
      data: saved,
    };
  }

  /**
   * 获取用户的装饰品列表
   */
  async getUserDecorations(userId: number, type?: string) {
    const where: any = { userId };
    if (type) {
      where.decoration = { type };
    }

    const decorations = await this.userDecorationRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    // 过滤掉已过期的装饰品
    return decorations.filter((d) => {
      if (d.isPermanent) return true;
      if (!d.expiresAt) return true;
      return d.expiresAt > new Date();
    });
  }

  /**
   * 使用装饰品
   */
  async useDecoration(userId: number, decorationId: number) {
    // 查找装饰品
    const decoration = await this.getDecoration(decorationId);

    // 检查装饰品是否可用
    if (decoration.status !== 'ACTIVE') {
      throw new BadRequestException('该装饰品已下架');
    }

    let userDecoration = await this.userDecorationRepository.findOne({
      where: { userId, decorationId },
    });

    // 如果用户没有该装饰品，检查是否可以直接装备
    if (!userDecoration) {
      // 如果是默认装饰品（不需要购买、价格为0），可以直接装备
      if (decoration.obtainMethod === 'DEFAULT' && Number(decoration.price) === 0) {
        // 自动为用户添加该装饰品
        userDecoration = new UserDecoration();
        userDecoration.userId = userId;
        userDecoration.decorationId = decorationId;
        userDecoration.obtainMethod = 'DEFAULT';
        userDecoration.isPermanent = true; // 默认装饰品永久有效
        userDecoration.expiresAt = null;
        userDecoration.orderId = null;
        userDecoration.activityId = null;
        userDecoration.giftFromUserId = null;
        
        userDecoration = await this.userDecorationRepository.save(userDecoration);
      } else {
        throw new NotFoundException('您没有该装饰品');
      }
    }

    // 检查装饰品是否过期
    if (!userDecoration.isPermanent && userDecoration.expiresAt && userDecoration.expiresAt <= new Date()) {
      throw new BadRequestException('该装饰品已过期');
    }

    // 取消同类型的其他装饰品
    const sameTypeDecorations = await this.userDecorationRepository
      .createQueryBuilder('ud')
      .leftJoinAndSelect('ud.decoration', 'decoration')
      .where('ud.userId = :userId', { userId })
      .andWhere('decoration.type = :type', { type: decoration.type })
      .andWhere('ud.isUsing = :isUsing', { isUsing: true })
      .getMany();

    for (const dec of sameTypeDecorations) {
      dec.isUsing = false;
      await this.userDecorationRepository.save(dec);
    }

    // 设置当前装饰品为使用中
    userDecoration.isUsing = true;
    await this.userDecorationRepository.save(userDecoration);

    return {
      success: true,
      message: '装饰品已装备',
      data: userDecoration,
    };
  }

  /**
   * 取消使用装饰品
   */
  async unuseDecoration(userId: number, decorationId: number) {
    const userDecoration = await this.userDecorationRepository.findOne({
      where: { userId, decorationId },
    });

    if (!userDecoration) {
      throw new NotFoundException('您没有该装饰品');
    }

    userDecoration.isUsing = false;
    await this.userDecorationRepository.save(userDecoration);

    return {
      success: true,
      message: '已取消装备',
      data: userDecoration,
    };
  }

  /**
   * 获取用户当前使用的装饰品
   */
  async getCurrentDecorations(userId: number) {
    const decorations = await this.userDecorationRepository.find({
      where: { userId, isUsing: true },
    });

    return {
      avatarFrame: decorations.find((d) => d.decoration.type === 'AVATAR_FRAME'),
      commentBubble: decorations.find((d) => d.decoration.type === 'COMMENT_BUBBLE'),
    };
  }

  /**
   * 清理过期的装饰品
   */
  async cleanExpiredDecorations() {
    const expired = await this.userDecorationRepository.find({
      where: {
        isPermanent: false,
        expiresAt: LessThan(new Date()),
        isUsing: true,
      },
    });

    for (const decoration of expired) {
      decoration.isUsing = false;
      await this.userDecorationRepository.save(decoration);
    }

    return {
      success: true,
      message: `已清理 ${expired.length} 个过期装饰品`,
      count: expired.length,
    };
  }

  /**
   * 更新用户活动进度（点赞）
   */
  async updateLikeProgress(userId: number) {
    const activeActivities = await this.activityRepository.find({
      where: {
        status: 'ACTIVE',
        type: 'LIKE',
      },
    });

    for (const activity of activeActivities) {
      await this.incrementProgress(userId, activity.id, 'likes');
    }
  }

  /**
   * 更新用户活动进度（评论）
   */
  async updateCommentProgress(userId: number) {
    const activeActivities = await this.activityRepository.find({
      where: {
        status: 'ACTIVE',
        type: 'COMMENT',
      },
    });

    for (const activity of activeActivities) {
      await this.incrementProgress(userId, activity.id, 'comments');
    }
  }

  /**
   * 增加活动进度
   */
  private async incrementProgress(
    userId: number,
    activityId: number,
    type: 'likes' | 'comments' | 'shares' | 'signInDays',
  ) {
    let progress = await this.progressRepository.findOne({
      where: { userId, activityId },
    });

    if (!progress) {
      progress = this.progressRepository.create({
        userId,
        activityId,
      });
    }

    // 如果已完成，不再增加进度
    if (progress.isCompleted) {
      return;
    }

    // 增加对应的进度
    switch (type) {
      case 'likes':
        progress.currentLikes += 1;
        break;
      case 'comments':
        progress.currentComments += 1;
        break;
      case 'shares':
        progress.currentShares += 1;
        break;
      case 'signInDays':
        progress.currentSignInDays += 1;
        break;
    }

    // 检查是否完成
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (activity) {
      const isCompleted =
        progress.currentLikes >= activity.requiredLikes &&
        progress.currentComments >= activity.requiredComments &&
        progress.currentShares >= activity.requiredShares &&
        progress.currentSignInDays >= activity.requiredSignInDays;

      if (isCompleted && !progress.isCompleted) {
        progress.isCompleted = true;
        progress.completedAt = new Date();
      }
    }

    await this.progressRepository.save(progress);
  }

  /**
   * 领取活动奖励
   */
  async claimActivityReward(userId: number, activityId: number) {
    const progress = await this.progressRepository.findOne({
      where: { userId, activityId },
    });

    if (!progress) {
      throw new NotFoundException('未参与该活动');
    }

    if (!progress.isCompleted) {
      throw new BadRequestException('活动未完成');
    }

    if (progress.isRewarded) {
      throw new BadRequestException('奖励已领取');
    }

    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new NotFoundException('活动不存在');
    }

    // 计算过期时间
    let expiresAt: Date | undefined = undefined;
    if (!activity.isPermanent && activity.validDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + activity.validDays);
    }

    // 检查用户是否已拥有该装饰品
    const existing = await this.userDecorationRepository.findOne({
      where: { userId, decorationId: activity.decorationId },
    });

    if (existing) {
      // 如果已拥有，延长有效期或升级为永久
      if (activity.isPermanent) {
        existing.isPermanent = true;
        existing.expiresAt = null;
      } else if (existing.expiresAt && expiresAt) {
        const maxTime = Math.max(existing.expiresAt.getTime(), expiresAt.getTime());
        existing.expiresAt = new Date(maxTime);
      }
      await this.userDecorationRepository.save(existing);
    } else {
      // 创建新的装饰品记录
      const userDecoration = new UserDecoration();
      userDecoration.userId = userId;
      userDecoration.decorationId = activity.decorationId;
      userDecoration.obtainMethod = 'ACTIVITY';
      userDecoration.isPermanent = activity.isPermanent;
      userDecoration.expiresAt = expiresAt ?? null;
      userDecoration.activityId = activityId;
      userDecoration.orderId = null;
      userDecoration.giftFromUserId = null;
      await this.userDecorationRepository.save(userDecoration);
    }

    // 标记为已领取
    progress.isRewarded = true;
    progress.rewardedAt = new Date();
    await this.progressRepository.save(progress);

    // 更新活动完成人数
    await this.activityRepository.increment({ id: activityId }, 'completedCount', 1);

    return {
      success: true,
      message: '奖励领取成功',
      data: progress,
    };
  }

  /**
   * 获取用户活动进度
   */
  async getUserActivityProgress(userId: number) {
    return await this.progressRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 获取用户正在使用的装饰品（按类型分组）
   */
  async getUserEquippedDecorations(userId: number) {
    const equippedDecorations = await this.userDecorationRepository.find({
      where: { userId, isUsing: true },
      relations: ['decoration'],
    });

    // 按类型分组
    const decorationsByType: Record<string, any> = {};
    equippedDecorations.forEach((userDec) => {
      if (userDec.decoration) {
        decorationsByType[userDec.decoration.type] = {
          id: userDec.decoration.id,
          name: userDec.decoration.name,
          type: userDec.decoration.type,
          imageUrl: userDec.decoration.imageUrl,
          rarity: userDec.decoration.rarity,
        };
      }
    });

    return decorationsByType;
  }
}
