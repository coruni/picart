import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME || 'PicArt',
  version: process.env.APP_VERSION || '1.0.0',
  ios: {
    version: process.env.APP_IOS_VERSION || '1.0.0',
    downloadUrl: process.env.APP_IOS_DOWNLOAD_URL || '',
    forceUpdateVersion: process.env.APP_IOS_FORCE_UPDATE_VERSION || '',
  },
  android: {
    version: process.env.APP_ANDROID_VERSION || '1.0.0',
    downloadUrl: process.env.APP_ANDROID_DOWNLOAD_URL || '',
    forceUpdateVersion: process.env.APP_ANDROID_FORCE_UPDATE_VERSION || '',
  },
  forceUpdate: process.env.APP_FORCE_UPDATE === 'true',
  updateMessage: process.env.APP_UPDATE_MESSAGE || '发现新版本，请更新',
  maintenance: process.env.APP_MAINTENANCE === 'true',
  maintenanceMessage: process.env.APP_MAINTENANCE_MESSAGE || 'APP维护中，请稍后再试',
}));
