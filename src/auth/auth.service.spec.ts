import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { GamificationService } from '../gamification/gamification.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock };
    userSession: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock };

  const user = {
    id: 7,
    email: 'ana@example.com',
    nombre: 'Ana',
    apellido: 'Pérez',
    foto: null,
    googleId: 'google-123',
    isActive: true,
    isBanned: false,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn() },
      userSession: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 1 }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue('access-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: MailService,
          useValue: {
            sendVerificationCode: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: GamificationService,
          useValue: { updateStreak: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueTokens (vía login con Google)', () => {
    it('crea una sesión y devuelve access + refresh token', async () => {
      prisma.user.findFirst.mockResolvedValue(user);

      const result = await service.validateGoogleUser({
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        googleId: 'google-123',
      });

      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toHaveLength(96);
      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: user.id,
          // Se guarda el hash, no el token en claro.
          refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      });
    });
  });

  describe('refresh', () => {
    it('rota el refresh token y entrega un nuevo access token', async () => {
      prisma.userSession.findFirst.mockResolvedValue({
        id: 3,
        userId: user.id,
        lastActiveAt: new Date(),
        deviceInfo: 'Chrome',
        ipAddress: '1.1.1.1',
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.refresh('old-refresh-token');

      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).not.toBe('old-refresh-token');
      expect(result.refresh_token).toHaveLength(96);
      expect(result.user).toEqual({
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        foto: null,
      });

      const stored = prisma.userSession.update.mock.calls[0][0].data
        .refreshToken as string;
      // Solo se guarda el hash, nunca el token en claro.
      expect(stored).not.toBe(result.refresh_token);
      expect(stored).toMatch(/^[a-f0-9]{64}$/);
    });

    it('rechaza un refresh token desconocido', async () => {
      prisma.userSession.findFirst.mockResolvedValue(null);

      await expect(service.refresh('no-existe')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('elimina y rechaza sesiones caducadas', async () => {
      prisma.userSession.findFirst.mockResolvedValue({
        id: 9,
        userId: user.id,
        lastActiveAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      });

      await expect(service.refresh('viejo')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.userSession.delete).toHaveBeenCalledWith({
        where: { id: 9 },
      });
    });

    it('rechaza la sesión de un usuario baneado', async () => {
      prisma.userSession.findFirst.mockResolvedValue({
        id: 10,
        userId: user.id,
        lastActiveAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({ ...user, isBanned: true });

      await expect(service.refresh('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revoca la sesión asociada al refresh token', async () => {
      await service.logout('refresh-token');

      expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { refreshToken: expect.stringMatching(/^[a-f0-9]{64}$/) },
      });
    });

    it('no falla si no se envía refresh token', async () => {
      await expect(service.logout()).resolves.toEqual({
        message: 'Sesión cerrada correctamente',
      });
      expect(prisma.userSession.deleteMany).not.toHaveBeenCalled();
    });
  });
});
