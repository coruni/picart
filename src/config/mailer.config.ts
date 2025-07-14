import { ConfigService } from "@nestjs/config";
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { MailerOptions } from '@nestjs-modules/mailer';
export const mailerConfig = (configService: ConfigService): MailerOptions => ({
    transport: {
        host: configService.get<string>('MAIL_HOST'),
        port: configService.get<number>('MAIL_PORT', 587),
        auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_PASSWORD'),
        },
    },
    defaults: {
        from: `"No Reply" <${configService.get<string>('MAIL_FROM')}>`,
    },
    template: {
        dir: configService.get<string>('MAIL_TEMPLATE_DIR', './templates'),
        adapter: new PugAdapter(),
        options: {
            strict: true,
        },
    },
});