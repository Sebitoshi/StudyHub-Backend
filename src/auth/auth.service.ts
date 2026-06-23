import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { VerificationTokenType } from '../common/enums';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
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

    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.password);

    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return this.generateToken(user);
  }

  async validateGoogleUser(profile: {
    email: string;
    nombre: string;
    apellido: string;
    googleId: string;
  }) {
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

    return this.generateToken(user);
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
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

  private generateToken(user: {
    id: number;
    email: string;
    nombre: string;
    apellido: string;
  }) {
    const payload = { sub: user.id, email: user.email };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
      },
    };
  }
}
