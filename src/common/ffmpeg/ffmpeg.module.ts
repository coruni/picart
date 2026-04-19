import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FFmpegService } from './ffmpeg.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FFmpegService],
  exports: [FFmpegService],
})
export class FFmpegModule {}
