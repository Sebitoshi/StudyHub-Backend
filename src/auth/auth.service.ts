import crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { GamificationService } from '../gamification/gamification.service';
import { VerificationTokenType } from '../common/enums';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login-auth.dto';

/** Duración de la sesión deslizante: cada uso renueva otros 30 días. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionMeta {
  deviceInfo?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private gamificationService: GamificationService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(dto: RegisterDto, meta: SessionMeta = {}) {
    this.logger.log(`Register attempt for email: ${dto.email}`);
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      this.logger.warn(`Registration failed: email ${dto.email} already exists`);
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const code = this.generateVerificationCode();

    const user = await this.prisma.user.create({
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email,
        password: hashedPassword,
        verificationTokens: {
          create: {
            token: code,
            type: VerificationTokenType.EMAIL_VERIFICATION,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        },
      },
    });

    await this.mailService.sendVerificationCode(user.email, code);
    this.logger.log(`User registered successfully: ${user.email} (id: ${user.id})`);

    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta = {}) {
    this.logger.log(`Login attempt for email: ${dto.email}`);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found for ${dto.email}`);
      throw new UnauthorizedException('El usuario no existe');
    }

    if (!user.password) {
      this.logger.warn(`Login failed: Google account for ${dto.email}`);
      throw new UnauthorizedException('Esta cuenta usa Google. Inicia sesión con Google.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);

    if (!valid) {
      this.logger.warn(`Login failed: invalid password for ${dto.email}`);
      throw new UnauthorizedException('La contraseña es incorrecta');
    }

    await this.gamificationService.updateStreak(user.id);
    this.logger.log(`Login successful for ${dto.email} (id: ${user.id})`);

    return this.issueTokens(user, meta);
  }

  async validateGoogleUser(
    profile: {
      email: string;
      nombre: string;
      apellido: string;
      googleId: string;
    },
    meta: SessionMeta = {},
  ) {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ email: profile.email }, { googleId: profile.googleId }] },
    });

    if (user) {
      if (!user.googleId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId, emailVerified: true },
        });
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          nombre: profile.nombre,
          apellido: profile.apellido,
          googleId: profile.googleId,
          emailVerified: true,
        },
      });
    }

    await this.gamificationService.updateStreak(user.id);

    return this.issueTokens(user, meta);
  }

  async verifyEmail(email: string, code: string) {
    this.logger.log(`Email verification attempt for: ${email}`);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Email verification failed: user not found for ${email}`);
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new BadRequestException('El correo ya está verificado');
    }

    const token = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        token: code,
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: { gt: new Date() },
      },
    });

    if (!token) {
      this.logger.warn(`Email verification failed: invalid code for ${email}`);
      throw new BadRequestException('Código de verificación inválido o expirado');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      this.prisma.verificationToken.delete({
        where: { id: token.id },
      }),
    ]);

    this.logger.log(`Email verified successfully for: ${email}`);
    return { message: 'Correo verificado correctamente' };
  }

  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new BadRequestException('El correo ya está verificado');
    }

    const code = this.generateVerificationCode();

    await this.prisma.verificationToken.create({
      data: {
        token: code,
        type: VerificationTokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        userId: user.id,
      },
    });

    await this.mailService.sendVerificationCode(user.email, code);

    return { message: 'Código de verificación reenviado' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    this.logger.log(`Forgot password request for: ${email}`);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.prisma.verificationToken.create({
        data: {
          token,
          type: VerificationTokenType.PASSWORD_RESET,
          expiresAt,
          userId: user.id,
        },
      });

      await this.mailService.sendPasswordResetEmail(user.email, token);
    }

    return { message: 'Si el correo existe, recibirás un enlace para restablecer tu contraseña' };
  }

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    this.logger.log('Password reset attempt');
    const record = await this.prisma.verificationToken.findFirst({
      where: {
        token,
        type: VerificationTokenType.PASSWORD_RESET,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.verificationToken.delete({
        where: { id: record.id },
      }),
    ]);

    return { message: 'Contraseña actualizada correctamente' };
  }

  /**
   * Renueva el token de acceso a partir del refresh token.
   * El refresh token rota en cada uso (rotación de un solo uso) para que un
   * token robado deje de servir en cuanto el dueño legítimo renueve.
   */
  async refresh(refreshToken: string, meta: SessionMeta = {}) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Sesión no válida');
    }

    const session = await this.prisma.userSession.findFirst({
      where: { refreshToken: this.hashRefreshToken(refreshToken) },
    });

    if (!session) {
      throw new UnauthorizedException('Sesión expirada. Inicia sesión de nuevo.');
    }

    const expiredAt = session.lastActiveAt.getTime() + REFRESH_TOKEN_TTL_MS;
    if (Date.now() > expiredAt) {
      await this.deleteSession(session.id);
      throw new UnauthorizedException('Sesión expirada. Inicia sesión de nuevo.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user || !user.isActive || user.isBanned) {
      await this.deleteSession(session.id);
      throw new UnauthorizedException('Sesión no válida');
    }

    const rotatedToken = crypto.randomBytes(48).toString('hex');
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: this.hashRefreshToken(rotatedToken),
        lastActiveAt: new Date(),
        deviceInfo: this.normalizeDeviceInfo(meta.deviceInfo) ?? session.deviceInfo,
        ipAddress: meta.ipAddress ?? session.ipAddress,
      },
    });

    this.logger.log(`Session refreshed for user ${user.id} (session ${session.id})`);

    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email }),
      refresh_token: rotatedToken,
      user: this.publicUser(user),
    };
  }

  /** Cierra una sesión concreta (revoca su refresh token). */
  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.userSession.deleteMany({
        where: { refreshToken: this.hashRefreshToken(refreshToken) },
      });
    }

    return { message: 'Sesión cerrada correctamente' };
  }

  private async issueTokens(
    user: {
      id: number;
      email: string;
      nombre: string;
      apellido: string;
      foto?: string | null;
    },
    meta: SessionMeta = {},
  ) {
    const refreshToken = crypto.randomBytes(48).toString('hex');

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: this.hashRefreshToken(refreshToken),
        deviceInfo: this.normalizeDeviceInfo(meta.deviceInfo),
        ipAddress: meta.ipAddress ?? null,
      },
    });

    // Limpieza oportunista de sesiones caducadas (no bloquea el login).
    const cutoff = new Date(Date.now() - REFRESH_TOKEN_TTL_MS);
    this.prisma.userSession
      .deleteMany({ where: { userId: user.id, lastActiveAt: { lt: cutoff } } })
      .catch((error) =>
        this.logger.warn(`No se pudieron limpiar sesiones antiguas: ${error}`),
      );

    return {
      access_token: this.jwtService.sign({ sub: user.id, email: user.email }),
      refresh_token: refreshToken,
      user: this.publicUser(user),
    };
  }

  private publicUser(user: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    foto?: string | null;
  }) {
    return {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      foto: user.foto ?? null,
    };
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private normalizeDeviceInfo(deviceInfo?: string | null): string | null {
    if (!deviceInfo) return null;
    return deviceInfo.slice(0, 255);
  }

  private async deleteSession(sessionId: number): Promise<void> {
    try {
      await this.prisma.userSession.delete({ where: { id: sessionId } });
    } catch (error) {
      this.logger.warn(`No se pudo eliminar la sesión ${sessionId}: ${error}`);
    }
  }
}
