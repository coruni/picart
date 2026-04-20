import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentAuditService } from './content-audit.service';
import { ContentAuditWorkflowService } from './content-audit-workflow.service';
import { ContentAuditController } from './content-audit.controller';
import { TencentAuditService } from './providers/tencent-audit.service';
import { AliyunAuditService } from './providers/aliyun-audit.service';
import { ConfigModule } from '../config/config.module';
import { Article } from '../article/entities/article.entity';
import { Category } from '../category/entities/category.entity';
import { UserModule } from '../user/user.module';
import { Upload } from '../upload/entities/upload.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, Category, Upload]),
    forwardRef(() => ConfigModule),
    forwardRef(() => UserModule),
  ],
  controllers: [ContentAuditController],
  providers: [
    ContentAuditService,
    ContentAuditWorkflowService,
    TencentAuditService,
    AliyunAuditService,
  ],
  exports: [ContentAuditService, ContentAuditWorkflowService],
})
export class ContentAuditModule {}
