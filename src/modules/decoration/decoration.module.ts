import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DecorationService } from "./decoration.service";
import { DecorationEventService } from "./decoration-event.service";
import { DecorationController } from "./decoration.controller";
import { Decoration } from "./entities/decoration.entity";
import { UserDecoration } from "./entities/user-decoration.entity";
import { DecorationActivity } from "./entities/decoration-activity.entity";
import { UserActivityProgress } from "./entities/user-activity-progress.entity";
import { Article } from "../article/entities/article.entity";
import { UserModule } from "../user/user.module";
import { ArticlePresentationModule } from "../article/article-presentation.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Decoration,
      UserDecoration,
      DecorationActivity,
      UserActivityProgress,
      Article,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => ArticlePresentationModule),
  ],
  controllers: [DecorationController],
  providers: [DecorationService, DecorationEventService],
  exports: [DecorationService],
})
export class DecorationModule {}
