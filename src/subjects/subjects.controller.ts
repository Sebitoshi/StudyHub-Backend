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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  create(
    @CurrentUser() user: { id: number },
    @Body() dto: CreateSubjectDto,
  ) {
    return this.subjectsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las materias del usuario' })
  findAll(@CurrentUser() user: { id: number }) {
    return this.subjectsService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una materia con sus horarios, tareas y notas' })
  findOne(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una materia' })
  update(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una materia' })
  remove(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.remove(id, user.id);
  }

  // ─── Schedules ────────────────────────────────────

  @Post(':id/schedules')
  @ApiOperation({ summary: 'Agregar horario a una materia' })
  createSchedule(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.subjectsService.createSchedule(id, user.id, dto);
  }

  @Get(':id/schedules')
  @ApiOperation({ summary: 'Obtener horarios de una materia' })
  findSchedules(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findSchedules(id, user.id);
  }

  @Put(':id/schedules/:scheduleId')
  @ApiOperation({ summary: 'Actualizar un horario' })
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
  createTask(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.subjectsService.createTask(id, user.id, dto);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Obtener tareas de una materia' })
  findTasks(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findTasks(id, user.id);
  }

  @Put(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Actualizar una tarea' })
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
  toggleTask(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.subjectsService.toggleTaskStatus(taskId, id, user.id);
  }

  @Delete(':id/tasks/:taskId')
  @ApiOperation({ summary: 'Eliminar una tarea' })
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
  createNote(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateNoteDto,
  ) {
    return this.subjectsService.createNote(id, user.id, dto);
  }

  @Get(':id/notes')
  @ApiOperation({ summary: 'Obtener notas de una materia' })
  findNotes(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subjectsService.findNotes(id, user.id);
  }

  @Put(':id/notes/:noteId')
  @ApiOperation({ summary: 'Actualizar una nota' })
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
  togglePin(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.subjectsService.togglePinNote(noteId, id, user.id);
  }

  @Delete(':id/notes/:noteId')
  @ApiOperation({ summary: 'Eliminar una nota' })
  removeNote(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Param('noteId', ParseIntPipe) noteId: number,
  ) {
    return this.subjectsService.removeNote(noteId, id, user.id);
  }
}
