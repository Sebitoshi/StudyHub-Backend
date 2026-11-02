import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, EntitlementsService, MercadoPagoService],
  exports: [BillingService, EntitlementsService, MercadoPagoService],
})
export class BillingModule {}
