import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommissionService } from "./services/commission.service";
import { Config } from "../modules/config/entities/config.entity";
import { UserConfig } from "../modules/user/entities/user-config.entity";
import { User } from "../modules/user/entities/user.entity";
import { Invite } from "../modules/invite/entities/invite.entity";
import { InviteCommission } from "../modules/invite/entities/invite-commission.entity";
import { ArticleLike } from "../modules/article/entities/article-like.entity";
import { Order } from "src/modules/order/entities/order.entity";
import { Config as ConfigEntity } from "../modules/config/entities/config.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Config,
      UserConfig,
      User,
      Invite,
      InviteCommission,
      ArticleLike,
      Order,
      ConfigEntity,
    ]),
  ],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommonModule {}
