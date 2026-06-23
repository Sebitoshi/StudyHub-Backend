import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: { user, pass },
      });
      this.logger.log('SMTP transporter configured');
    } else {
      this.logger.log('SMTP not configured — falling back to log-only mailer');
    }
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const from = process.env.SMTP_FROM || 'noreply@studyhub.com';

    if (!this.transporter) {
      this.logger.log(`[VERIFICATION CODE] To: ${email} | Code: ${code}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Código de verificación — StudyHub',
        text: `Tu código de verificación es: ${code}`,
        html: `<p>Tu código de verificación es: <strong>${code}</strong></p>`,
      });
      this.logger.log(`Sent verification code to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}: ${err}`);
      // fallback to logging the code so the user can still verify via DB or logs
      this.logger.log(`[VERIFICATION CODE FALLBACK] To: ${email} | Code: ${code}`);
    }
  }
}
