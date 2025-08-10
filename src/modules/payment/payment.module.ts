import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentRecord } from './entities/payment-record.entity';
import { ConfigModule } from '../config/config.module';
import { OrderModule } from '../order/order.module';
import { UserModule } from '../user/user.module';
import { CommissionService } from '../../common/services/commission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentRecord]),
    ConfigModule,
    OrderModule,
    UserModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService, CommissionService],
  exports: [PaymentService],
})
export class PaymentModule {}
