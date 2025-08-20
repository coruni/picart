import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { MessageNotificationService } from './message-notification.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Message, MessageRead]), UserModule],
  providers: [
    MessageService, 
    MessageGateway, 
    MessageNotificationService,
    JwtService, 
    ConfigService
  ],
  controllers: [MessageController],
  exports: [MessageService, MessageNotificationService],
})
export class MessageModule {}
