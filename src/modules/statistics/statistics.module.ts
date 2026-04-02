import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Article } from "../article/entities/article.entity";
import { Collection } from "../collection/entities/collection.entity";
import { Comment } from "../comment/entities/comment.entity";
import { Order } from "../order/entities/order.entity";
import { Report } from "../report/entities/report.entity";
import { User } from "../user/entities/user.entity";
import { StatisticsController } from "./statistics.controller";
import { StatisticsService } from "./statistics.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Article,
      Comment,
      Order,
      Report,
      Collection,
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
