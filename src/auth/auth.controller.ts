import { Body, Controller, Get, Logger, Post, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login-auth.dto';
import { RegisterDto } from './dto/register-auth.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendCodeDto } from './dto/resend-code.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { Request, Response } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o email ya registrado' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({
    status: 200,
    description: 'Inicio de sesión exitoso',
    content: {
      'application/json': {
        example: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: { id: 1, nombre: 'Juan', apellido: 'Pérez', email: 'juan@example.com' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verificar correo electrónico con código de 6 dígitos' })
  @ApiResponse({ status: 200, description: 'Correo verificado exitosamente' })
  @ApiResponse({ status: 400, description: 'Código inválido o expirado' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.email, dto.code);
  }

  @Post('resend-code')
  @ApiOperation({ summary: 'Reenviar código de verificación al correo' })
  @ApiResponse({ status: 200, description: 'Código reenviado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendVerificationCode(dto.email);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Iniciar sesión con Google' })
  @ApiResponse({ status: 302, description: 'Redirección a Google OAuth' })
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  @ApiResponse({ status: 302, description: 'Redirección al frontend con token' })
  @ApiResponse({ status: 401, description: 'Autenticación con Google fallida' })
  googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = req.user as { access_token: string; user: Record<string, unknown> };
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const token = result.access_token;
    const user = encodeURIComponent(JSON.stringify(result.user));
    this.logger.log(`Google OAuth callback, redirecting to frontend`);
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${user}`);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar enlace de restablecimiento de contraseña' })
  @ApiResponse({ status: 200, description: 'Correo enviado si la cuenta existe' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada correctamente' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  logout() {
    return { message: 'Sesión cerrada correctamente' };
  }
}
