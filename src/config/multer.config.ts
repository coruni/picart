// multer.config.ts
import { ConfigService } from '@nestjs/config';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

export const multerConfig = (configService: ConfigService): MulterOptions => {
  const uploadPath = path.join(
    __dirname,
    '..',
    '..',
    configService.get('MULTER_DEST', 'uploads'),
  );

  // 确保目录存在
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  return {
    storage: diskStorage({
      destination: uploadPath,
      filename: (req, file, cb) => {
        const filename = `${Date.now()}-${file.originalname}`;
        return cb(null, filename);
      },
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  };
};
