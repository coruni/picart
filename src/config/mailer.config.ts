import { ConfigService } from '@nestjs/config';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { MailerOptions } from '@nestjs-modules/mailer';
export const mailerConfig = (configService: ConfigService): MailerOptions => ({
  transport: {
    host: configService.get<string>('MAIL_HOST'),
    port: parseInt(configService.get<string>('MAIL_PORT', '587')),
    secure: false,
    auth: {
      user: configService.get<string>('MAIL_USER'),
      pass: configService.get<string>('MAIL_PASSWORD'),
    },
  },

  defaults: {
    from: `"${configService.get<string>('MAIL_FROM_NAME')}" <${configService.get<string>('MAIL_FROM')}>`,
  },
  template: {
    dir: configService.get<string>('MAIL_TEMPLATE_DIR', './templates'),
    adapter: new PugAdapter(),
    options: {
      strict: true,
    },
  },
});
