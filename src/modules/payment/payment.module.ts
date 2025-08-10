import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../user/user.module';
import { ConfigModule } from '../config/config.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order, User]),
    OrderModule,
    UserModule,
    ConfigModule,
    CommonModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
