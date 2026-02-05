import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';
import { PointsEventService } from './points-event.service';
import { PointsTransaction } from './entities/points-transaction.entity';
import { PointsActivity } from './entities/points-activity.entity';
import { PointsTaskRecord } from './entities/points-task-record.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsTransaction,
      PointsActivity,
      PointsTaskRecord,
      User,
    ]),
  ],
  controllers: [PointsController],
  providers: [PointsService, PointsEventService],
  exports: [PointsService],
})
export class PointsModule {}
