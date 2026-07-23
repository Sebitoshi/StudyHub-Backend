import { Body, Controller, Get, Logger, Param, Post, Put, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import { ResumeService } from './resume.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Resume')
@Controller('resume')
export class ResumeController {
  private readonly logger = new Logger(ResumeController.name);

  constructor(private service: ResumeService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener mi CV' })
  @ApiResponse({
    status: 200,
    description: 'CV del usuario autenticado',
    content: {
      'application/json': {
        example: {
          id: 1,
          userId: 1,
          titulo: 'Desarrollador Backend Junior',
          resumen: 'Desarrollador enfocado en APIs con NestJS.',
          slug: 'juan-perez-1712345678',
          experiences: [{ id: 1, company: 'TechCorp', position: 'Dev Backend', startDate: '2024-02-01', isCurrent: true }],
          educations: [{ id: 1, institution: 'Universidad Nacional', degree: 'Ing. Sistemas', startDate: '2022-01-15', isCurrent: true }],
          projects: [{ id: 1, title: 'Study Hub', description: 'Plataforma académica', technologies: ['NestJS', 'React'] }],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'CV no encontrado' })
  findMyResume(@CurrentUser() user: { id: number }) {
    return this.service.findByUser(user.id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear mi CV' })
  @ApiResponse({ status: 201, description: 'CV creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateResumeDto) {
    return this.service.create(user.id, dto);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar mi CV' })
  @ApiResponse({ status: 200, description: 'CV actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'CV no encontrado' })
  update(@CurrentUser() user: { id: number }, @Body() dto: UpdateResumeDto) {
    return this.service.update(user.id, dto);
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Obtener CV público por slug' })
  @ApiResponse({ status: 200, description: 'CV público encontrado' })
  @ApiResponse({ status: 404, description: 'CV no encontrado' })
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(':userId/pdf')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Descargar CV en PDF' })
  @ApiResponse({ status: 200, description: 'Archivo PDF del CV' })
  async pdf(
    @Param('userId') userId: string,
    @CurrentUser() user: { id: number },
    @Res() res: Response,
  ) {
    const resume = await this.service.findByUser(Number(userId));
    if (resume.userId !== user.id) {
      throw new ForbiddenException();
    }

    const buffer = await this.service.generatePdf(Number(userId));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="resume-${userId}.pdf"`);
    res.send(buffer);
  }
}
