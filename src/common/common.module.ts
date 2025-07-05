import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionService } from './services/commission.service';
import { Config } from '../modules/config/entities/config.entity';
import { UserConfig } from '../modules/user/entities/user-config.entity';
import { User } from '../modules/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Config, UserConfig, User]),
  ],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommonModule {} 