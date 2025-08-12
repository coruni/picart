import { Injectable } from '@nestjs/common';
import { ISendMailOptions, MailerService as MailerServiceNest } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class MailerService {
  constructor(
    private readonly mailerService: MailerServiceNest,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async sendMail(options: ISendMailOptions) {
    return await this.mailerService.sendMail({
      ...options,
    });
  }

  async sendVerificationCode(email: string, code: string | number) {
    const html = `
      <div style="font-family: 'Segoe UI', 'Hiragino Sans GB', 'Arial', sans-serif; background: #f6f8fa; padding: 32px;">
        <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(120, 144, 255, 0.08); padding: 32px 28px;">
          <div style="text-align: center;">
            <h2 style="color: #7a5cff; margin-bottom: 8px;">来自${await this.cacheManager.get('site_name')}的验证码</h2>
            <p style="color: #888; font-size: 15px; margin-bottom: 24px;">
              亲爱的冒险者，您的邮箱正在进行身份验证，请查收下方的魔法验证码~
            </p>
            <div style="font-size: 28px; letter-spacing: 8px; color: #ff6f91; font-weight: bold; margin: 18px 0 24px 0;">
              ${code}
            </div>
            <p style="color: #aaa; font-size: 13px;">
              请在 <b>10分钟</b> 内输入验证码，切勿将验证码透露给他人哦！<br>
              <span style="font-size: 12px; color: #bdbdbd;">（如非本人操作，请忽略此邮件）</span>
            </p>
            <div style="margin-top: 32px; color: #bdbdbd; font-size: 12px;">
              <span>—— 来自 ${await this.cacheManager.get('site_name')} 系统的温馨提醒</span>
            </div>
          </div>
        </div>
      </div>
    `;
    return await this.sendMail({
      to: email,
      subject: `${await this.cacheManager.get('site_name')} 邮箱验证码`,
      html,
      text: `您的验证码是：${code}，请在5分钟内输入完成验证。`,
    });
  }

  async sendResetPassword(email: string, code: string) {
    const html = `
      <div style="font-family: 'Segoe UI', 'Hiragino Sans GB', 'Arial', sans-serif; background: #f6f8fa; padding: 32px;">
        <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(120, 144, 255, 0.08); padding: 32px 28px;">
          <div style="text-align: center;">
            <h2 style="color: #ff6f91; margin-bottom: 8px;">密码重置验证码</h2>
            <p style="color: #888; font-size: 15px; margin-bottom: 24px;">
              亲爱的用户，您正在重置密码，请使用下方的验证码完成操作~
            </p>
            <div style="font-size: 28px; letter-spacing: 8px; color: #ff6f91; font-weight: bold; margin: 18px 0 24px 0;">
              ${code}
            </div>
            <p style="color: #aaa; font-size: 13px;">
              请在 <b>10分钟</b> 内完成密码重置，验证码切勿泄露给他人！<br>
              <span style="font-size: 12px; color: #bdbdbd;">（如非本人操作，请忽略此邮件并检查账户安全）</span>
            </p>
            <div style="margin-top: 32px; color: #bdbdbd; font-size: 12px;">
              <span>—— 来自 ${await this.cacheManager.get('site_name')} 系统的安全提醒</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    return await this.sendMail({
      to: email,
      subject: `${await this.cacheManager.get('site_name')} 密码重置验证码`,
      html,
      text: `您的密码重置验证码是：${code}，请在10分钟内完成密码重置。`,
    });
  }
}
