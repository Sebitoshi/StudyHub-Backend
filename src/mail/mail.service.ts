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
      this.logger.log(`[VERIFICATION CODE FALLBACK] To: ${email} | Code: ${code}`);
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const from = process.env.SMTP_FROM || 'noreply@studyhub.com';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    if (!this.transporter) {
      this.logger.log(`[PASSWORD RESET] To: ${email} | Link: ${resetLink}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Restablece tu contraseña — StudyHub',
        text: `Haz clic en el siguiente enlace para restablecer tu contraseña: ${resetLink}`,
        html: `<p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      });
      this.logger.log(`Sent password reset email to ${email}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}: ${err}`);
      this.logger.log(`[PASSWORD RESET FALLBACK] To: ${email} | Link: ${resetLink}`);
    }
  }
}
