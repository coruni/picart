import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { User } from '../user/entities/user.entity';
import { Article } from '../article/entities/article.entity';
import { Comment } from '../comment/entities/comment.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { QueryReportDto } from './dto/query-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Article)
    private articleRepository: Repository<Article>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
  ) {}

  async create(createReportDto: CreateReportDto, reporterId: number) {
    const { type, reportedUserId, reportedArticleId, reportedCommentId } = createReportDto;

    // 验证举报目标是否存在
    if (type === 'USER' && reportedUserId) {
      const user = await this.userRepository.findOne({ where: { id: reportedUserId } });
      if (!user) {
        throw new NotFoundException('response.error.reportedUserNotFound');
      }
    } else if (type === 'ARTICLE' && reportedArticleId) {
      const article = await this.articleRepository.findOne({ where: { id: reportedArticleId } });
      if (!article) {
        throw new NotFoundException('response.error.reportedArticleNotFound');
      }
    } else if (type === 'COMMENT' && reportedCommentId) {
      const comment = await this.commentRepository.findOne({ where: { id: reportedCommentId } });
      if (!comment) {
        throw new NotFoundException('response.error.reportedCommentNotFound');
      }
    } else {
      throw new BadRequestException('response.error.reportTargetIdRequired');
    }

    // 检查是否重复举报
    const existingReport = await this.reportRepository.findOne({
      where: {
        reporterId,
        type,
        ...(reportedUserId && { reportedUserId }),
        ...(reportedArticleId && { reportedArticleId }),
        ...(reportedCommentId && { reportedCommentId }),
        status: 'PENDING',
      },
    });

    if (existingReport) {
      throw new BadRequestException('response.error.duplicateReport');
    }

    const report = this.reportRepository.create({
      ...createReportDto,
      reporterId,
    });

    return await this.reportRepository.save(report);
  }

  async findAll(queryReportDto: QueryReportDto) {
    const { page = 1, limit = 10, type, status, category, reporterId } = queryReportDto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.reportedUser', 'reportedUser')
      .leftJoinAndSelect('report.reportedArticle', 'reportedArticle')
      .leftJoinAndSelect('report.reportedComment', 'reportedComment')
      .leftJoinAndSelect('report.handler', 'handler');

    if (type) {
      queryBuilder.andWhere('report.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('report.status = :status', { status });
    }

    if (category) {
      queryBuilder.andWhere('report.category = :category', { category });
    }

    if (reporterId) {
      queryBuilder.andWhere('report.reporterId = :reporterId', { reporterId });
    }

    queryBuilder.orderBy('report.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: [
        'reporter',
        'reportedUser',
        'reportedArticle',
        'reportedArticle.author',
        'reportedComment',
        'reportedComment.author',
        'handler',
      ],
    });

    if (!report) {
      throw new NotFoundException('response.error.reportNotFound');
    }

    return report;
  }

  async update(id: number, updateReportDto: UpdateReportDto, handlerId: number) {
    const report = await this.findOne(id);

    // 如果指定了处理动作，执行相应的操作
    if (updateReportDto.action) {
      await this.executeAction(report, updateReportDto.action);
    }

    Object.assign(report, updateReportDto);

    if (updateReportDto.status && updateReportDto.status !== 'PENDING') {
      report.handlerId = handlerId;
      report.handledAt = new Date();
    }

    return await this.reportRepository.save(report);
  }

  /**
   * 执行举报处理动作
   */
  private async executeAction(report: Report, action: 'DELETE_CONTENT' | 'BAN_USER' | 'WARNING' | 'NONE') {
    switch (action) {
      case 'DELETE_CONTENT':
        await this.deleteReportedContent(report);
        break;
      case 'BAN_USER':
        await this.banReportedUser(report);
        break;
      case 'WARNING':
        // 警告操作可以在这里实现，比如发送通知等
        break;
      case 'NONE':
        // 无需处理
        break;
    }
  }

  /**
   * 删除被举报的内容
   */
  private async deleteReportedContent(report: Report) {
    if (report.type === 'ARTICLE' && report.reportedArticleId) {
      const article = await this.articleRepository.findOne({
        where: { id: report.reportedArticleId },
      });
      if (article) {
        await this.articleRepository.remove(article);
      }
    } else if (report.type === 'COMMENT' && report.reportedCommentId) {
      const comment = await this.commentRepository.findOne({
        where: { id: report.reportedCommentId },
      });
      if (comment) {
        await this.commentRepository.remove(comment);
      }
    }
  }

  /**
   * 封禁被举报的用户
   */
  private async banReportedUser(report: Report) {
    let userId: number | null = null;

    // 根据举报类型确定要封禁的用户
    if (report.type === 'USER' && report.reportedUserId) {
      userId = report.reportedUserId;
    } else if (report.type === 'ARTICLE' && report.reportedArticle) {
      userId = report.reportedArticle.authorId;
    } else if (report.type === 'COMMENT' && report.reportedComment?.author) {
      userId = report.reportedComment.author.id;
    }

    if (userId) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        user.status = 'BANNED';
        await this.userRepository.save(user);
      }
    }
  }

  async remove(id: number) {
    const report = await this.findOne(id);
    await this.reportRepository.remove(report);
    return { success: true, message: 'response.success.reportDelete' };
  }

  async getStatistics() {
    const total = await this.reportRepository.count();
    const pending = await this.reportRepository.count({ where: { status: 'PENDING' } });
    const processing = await this.reportRepository.count({ where: { status: 'PROCESSING' } });
    const resolved = await this.reportRepository.count({ where: { status: 'RESOLVED' } });
    const rejected = await this.reportRepository.count({ where: { status: 'REJECTED' } });

    const byType = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.type')
      .getRawMany();

    const byCategory = await this.reportRepository
      .createQueryBuilder('report')
      .select('report.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('report.category')
      .getRawMany();

    return {
      total,
      byStatus: {
        pending,
        processing,
        resolved,
        rejected,
      },
      byType,
      byCategory,
    };
  }
}
