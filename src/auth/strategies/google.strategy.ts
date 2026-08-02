import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id?: string;
      name?: { givenName?: string; familyName?: string };
      emails?: { value: string }[];
    },
    done: VerifyCallback,
  ) {
    const { id, name, emails } = profile;

    const user = await this.authService.validateGoogleUser({
      email: emails![0].value,
      nombre: name?.givenName ?? '',
      apellido: name?.familyName ?? '',
      googleId: id ?? '',
    });

    done(null, user);
  }
}
