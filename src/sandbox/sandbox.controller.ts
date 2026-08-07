import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SandboxService } from './sandbox.service';
import {
  CreateSandboxExerciseDto,
  UpdateSandboxExerciseDto,
  CreateSandboxAttemptDto,
} from './dto/sandbox.dto';

@ApiTags('Sandbox')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('sandbox')
export class SandboxController {
  constructor(private readonly sandboxService: SandboxService) {}

  // ───────────── Ejercicios ─────────────

  @Get('exercises')
  @ApiOperation({ summary: 'Listar ejercicios del usuario' })
  getExercises(@Request() req: any) {
    return this.sandboxService.getExercises(req.user.id);
  }

  @Post('exercises')
  @ApiOperation({ summary: 'Crear ejercicio' })
  createExercise(@Request() req: any, @Body() dto: CreateSandboxExerciseDto) {
    return this.sandboxService.createExercise(req.user.id, dto);
  }

  @Put('exercises/:id')
  @ApiOperation({ summary: 'Actualizar ejercicio' })
  updateExercise(
    @Request() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSandboxExerciseDto,
  ) {
    return this.sandboxService.updateExercise(req.user.id, id, dto);
  }

  @Delete('exercises/:id')
  @ApiOperation({ summary: 'Eliminar ejercicio' })
  deleteExercise(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.sandboxService.deleteExercise(req.user.id, id);
  }

  // ───────────── Intentos ─────────────

  @Post('attempts')
  @ApiOperation({ summary: 'Registrar un intento' })
  createAttempt(@Request() req: any, @Body() dto: CreateSandboxAttemptDto) {
    return this.sandboxService.createAttempt(req.user.id, dto);
  }

  @Get('attempts')
  @ApiOperation({ summary: 'Historial de intentos (opcional: ?exerciseId=N)' })
  getAttempts(@Request() req: any, @Query('exerciseId') exerciseId?: string) {
    const id = exerciseId ? Number(exerciseId) : undefined;
    return this.sandboxService.getAttempts(req.user.id, id && !Number.isNaN(id) ? id : undefined);
  }

  @Delete('attempts')
  @ApiOperation({ summary: 'Limpiar historial de intentos' })
  clearAttempts(@Request() req: any) {
    return this.sandboxService.clearAttempts(req.user.id);
  }

  // ───────────── Stats ─────────────

  @Get('stats')
  @ApiOperation({ summary: 'Progreso del sandbox' })
  getStats(@Request() req: any) {
    return this.sandboxService.getStats(req.user.id);
  }
}
