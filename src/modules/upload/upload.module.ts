import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MulterModule } from "@nestjs/platform-express";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UploadService } from "./upload.service";
import { UploadController } from "./upload.controller";
import { Upload } from "./entities/upload.entity";
import { multerConfig } from "../../config/multer.config";
import { ImageProcessorService } from "./image-processor.service";
import { UploadMigrationService } from "./upload-migration.service";
import { QueueModule } from "../../common/queue/queue.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Upload]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: multerConfig,
      inject: [ConfigService],
    }),
    QueueModule,
  ],
  controllers: [UploadController],
  providers: [UploadService, ImageProcessorService, UploadMigrationService],
  exports: [UploadService, ImageProcessorService],
})
export class UploadModule {}
