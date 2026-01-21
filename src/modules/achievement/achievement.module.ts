import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementService } from './achievement.service';
import { AchievementController } from './achievement.controller';
import { AchievementEventService } from './achievement-event.service';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { Decoration } from '../decoration/entities/decoration.entity';
import { UserDecoration } from '../decoration/entities/user-decoration.entity';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement, 
      UserAchievement,
      Decoration,
      UserDecoration,
    ]),
    PointsModule,
  ],
  controllers: [AchievementController],
  providers: [AchievementService, AchievementEventService],
  exports: [AchievementService],
})
export class AchievementModule {}
