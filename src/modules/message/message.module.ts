import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { MessageNotificationService } from './message-notification.service';
import { EnhancedNotificationService } from './enhanced-notification.service';
import { NotificationEventService } from './notification-event.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserModule } from '../user/user.module';
import { UserConfig } from '../user/entities/user-config.entity';
import { User } from '../user/entities/user.entity';
import { PrivateConversation } from './entities/private-conversation.entity';
import { PrivateMessage } from './entities/private-message.entity';
import { PrivateMessageService } from './private-message.service';
import { UserBlock } from '../user/entities/user-block.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      MessageRead,
      UserConfig,
      User,
      UserBlock,
      PrivateConversation,
      PrivateMessage,
    ]), 
    UserModule
  ],
  providers: [
    MessageService, 
    PrivateMessageService,
    MessageGateway, 
    MessageNotificationService,
    EnhancedNotificationService,
    NotificationEventService,
    JwtService, 
    ConfigService
  ],
  controllers: [MessageController],
  exports: [
    MessageService,
    PrivateMessageService,
    MessageNotificationService,
    EnhancedNotificationService,
  ],
})
export class MessageModule {}
