import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendVerificationCode(email: string, code: string): Promise<void> {
    this.logger.log(`[VERIFICATION CODE] To: ${email} | Code: ${code}`);
  }
}
