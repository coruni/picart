import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './entities/message.entity';
import { MessageRead } from './entities/message-read.entity';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageGateway } from './message.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Message, MessageRead])],
  providers: [MessageService, MessageGateway],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
