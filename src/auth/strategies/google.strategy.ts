import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
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
