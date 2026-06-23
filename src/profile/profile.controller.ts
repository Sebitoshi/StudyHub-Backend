import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AddObjectiveDto } from './dto/add-objective.dto';
import { AddSkillDto } from './dto/add-skill.dto';
import { CreateAcademicProfileDto } from './dto/create-academic-profile.dto';
import { CreateProfessionalProfileDto } from './dto/create-professional-profile.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { ToggleModuleDto } from './dto/toggle-module.dto';
import { UpdateAcademicProfileDto } from './dto/update-academic-profile.dto';
import { UpdatePersonalInfoDto } from './dto/update-personal-info.dto';
import { UpdateProfessionalProfileDto } from './dto/update-professional-profile.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ─── Academic ───────────────────────────────────────

  @Post('academic')
  @ApiOperation({ summary: 'Crear perfil académico' })
  createAcademic(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateAcademicProfileDto,
  ) {
    return this.profileService.createAcademic(user.id, dto);
  }

  @Get('academic')
  @ApiOperation({ summary: 'Obtener perfil académico' })
  findAcademic(@CurrentUser() user: { id: number }) {
    return this.profileService.findAcademicByUser(user.id);
  }

  @Put('academic')
  @ApiOperation({ summary: 'Actualizar perfil académico' })
  updateAcademic(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateAcademicProfileDto,
  ) {
    return this.profileService.updateAcademic(user.id, dto);
  }

  @Delete('academic')
  @ApiOperation({ summary: 'Eliminar perfil académico' })
  removeAcademic(@CurrentUser() user: { id: number }) {
    return this.profileService.removeAcademic(user.id);
  }

  // ─── Professional ───────────────────────────────────

  @Post('professional')
  @ApiOperation({ summary: 'Crear perfil profesional' })
  createProfessional(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateProfessionalProfileDto,
  ) {
    return this.profileService.createProfessional(user.id, dto);
  }

  @Get('professional')
  @ApiOperation({ summary: 'Obtener perfil profesional' })
  findProfessional(@CurrentUser() user: { id: number }) {
    return this.profileService.findProfessionalByUser(user.id);
  }

  @Put('professional')
  @ApiOperation({ summary: 'Actualizar perfil profesional' })
  updateProfessional(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateProfessionalProfileDto,
  ) {
    return this.profileService.updateProfessional(user.id, dto);
  }

  @Delete('professional')
  @ApiOperation({ summary: 'Eliminar perfil profesional' })
  removeProfessional(@CurrentUser() user: { id: number }) {
    return this.profileService.removeProfessional(user.id);
  }

  // ─── Skills ─────────────────────────────────────────

  @Get('skills')
  @ApiOperation({ summary: 'Obtener habilidades del usuario' })
  getUserSkills(@CurrentUser() user: { id: number }) {
    return this.profileService.getUserSkills(user.id);
  }

  @Post('skills')
  @ApiOperation({ summary: 'Agregar habilidad al usuario' })
  addSkill(
    @CurrentUser() user: { id: number },
    @Body() dto: AddSkillDto,
  ) {
    return this.profileService.addSkillToUser(user.id, dto);
  }

  @Put('skills')
  @ApiOperation({ summary: 'Actualizar nivel de habilidad del usuario' })
  updateSkill(
    @CurrentUser() user: { id: number },
    @Body() dto: AddSkillDto,
  ) {
    return this.profileService.updateUserSkill(user.id, dto);
  }

  @Delete('skills/:skillId')
  @ApiOperation({ summary: 'Eliminar habilidad del usuario' })
  removeSkill(
    @CurrentUser() user: { id: number },
    @Param('skillId') skillId: string,
  ) {
    return this.profileService.removeSkillFromUser(user.id, +skillId);
  }

  // ─── Objectives ──────────────────────────────────────

  @Get('objectives')
  @ApiOperation({ summary: 'Obtener objetivos del usuario' })
  getUserObjectives(@CurrentUser() user: { id: number }) {
    return this.profileService.getUserObjectives(user.id);
  }

  @Post('objectives')
  @ApiOperation({ summary: 'Agregar objetivo al usuario' })
  addObjective(
    @CurrentUser() user: { id: number },
    @Body() dto: AddObjectiveDto,
  ) {
    return this.profileService.addObjectiveToUser(user.id, dto);
  }

  @Delete('objectives/:objectiveId')
  @ApiOperation({ summary: 'Eliminar objetivo del usuario' })
  removeObjective(
    @CurrentUser() user: { id: number },
    @Param('objectiveId') objectiveId: string,
  ) {
    return this.profileService.removeObjectiveFromUser(
      user.id,
      +objectiveId,
    );
  }

  // ─── Modules ─────────────────────────────────────────

  @Get('modules')
  @ApiOperation({ summary: 'Obtener módulos del usuario' })
  getUserModules(@CurrentUser() user: { id: number }) {
    return this.profileService.getUserModules(user.id);
  }

  @Post('modules')
  @ApiOperation({ summary: 'Activar/desactivar un módulo' })
  toggleModule(
    @CurrentUser() user: { id: number },
    @Body() dto: ToggleModuleDto,
  ) {
    return this.profileService.toggleModule(user.id, dto);
  }

  @Post('modules/defaults')
  @ApiOperation({ summary: 'Activar módulos por defecto' })
  activateDefaultModules(@CurrentUser() user: { id: number }) {
    return this.profileService.activateDefaultModules(user.id);
  }

  // ─── Personal Info ──────────────────────────────────

  @Get('personal')
  @ApiOperation({ summary: 'Obtener información personal' })
  getPersonalInfo(@CurrentUser() user: { id: number }) {
    return this.profileService.getPersonalInfo(user.id);
  }

  @Put('personal')
  @ApiOperation({ summary: 'Actualizar información personal' })
  updatePersonalInfo(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdatePersonalInfoDto,
  ) {
    return this.profileService.updatePersonalInfo(user.id, dto);
  }

  // ─── Notifications ─────────────────────────────────

  @Get('notifications')
  @ApiOperation({ summary: 'Obtener configuración de notificaciones' })
  getNotificationSettings(@CurrentUser() user: { id: number }) {
    return this.profileService.getNotificationSettings(user.id);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Actualizar configuración de notificaciones' })
  updateNotificationSettings(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.profileService.updateNotificationSettings(user.id, dto);
  }

  // ─── Privacy ───────────────────────────────────────

  @Get('privacy')
  @ApiOperation({ summary: 'Obtener configuración de privacidad' })
  getPrivacySettings(@CurrentUser() user: { id: number }) {
    return this.profileService.getPrivacySettings(user.id);
  }

  @Put('privacy')
  @ApiOperation({ summary: 'Actualizar configuración de privacidad' })
  updatePrivacySettings(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdatePrivacySettingsDto,
  ) {
    return this.profileService.updatePrivacySettings(user.id, dto);
  }

  // ─── Security ──────────────────────────────────────

  @Post('security/2fa/generate')
  @ApiOperation({ summary: 'Generar secreto para 2FA' })
  generate2faSecret(@CurrentUser() user: { id: number }) {
    return this.profileService.generate2faSecret(user.id);
  }

  @Post('security/2fa/verify')
  @ApiOperation({ summary: 'Verificar y habilitar 2FA' })
  verifyAndEnable2fa(
    @CurrentUser() user: { id: number },
    @Body() dto: Verify2faDto,
  ) {
    return this.profileService.verifyAndEnable2fa(user.id, dto.token);
  }

  @Post('security/2fa/disable')
  @ApiOperation({ summary: 'Deshabilitar 2FA' })
  disable2fa(@CurrentUser() user: { id: number }) {
    return this.profileService.disable2fa(user.id);
  }

  @Get('security/sessions')
  @ApiOperation({ summary: 'Obtener sesiones activas' })
  getActiveSessions(@CurrentUser() user: { id: number }) {
    return this.profileService.getActiveSessions(user.id);
  }

  @Delete('security/sessions/:id')
  @ApiOperation({ summary: 'Revocar una sesión activa' })
  revokeSession(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.profileService.revokeSession(user.id, id);
  }

  @Get('security/logs')
  @ApiOperation({ summary: 'Obtener historial de accesos' })
  getAccessLogs(@CurrentUser() user: { id: number }) {
    return this.profileService.getAccessLogs(user.id);
  }
}

@ApiTags('Skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las habilidades disponibles' })
  findAll() {
    return this.profileService.findAllSkills();
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva habilidad' })
  create(@Body() dto: CreateSkillDto) {
    return this.profileService.createSkill(dto.nombre);
  }
}

@ApiTags('Objectives')
@Controller('objectives')
export class ObjectivesController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los objetivos disponibles' })
  findAll() {
    return this.profileService.findAllObjectives();
  }
}

@ApiTags('Modules')
@Controller('modules')
export class AppModulesController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los módulos disponibles' })
  findAll() {
    return this.profileService.findAllModules();
  }
}
