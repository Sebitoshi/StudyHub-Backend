import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';

const expressApp = express();
let nestApp: any = null;

async function getNestApp() {
  if (nestApp) return nestApp;

  nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  nestApp.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  nestApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await nestApp.init();
  return nestApp;
}

export default async function handler(req: express.Request, res: express.Response) {
  const app = await getNestApp();
  const instance = app.getHttpAdapter().getInstance();
  instance(req, res);
}
