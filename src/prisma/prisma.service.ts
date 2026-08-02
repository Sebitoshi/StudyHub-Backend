import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Permite conexiones TLS a bases de datos en la nube con certificados auto-firmados o cadenas personalizadas (Aiven, Neon, etc.)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const rawUrl = process.env.DATABASE_URL || '';
    const dbUrl = new URL(rawUrl);
    dbUrl.searchParams.delete('sslmode');
    dbUrl.searchParams.delete('ssl');

    const pool = new Pool({
      connectionString: dbUrl.toString(),
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

