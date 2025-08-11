import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { Order } from "./entities/order.entity";
import { Article } from "../article/entities/article.entity";
import { CommissionService } from "../../common/services/commission.service";
import { UserModule } from "../user/user.module";
import { ConfigModule } from "../config/config.module";
import { Config as ConfigEntity } from "../config/entities/config.entity";
import { User } from "../user/entities/user.entity";
import { UserConfig } from "../user/entities/user-config.entity";
import { Invite } from "../invite/entities/invite.entity";
import { InviteCommission } from "../invite/entities/invite-commission.entity";
import { Payment } from "../payment/entities/payment.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Article,
      ConfigEntity,
      User,
      UserConfig,
      Invite,
      InviteCommission,
      Payment
    ]),
    UserModule,
    ConfigModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, CommissionService],
  exports: [OrderService],
})
export class OrderModule {}
