import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { StartSubscriptionDto } from './dto/start-subscription.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Listar planes disponibles (gratis y premium)' })
  listPlans() {
    return this.billing.listPlans();
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Estado de la suscripción, plan actual y créditos diarios del chat IA',
  })
  getAccount(@Req() req: any) {
    return this.billing.getAccount(req.user.id);
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Iniciar la suscripción Premium y obtener el checkout de Mercado Pago',
  })
  @ApiBody({ type: StartSubscriptionDto })
  subscribe(@Req() req: any, @Body() dto: StartSubscriptionDto) {
    return this.billing.startSubscription(req.user.id, dto.planCode);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Cancelar la renovación (el acceso Premium sigue hasta el fin del periodo)',
  })
  cancel(@Req() req: any) {
    return this.billing.cancelSubscription(req.user.id);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook de Mercado Pago (sin JWT, valida firma)' })
  @ApiResponse({ status: 200, description: 'Evento recibido' })
  webhook(
    @Headers() headers: Record<string, any>,
    @Query() query: Record<string, any>,
    @Body() body: any,
  ) {
    return this.billing.handleWebhook({ headers, query, body });
  }
}
