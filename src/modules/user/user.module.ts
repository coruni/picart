import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { WalletService } from './wallet.service';
import { LevelService } from './level.service';
import { LevelEventService } from './level-event.service';
import { UserController } from './user.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserDevice } from './entities/user-device.entity';
import { UserConfig } from './entities/user-config.entity';
import { UserSignIn } from './entities/user-sign-in.entity';
import { WalletTransaction } from './entities/wallet-transaction.entity';
import { LevelTransaction } from './entities/level-transaction.entity';
import { Role } from '../role/entities/role.entity';
import { Permission } from '../permission/entities/permission.entity';
import { Invite } from '../invite/entities/invite.entity';
import { jwtConfig } from '../../config/jwt.config';
import { CommonModule } from '../../common/common.module';
import { ConfigModule as AppConfigModule } from '../config/config.module';
import { MailerService } from '../../common/services/mailer.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, UserConfig, UserSignIn, WalletTransaction, LevelTransaction, Role, Permission, Invite, UserDevice]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: jwtConfig,
      inject: [ConfigService],
    }),
    CommonModule,
    AppConfigModule,
  ],
  controllers: [UserController],
  providers: [UserService, WalletService, LevelService, LevelEventService, JwtStrategy, MailerService],
  exports: [UserService, WalletService, LevelService],
})
export class UserModule {}
