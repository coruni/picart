import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { Article } from '../article/entities/article.entity';
import { CommissionService } from '../../common/services/commission.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Article]),
    UserModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, CommissionService],
  exports: [OrderService],
})
export class OrderModule {}
