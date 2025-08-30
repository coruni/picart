import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { MessageNotificationService } from './message-notification.service';
import { EnhancedNotificationService } from './enhanced-notification.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { UserConfig } from '../user/entities/user-config.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageRead, UserConfig, User]), 
    UserModule
  ],
  providers: [
    MessageService, 
    MessageGateway, 
    MessageNotificationService,
    EnhancedNotificationService,
    JwtService, 
    ConfigService
  ],
  controllers: [MessageController],
  exports: [MessageService, MessageNotificationService, EnhancedNotificationService],
})
export class MessageModule {}
