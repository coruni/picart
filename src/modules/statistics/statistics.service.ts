import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../user/entities/user.entity";
import { Article } from "../article/entities/article.entity";
import { Comment } from "../comment/entities/comment.entity";
import { Order } from "../order/entities/order.entity";
import { Report } from "../report/entities/report.entity";
import { Collection } from "../collection/entities/collection.entity";

type TrendRow = {
  date: string;
  count: string | number;
  revenue?: string | number | null;
};

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
  ) {}

  async getOverview() {
    const [
      userStatsRaw,
      articleStatsRaw,
      commentStatsRaw,
      reportStatsRaw,
      collectionStatsRaw,
      paidOrderStatsRaw,
      todayPaidOrderStatsRaw,
      articleEngagementRaw,
      commentEngagementRaw,
      collectionEngagementRaw,
    ] = await Promise.all([
      this.userRepository
        .createQueryBuilder("user")
        .select("COUNT(user.id)", "total")
        .addSelect(
          "SUM(CASE WHEN user.status = :activeStatus THEN 1 ELSE 0 END)",
          "active",
        )
        .addSelect(
          "SUM(CASE WHEN user.status = :bannedStatus THEN 1 ELSE 0 END)",
          "banned",
        )
        .addSelect(
          "SUM(CASE WHEN user.membershipStatus = :membershipStatus THEN 1 ELSE 0 END)",
          "activeMembers",
        )
        .addSelect(
          "SUM(CASE WHEN user.createdAt >= CURRENT_DATE AND user.createdAt < CURRENT_DATE + INTERVAL 1 DAY THEN 1 ELSE 0 END)",
          "todayNew",
        )
        .setParameters({
          activeStatus: "ACTIVE",
          bannedStatus: "BANNED",
          membershipStatus: "ACTIVE",
        })
        .getRawOne(),
      this.articleRepository
        .createQueryBuilder("article")
        .select("COUNT(article.id)", "total")
        .addSelect(
          "SUM(CASE WHEN article.status = :published THEN 1 ELSE 0 END)",
          "published",
        )
        .addSelect(
          "SUM(CASE WHEN article.status = :pending THEN 1 ELSE 0 END)",
          "pending",
        )
        .addSelect(
          "SUM(CASE WHEN article.createdAt >= CURRENT_DATE AND article.createdAt < CURRENT_DATE + INTERVAL 1 DAY THEN 1 ELSE 0 END)",
          "todayNew",
        )
        .setParameters({ published: "PUBLISHED", pending: "PENDING" })
        .getRawOne(),
      this.commentRepository
        .createQueryBuilder("comment")
        .select("COUNT(comment.id)", "total")
        .addSelect(
          "SUM(CASE WHEN comment.status = :published THEN 1 ELSE 0 END)",
          "published",
        )
        .addSelect(
          "SUM(CASE WHEN comment.createdAt >= CURRENT_DATE AND comment.createdAt < CURRENT_DATE + INTERVAL 1 DAY THEN 1 ELSE 0 END)",
          "todayNew",
        )
        .setParameter("published", "PUBLISHED")
        .getRawOne(),
      this.reportRepository
        .createQueryBuilder("report")
        .select(
          "SUM(CASE WHEN report.status = :pending THEN 1 ELSE 0 END)",
          "pending",
        )
        .addSelect(
          "SUM(CASE WHEN report.status = :processing THEN 1 ELSE 0 END)",
          "processing",
        )
        .setParameters({ pending: "PENDING", processing: "PROCESSING" })
        .getRawOne(),
      this.collectionRepository
        .createQueryBuilder("collection")
        .select("COUNT(collection.id)", "total")
        .addSelect(
          "SUM(CASE WHEN collection.isPublic = 1 THEN 1 ELSE 0 END)",
          "publicCount",
        )
        .getRawOne(),
      this.orderRepository
        .createQueryBuilder("order")
        .select("COUNT(order.id)", "count")
        .addSelect("COALESCE(SUM(order.amount), 0)", "revenue")
        .where("order.status = :status", { status: "PAID" })
        .getRawOne(),
      this.orderRepository
        .createQueryBuilder("order")
        .select("COUNT(order.id)", "count")
        .addSelect("COALESCE(SUM(order.amount), 0)", "revenue")
        .where("order.status = :status", { status: "PAID" })
        .andWhere(
          "order.paidAt >= CURRENT_DATE AND order.paidAt < CURRENT_DATE + INTERVAL 1 DAY",
        )
        .getRawOne(),
      this.articleRepository
        .createQueryBuilder("article")
        .select("COALESCE(SUM(article.views), 0)", "views")
        .addSelect("COALESCE(SUM(article.likes), 0)", "likes")
        .addSelect("COALESCE(SUM(article.favoriteCount), 0)", "favorites")
        .addSelect("COALESCE(SUM(article.commentCount), 0)", "comments")
        .addSelect("COALESCE(SUM(article.shares), 0)", "shares")
        .getRawOne(),
      this.commentRepository
        .createQueryBuilder("comment")
        .select("COALESCE(SUM(comment.likes), 0)", "likes")
        .addSelect("COALESCE(SUM(comment.replyCount), 0)", "replies")
        .getRawOne(),
      this.collectionRepository
        .createQueryBuilder("collection")
        .select("COALESCE(SUM(collection.views), 0)", "views")
        .addSelect("COALESCE(SUM(collection.itemCount), 0)", "items")
        .getRawOne(),
    ]);

    const totalUsers = Number(userStatsRaw?.total || 0);
    const activeUsers = Number(userStatsRaw?.active || 0);
    const bannedUsers = Number(userStatsRaw?.banned || 0);
    const activeMembers = Number(userStatsRaw?.activeMembers || 0);
    const todayUsers = Number(userStatsRaw?.todayNew || 0);

    const totalArticles = Number(articleStatsRaw?.total || 0);
    const publishedArticles = Number(articleStatsRaw?.published || 0);
    const pendingArticles = Number(articleStatsRaw?.pending || 0);
    const todayArticles = Number(articleStatsRaw?.todayNew || 0);

    const totalComments = Number(commentStatsRaw?.total || 0);
    const publishedComments = Number(commentStatsRaw?.published || 0);
    const todayComments = Number(commentStatsRaw?.todayNew || 0);

    const pendingReports = Number(reportStatsRaw?.pending || 0);
    const processingReports = Number(reportStatsRaw?.processing || 0);

    const totalCollections = Number(collectionStatsRaw?.total || 0);
    const publicCollections = Number(collectionStatsRaw?.publicCount || 0);

    const paidOrdersCountRaw = { count: paidOrderStatsRaw?.count };
    const paidRevenueRaw = { revenue: paidOrderStatsRaw?.revenue };
    const todayPaidOrdersRaw = { count: todayPaidOrderStatsRaw?.count };
    const todayPaidRevenueRaw = { revenue: todayPaidOrderStatsRaw?.revenue };

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        activeMembers,
        todayNew: todayUsers,
      },
      content: {
        articles: totalArticles,
        publishedArticles,
        pendingArticles,
        comments: totalComments,
        publishedComments,
        collections: totalCollections,
        publicCollections,
        todayArticles,
        todayComments,
      },
      orders: {
        paidCount: Number(paidOrdersCountRaw?.count || 0),
        paidRevenue: Number(paidRevenueRaw?.revenue || 0),
        todayPaidCount: Number(todayPaidOrdersRaw?.count || 0),
        todayPaidRevenue: Number(todayPaidRevenueRaw?.revenue || 0),
      },
      moderation: {
        pendingReports,
        processingReports,
        pendingArticles,
      },
      engagement: {
        articleViews: Number(articleEngagementRaw?.views || 0),
        articleLikes: Number(articleEngagementRaw?.likes || 0),
        articleFavorites: Number(articleEngagementRaw?.favorites || 0),
        articleShares: Number(articleEngagementRaw?.shares || 0),
        articleComments: Number(articleEngagementRaw?.comments || 0),
        commentLikes: Number(commentEngagementRaw?.likes || 0),
        commentReplies: Number(commentEngagementRaw?.replies || 0),
        collectionViews: Number(collectionEngagementRaw?.views || 0),
        collectionItems: Number(collectionEngagementRaw?.items || 0),
      },
    };
  }

  async getTrends(days: number) {
    const normalizedDays = Math.min(Math.max(days || 7, 1), 30);
    const startDate = this.getStartDate(normalizedDays);

    const [userRows, articleRows, commentRows, orderRows] = await Promise.all([
      this.userRepository
        .createQueryBuilder("user")
        .select("DATE(user.createdAt)", "date")
        .addSelect("COUNT(user.id)", "count")
        .where("user.createdAt >= :startDate", { startDate })
        .groupBy("DATE(user.createdAt)")
        .orderBy("DATE(user.createdAt)", "ASC")
        .getRawMany<TrendRow>(),
      this.articleRepository
        .createQueryBuilder("article")
        .select("DATE(article.createdAt)", "date")
        .addSelect("COUNT(article.id)", "count")
        .where("article.createdAt >= :startDate", { startDate })
        .groupBy("DATE(article.createdAt)")
        .orderBy("DATE(article.createdAt)", "ASC")
        .getRawMany<TrendRow>(),
      this.commentRepository
        .createQueryBuilder("comment")
        .select("DATE(comment.createdAt)", "date")
        .addSelect("COUNT(comment.id)", "count")
        .where("comment.createdAt >= :startDate", { startDate })
        .groupBy("DATE(comment.createdAt)")
        .orderBy("DATE(comment.createdAt)", "ASC")
        .getRawMany<TrendRow>(),
      this.orderRepository
        .createQueryBuilder("order")
        .select("DATE(order.paidAt)", "date")
        .addSelect("COUNT(order.id)", "count")
        .addSelect("COALESCE(SUM(order.amount), 0)", "revenue")
        .where("order.status = :status", { status: "PAID" })
        .andWhere("order.paidAt IS NOT NULL")
        .andWhere("order.paidAt >= :startDate", { startDate })
        .groupBy("DATE(order.paidAt)")
        .orderBy("DATE(order.paidAt)", "ASC")
        .getRawMany<TrendRow>(),
    ]);

    return {
      days: normalizedDays,
      series: this.buildDailySeries(normalizedDays, {
        users: userRows,
        articles: articleRows,
        comments: commentRows,
        paidOrders: orderRows,
      }),
    };
  }

  private getStartDate(days: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return start;
  }

  private buildDailySeries(days: number, rows: Record<string, TrendRow[]>) {
    const startDate = this.getStartDate(days);
    const rowsMap = Object.fromEntries(
      Object.entries(rows).map(([key, value]) => [
        key,
        new Map(value.map((item) => [this.normalizeDateKey(item.date), item])),
      ]),
    ) as Record<string, Map<string, TrendRow>>;

    return Array.from({ length: days }, (_, index) => {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + index);
      const dateKey = this.formatDateKey(currentDate);
      const paidOrder = rowsMap.paidOrders.get(dateKey);

      return {
        date: dateKey,
        users: Number(rowsMap.users.get(dateKey)?.count || 0),
        articles: Number(rowsMap.articles.get(dateKey)?.count || 0),
        comments: Number(rowsMap.comments.get(dateKey)?.count || 0),
        paidOrders: Number(paidOrder?.count || 0),
        paidRevenue: Number(paidOrder?.revenue || 0),
      };
    });
  }

  private normalizeDateKey(value: string) {
    return this.formatDateKey(new Date(value));
  }

  private formatDateKey(value: Date) {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
