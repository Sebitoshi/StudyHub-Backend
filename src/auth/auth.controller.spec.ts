import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { refresh: jest.Mock; logout: jest.Mock };

  beforeEach(async () => {
    authService = {
      refresh: jest.fn().mockResolvedValue({ access_token: 'nuevo' }),
      logout: jest.fn().mockResolvedValue({ message: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delega la renovación del token al servicio', async () => {
    const req = {
      headers: { 'user-agent': 'jest', 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      ip: '127.0.0.1',
    } as any;

    await expect(
      controller.refresh({ refresh_token: 'abc' }, req),
    ).resolves.toEqual({ access_token: 'nuevo' });

    expect(authService.refresh).toHaveBeenCalledWith('abc', {
      deviceInfo: 'jest',
      ipAddress: '10.0.0.1',
    });
  });

  it('revoca la sesión al cerrar sesión', async () => {
    await controller.logout({ refresh_token: 'abc' });

    expect(authService.logout).toHaveBeenCalledWith('abc');
  });
});
