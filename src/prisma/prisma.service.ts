import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    let cleanUrl = process.env.DATABASE_URL || '';
    if (cleanUrl) {
      try {
        const dbUrl = new URL(cleanUrl);
        dbUrl.searchParams.delete('sslmode');
        dbUrl.searchParams.delete('ssl');
        cleanUrl = dbUrl.toString();
        // Sobrescribir process.env.DATABASE_URL globalmente para evitar que el runtime de Prisma re-lea sslmode=require
        process.env.DATABASE_URL = cleanUrl;
      } catch (err) {
        console.warn('Could not parse DATABASE_URL string');
      }
    }

    const pool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }
}


