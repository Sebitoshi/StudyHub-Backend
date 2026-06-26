import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { KnowledgeGapsService } from './knowledge-gaps/knowledge-gaps.service';
import { GeneratedResourcesService } from './generated-resources/generated-resources.service';
import { LearningGoalsService } from './learning-goals/learning-goals.service';
import { TeacherProfileService } from './teacher-profiles/teacher-profile.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateKnowledgeGapDto } from './dto/update-knowledge-gap.dto';
import { CompleteGeneratedResourceDto } from './dto/complete-generated-resource.dto';
import { CreateLearningGoalDto } from './dto/create-learning-goal.dto';
import { UpdateLearningGoalDto } from './dto/update-learning-goal.dto';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { ObjectId } from 'mongodb';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly knowledgeGaps: KnowledgeGapsService,
    private readonly generatedResources: GeneratedResourcesService,
    private readonly learningGoals: LearningGoalsService,
    private readonly teacherProfiles: TeacherProfileService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Enviar mensaje al asistente IA' })
  @ApiBody({ type: ChatDto })
  @ApiResponse({ status: 201, description: 'Respuesta generada por el asistente IA' })
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    const userId = req.user.id;
    const res = await this.ai.chat(userId, dto.conversationId, dto.message, dto.teacherId);
    return res;
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Enviar mensaje y recibir respuesta en streaming (SSE)' })
  @ApiBody({ type: ChatDto })
  @ApiResponse({ status: 201, description: 'Stream SSE iniciado correctamente' })
  async streamChat(@Req() req: any, @Res() res: Response, @Body() dto: ChatDto) {
    const userId = req.user.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    try {
      await this.ai.streamChat(userId, dto.conversationId, dto.message, dto.teacherId, async (chunk: string) => {
        if (closed) return;
        const payload = chunk.replace(/\n/g, '\n');
        res.write(`event: message\ndata: ${payload}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      });

      if (!closed) {
        res.write('event: done\ndata: true\n\n');
        res.end();
      }
    } catch (err) {
      if (!closed) {
        res.write(`event: error\ndata: ${String(err)}\n\n`);
        res.end();
      }
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard de progreso del estudiante con IA' })
  async getDashboard(@Req() req: any) {
    const userId = req.user.id;
    return this.ai.getDashboard(userId);
  }

  @Get('resources')
  @ApiOperation({ summary: 'Listar recursos académicos generados por la IA' })
  @ApiQuery({ name: 'type', required: false, example: 'QUIZ' })
  async listResources(@Req() req: any, @Query('type') type?: string) {
    const userId = req.user.id;
    const resources = await this.generatedResources.listResourcesForUser(userId, type);
    return { resources };
  }

  @Get('resources/:id')
  @ApiOperation({ summary: 'Obtener un recurso generado con su contenido completo' })
  @ApiParam({ name: 'id', example: '64f1a2b3c4d5e6f789012345' })
  async getResource(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const resource = await this.generatedResources.getByIdForUser(userId, id);
    return { resource };
  }

  @Patch('resources/:id/complete')
  @ApiOperation({ summary: 'Marcar recurso generado como completado' })
  @ApiParam({ name: 'id', example: '64f1a2b3c4d5e6f789012345' })
  @ApiBody({ type: CompleteGeneratedResourceDto })
  async completeResource(@Req() req: any, @Param('id') id: string, @Body() dto: CompleteGeneratedResourceDto) {
    const userId = req.user.id;
    const resource = await this.generatedResources.completeForUser(userId, id, dto);
    await this.knowledgeGaps.onResourceCompleted(userId, resource);
    return {
      ok: true,
      resource: {
        id: String(resource?.id || resource?._id || id),
        completed: true,
        completedAt: resource?.completedAt || null,
        resultScore: resource?.resultScore ?? null,
        resultCorrect: resource?.resultCorrect ?? null,
        resultTotal: resource?.resultTotal ?? null,
      },
    };
  }

  @Delete('resources/:id')
  @ApiOperation({ summary: 'Eliminar un recurso generado' })
  @ApiParam({ name: 'id', example: '64f1a2b3c4d5e6f789012345' })
  async deleteResource(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.generatedResources.deleteForUser(userId, id);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Crear meta de aprendizaje' })
  @ApiBody({ type: CreateLearningGoalDto })
  async createGoal(@Req() req: any, @Body() dto: CreateLearningGoalDto) {
    const userId = req.user.id;
    const goal = await this.learningGoals.createGoal(
      userId,
      dto.title,
      dto.description || '',
      dto.targetDate ? new Date(dto.targetDate) : undefined,
    );
    return { goal };
  }

  @Get('goals')
  @ApiOperation({ summary: 'Listar metas de aprendizaje del estudiante' })
  async listGoals(@Req() req: any) {
    const userId = req.user.id;
    const goals = await this.learningGoals.listGoals(userId);
    return { goals };
  }

  @Patch('goals/:id')
  @ApiOperation({ summary: 'Actualizar meta de aprendizaje' })
  @ApiParam({ name: 'id', example: '64f1a2b3c4d5e6f789012345' })
  @ApiBody({ type: UpdateLearningGoalDto })
  async updateGoal(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLearningGoalDto) {
    const userId = req.user.id;
    const patch: any = {};
    for (const [key, val] of Object.entries(dto)) {
      if (val !== undefined) patch[key] = val;
    }
    if (patch.targetDate) patch.targetDate = new Date(patch.targetDate);
    const goal = await this.learningGoals.updateGoalForUser(userId, id, patch);
    return { goal };
  }

  @Delete('goals/:id')
  @ApiOperation({ summary: 'Eliminar meta de aprendizaje' })
  @ApiParam({ name: 'id', example: '64f1a2b3c4d5e6f789012345' })
  async deleteGoal(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.learningGoals.deleteGoalForUser(userId, id);
  }

  @Get('teacher-profiles')
  @ApiOperation({ summary: 'Listar perfiles de profesor IA (sistema + personalizados)' })
  async listTeacherProfiles(@Req() req: any) {
    const userId = req.user.id;
    const profiles = await this.teacherProfiles.listProfiles(userId);
    return { profiles };
  }

  @Post('teacher-profiles')
  @ApiOperation({ summary: 'Crear perfil de profesor IA personalizado' })
  @ApiBody({ type: CreateTeacherProfileDto })
  async createTeacherProfile(@Req() req: any, @Body() dto: CreateTeacherProfileDto) {
    const userId = req.user.id;
    const profile = await this.teacherProfiles.createProfile(userId, dto);
    return { profile };
  }

  @Patch('teacher-profiles/:id')
  @ApiOperation({ summary: 'Actualizar perfil de profesor IA personalizado' })
  @ApiParam({ name: 'id', example: '64f1a2b3c4d5e6f789012345' })
  @ApiBody({ type: UpdateTeacherProfileDto })
  async updateTeacherProfile(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTeacherProfileDto) {
    const userId = req.user.id;
    const profile = await this.teacherProfiles.updateProfile(userId, id, dto);
    return { profile };
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Crear conversación vacía para el usuario' })
  @ApiResponse({ status: 201, description: 'Conversación creada correctamente' })
  async createConversation(@Req() req: any) {
    const userId = req.user.id;
    const conv = await this.ai.ensureConversation(userId);
    return conv;
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Listar conversaciones del usuario' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'lastMessageAt' })
  @ApiQuery({ name: 'order', required: false, type: String, example: 'desc' })
  async listConversations(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
  ) {
    const userId = req.user.id;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const sortField = sortBy || 'lastMessageAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const [convs, total] = await Promise.all([
      this.ai['conversations'].find({ userId }).sort({ [sortField]: sortOrder }).skip(skip).limit(limitNum).toArray(),
      this.ai['conversations'].countDocuments({ userId }),
    ]);
    return { conversations: convs, total, page: pageNum, limit: limitNum };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Obtener conversación y mensajes' })
  @ApiParam({ name: 'id', description: 'ID de la conversación en MongoDB', example: '64f1a2b3c4d5e6f789012345' })
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const conv = await this.ai['conversations'].findOne({ _id: new ObjectId(id) });
    if (!conv) return { error: 'not found' };
    if (conv.userId !== userId) return { error: 'forbidden' };
    const messages = await this.ai['messages'].find({ conversationId: conv._id }).sort({ createdAt: 1 }).toArray();
    return { conversation: conv, messages };
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Eliminar conversación y sus mensajes' })
  @ApiParam({ name: 'id', description: 'ID de la conversación en MongoDB', example: '64f1a2b3c4d5e6f789012345' })
  async deleteConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const conv = await this.ai['conversations'].findOne({ _id: new ObjectId(id) });
    if (!conv) return { error: 'not found' };
    if (conv.userId !== userId) return { error: 'forbidden' };
    await this.ai['messages'].deleteMany({ conversationId: conv._id });
    await this.ai['conversations'].deleteOne({ _id: conv._id });
    return { ok: true };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Obtener mensajes de una conversación' })
  @ApiParam({ name: 'id', description: 'ID de la conversación en MongoDB', example: '64f1a2b3c4d5e6f789012345' })
  async getConversationMessages(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    const conv = await this.ai['conversations'].findOne({ _id: new ObjectId(id) });
    if (!conv) return { error: 'not found' };
    if (conv.userId !== userId) return { error: 'forbidden' };
    const messages = await this.ai['messages'].find({ conversationId: conv._id }).sort({ createdAt: 1 }).toArray();
    return { messages };
  }

  @Get('knowledge-gaps')
  @ApiOperation({ summary: 'Listar knowledge gaps detectados' })
  async listKnowledgeGaps(@Req() req: any) {
    const userId = req.user.id;
    const gaps = await this.knowledgeGaps.list(userId);
    return { gaps };
  }

  @Get('knowledge-gaps/:subject')
  @ApiOperation({ summary: 'Listar knowledge gaps por materia' })
  @ApiParam({ name: 'subject', description: 'Nombre de la materia', example: 'Cálculo diferencial' })
  async listKnowledgeGapsBySubject(@Req() req: any, @Param('subject') subject: string) {
    const userId = req.user.id;
    const gaps = await this.knowledgeGaps.listBySubject(userId, subject);
    return { gaps };
  }

  @Patch('knowledge-gaps/:id')
  @ApiOperation({ summary: 'Actualizar estado de un knowledge gap' })
  @ApiParam({ name: 'id', description: 'ID del knowledge gap en MongoDB', example: '64f1a2b3c4d5e6f789012345' })
  @ApiBody({ type: UpdateKnowledgeGapDto })
  async patchKnowledgeGap(@Req() req: any, @Param('id') id: string, @Body() body: UpdateKnowledgeGapDto) {
    const userId = req.user.id;
    const gap = await this.knowledgeGaps.patch(id, body);
    return { gap };
  }
}
