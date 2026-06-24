import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@ApiTags('Subjects')
@ApiBearerAuth()
@Controller('subjects')
@UseGuards(AuthGuard('jwt'))
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  // ─── Subjects ─────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Crear una materia' })
  @ApiResponse({ status: 201, description: 'Recurso creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateSubjectDto,
  ) {
    return this.subjectsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las materias del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de recursos' })
  findAll(@CurrentUser() user: { id: number }) {
    return this.subjectsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una materia con sus horarios, tareas y notas' })
  @ApiResponse({ status: 200, description: 'Detalle del recurso' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  findOne(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una materia' })
  @ApiResponse({ status: 200, description: 'Recurso actualizado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  update(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una materia' })
  @ApiResponse({ status: 200, description: 'Recurso eliminado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  remove(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.remove(id, user.id);
  }

  // ─── Schedules ────────────────────────────────────

  @Post(':id/schedules')
  @ApiOperation({ summary: 'Agregar horario a una materia' })
  @ApiResponse({ status: 201, description: 'Recurso creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  createSchedule(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.subjectsService.createSchedule(id, user.id, dto);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: 'Obtener horarios de una materia' })
  @ApiResponse({ status: 200, description: 'Lista de recursos' })
  findSchedules(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findSchedules(id, user.id);
  }

  @Put(':id/schedules/:scheduleId')
  @ApiOperation({ summary: 'Actualizar un horario' })
  @ApiResponse({ status: 200, description: 'Recurso actualizado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  updateSchedule(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.subjectsService.updateSchedule(scheduleId, id, user.id, dto);
  }

  @Delete(':id/schedules/:scheduleId')
  @ApiOperation({ summary: 'Eliminar un horario' })
  @ApiResponse({ status: 200, description: 'Recurso eliminado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  removeSchedule(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ) {
    return this.subjectsService.removeSchedule(scheduleId, id, user.id);
  }

  // ─── Tasks ────────────────────────────────────────

  @Post(':id/tasks')
  @ApiOperation({ summary: 'Crear tarea en una materia' })
  @ApiResponse({ status: 201, description: 'Recurso creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  createTask(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.subjectsService.createTask(id, user.id, dto);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Obtener tareas de una materia' })
  @ApiResponse({ status: 200, description: 'Lista de recursos' })
  findTasks(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findTasks(id, user.id);
  }

  @Put(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Actualizar una tarea' })
  @ApiResponse({ status: 200, description: 'Recurso actualizado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  updateTask(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.subjectsService.updateTask(taskId, id, user.id, dto);
  }

  @Post(':id/tasks/:taskId/toggle')
  @ApiOperation({ summary: 'Marcar/desmarcar tarea como completada' })
  @ApiResponse({ status: 200, description: 'Acción realizada exitosamente' })
  toggleTask(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.subjectsService.toggleTaskStatus(taskId, id, user.id);
  }

  @Delete(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Eliminar una tarea' })
  @ApiResponse({ status: 200, description: 'Recurso eliminado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  removeTask(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.subjectsService.removeTask(taskId, id, user.id);
  }

  // ─── Notes ────────────────────────────────────────

  @Post(':id/notes')
  @ApiOperation({ summary: 'Crear nota en una materia' })
  @ApiResponse({ status: 201, description: 'Recurso creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  createNote(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateNoteDto,
  ) {
    return this.subjectsService.createNote(id, user.id, dto);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Obtener notas de una materia' })
  @ApiResponse({ status: 200, description: 'Lista de recursos' })
  findNotes(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findNotes(id, user.id);
  }

  @Put(':id/notes/:noteId')
  @ApiOperation({ summary: 'Actualizar una nota' })
  @ApiResponse({ status: 200, description: 'Recurso actualizado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  updateNote(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.subjectsService.updateNote(noteId, id, user.id, dto);
  }

  @Post(':id/notes/:noteId/pin')
  @ApiOperation({ summary: 'Fijar/desfijar una nota' })
  @ApiResponse({ status: 200, description: 'Acción realizada exitosamente' })
  togglePin(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.subjectsService.togglePinNote(noteId, id, user.id);
  }

  @Delete(':id/notes/:noteId')
  @ApiOperation({ summary: 'Eliminar una nota' })
  @ApiResponse({ status: 200, description: 'Recurso eliminado' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado' })
  removeNote(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.subjectsService.removeNote(noteId, id, user.id);
  }
}
