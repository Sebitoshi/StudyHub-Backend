import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { getPlans } from '../plans';

const PAID_PLAN_CODES = getPlans()
  .filter((plan) => plan.premium)
  .map((plan) => plan.code);

export class StartSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Código del plan de pago a contratar',
    enum: PAID_PLAN_CODES,
    default: 'PREMIUM',
  })
  @IsOptional()
  @IsString()
  @IsIn(PAID_PLAN_CODES)
  planCode?: string;
}
