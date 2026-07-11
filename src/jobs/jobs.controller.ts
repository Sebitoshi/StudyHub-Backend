import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, DefaultValuePipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { JobSyncService } from './job-sync.service';
import { JobDiscoveryService } from './job-discovery.service';
import { ApplyJobDto } from './dto/apply-job.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { JobMatchingService } from '../ai/job-matching/job-matching.service';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(AuthGuard('jwt'))
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly jobMatchingService: JobMatchingService,
    private readonly jobSyncService: JobSyncService,
    private readonly jobDiscoveryService: JobDiscoveryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar empleos con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Lista de empleos paginada',
    content: {
      'application/json': {
        example: {
          jobs: [
            {
              id: 1,
              title: 'Backend Developer',
              company: 'TechCorp',
              location: 'Bogotá',
              salaryMin: 30000,
              salaryMax: 50000,
              seniority: 'JUNIOR',
              isRemote: true,
              contractType: 'Full-Time',
              skills: ['NestJS', 'PostgreSQL', 'TypeScript'],
              publishedAt: '2026-06-20T00:00:00.000Z',
            },
          ],
          total: 45,
          page: 1,
          limit: 20,
        },
      },
    },
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'publishedAt' })
  @ApiQuery({ name: 'order', required: false, type: String, example: 'desc' })
  @ApiQuery({ name: 'isRemote', required: false, type: Boolean })
  @ApiQuery({ name: 'contractType', required: false, type: String })
  @ApiQuery({ name: 'salaryMin', required: false, type: Number })
  @ApiQuery({ name: 'salaryMax', required: false, type: Number })
  @ApiQuery({ name: 'seniority', required: false, type: String })
  @ApiQuery({ name: 'skills', required: false, type: String, description: 'Separados por coma' })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'country', required: false, type: String, description: 'Filtrar por país' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filtrar por ciudad' })
  @ApiQuery({ name: 'company', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general por título, empresa o skills' })
  @ApiQuery({ name: 'modality', required: false, type: String, description: 'ON_SITE | REMOTE | HYBRID' })
  @ApiQuery({ name: 'studentFriendly', required: false, type: Boolean, description: 'Solo empleos compatibles con estudios' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
    @Query('isRemote') isRemote?: string,
    @Query('contractType') contractType?: string,
    @Query('salaryMin') salaryMin?: string,
    @Query('salaryMax') salaryMax?: string,
    @Query('seniority') seniority?: string,
    @Query('skills') skills?: string,
    @Query('location') location?: string,
    @Query('country') country?: string,
    @Query('city') city?: string,
    @Query('company') company?: string,
    @Query('search') search?: string,
    @Query('modality') modality?: string,
    @Query('studentFriendly') studentFriendly?: string,
  ) {
    return this.jobsService.findAll({
      page,
      limit,
      sortBy,
      order,
      isRemote: isRemote ? isRemote === 'true' : undefined,
      contractType,
      salaryMin: salaryMin ? Number(salaryMin) : undefined,
      salaryMax: salaryMax ? Number(salaryMax) : undefined,
      seniority,
      skills: skills ? skills.split(',').map(s => s.trim()) : undefined,
      location,
      country,
      city,
      company,
      search,
      modality,
      studentFriendly: studentFriendly ? studentFriendly === 'true' : undefined,
    });
  }

  @Get('saved')
  @ApiOperation({ summary: 'Obtener empleos guardados' })
  @ApiResponse({ status: 200, description: 'Empleos guardados del usuario' })
  getSavedJobs(@CurrentUser() user: { id: number }) {
    return this.jobsService.getSavedJobs(user.id);
  }

  @Get('applications')
  @ApiOperation({ summary: 'Obtener postulaciones a empleos' })
  @ApiResponse({ status: 200, description: 'Postulaciones del usuario' })
  getApplications(@CurrentUser() user: { id: number }) {
    return this.jobsService.getApplications(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un empleo' })
  @ApiResponse({ status: 200, description: 'Detalle del empleo' })
  @ApiResponse({ status: 404, description: 'Empleo no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.findOne(id);
  }

  @Post(':id/save')
  @ApiOperation({ summary: 'Guardar empleo' })
  @ApiResponse({ status: 201, description: 'Empleo guardado exitosamente' })
  @ApiResponse({ status: 404, description: 'Empleo no encontrado' })
  saveJob(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.jobsService.saveJob(user.id, id);
  }

  @Delete(':id/save')
  @ApiOperation({ summary: 'Quitar guardado de empleo' })
  @ApiResponse({ status: 200, description: 'Empleo removido de guardados' })
  @ApiResponse({ status: 404, description: 'Empleo no encontrado' })
  unsaveJob(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.jobsService.unsaveJob(user.id, id);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Postularse a un empleo' })
  @ApiResponse({ status: 201, description: 'Postulación creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Ya postulado o datos inválidos' })
  @ApiResponse({ status: 404, description: 'Empleo no encontrado' })
  applyToJob(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApplyJobDto,
  ) {
    return this.jobsService.applyToJob(user.id, id, dto.notes);
  }

  @Delete(':id/apply')
  @ApiOperation({ summary: 'Eliminar/retirar postulación' })
  @ApiResponse({ status: 200, description: 'Postulación eliminada' })
  @ApiResponse({ status: 404, description: 'Postulación no encontrada' })
  withdrawApplication(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.jobsService.withdrawApplication(user.id, id);
  }

  @Patch(':id/apply/status')
  @ApiOperation({ summary: 'Actualizar estado de una postulación' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({ status: 404, description: 'Postulación no encontrada' })
  updateApplicationStatus(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.jobsService.updateApplicationStatus(user.id, id, dto.status);
  }

  @Get(':id/match')
  @ApiOperation({ summary: 'Calcular coincidencia de perfil con empleo usando IA' })
  @ApiResponse({ status: 200, description: 'Resultado del match con IA' })
  @ApiResponse({ status: 404, description: 'Empleo o perfil no encontrado' })
  getJobMatch(@CurrentUser() user: { id: number }, @Param('id', ParseIntPipe) id: number) {
    return this.jobMatchingService.calculateMatch(user.id, id);
  }

  @Post('discover')
  @ApiOperation({ summary: 'Descubrir empleos desde tu perfil (skills, cargo, ubicación)' })
  @ApiResponse({ status: 201, description: 'Búsqueda completada' })
  discover(@CurrentUser() user: { id: number }) {
    return this.jobDiscoveryService.discoverFromProfile(user.id);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincronizar empleos desde fuentes externas (Arbeitnow, RemoteOK, Jobicy)' })
  @ApiResponse({ status: 201, description: 'Sincronización completada' })
  syncJobs() {
    return this.jobSyncService.syncAllManual();
  }
}
