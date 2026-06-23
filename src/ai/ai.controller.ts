import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { KnowledgeGapsService } from './knowledge-gaps/knowledge-gaps.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateKnowledgeGapDto } from './dto/update-knowledge-gap.dto';
import { ObjectId } from 'mongodb';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService, private readonly knowledgeGaps: KnowledgeGapsService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Enviar mensaje al asistente IA' })
  @ApiBody({ type: ChatDto })
  @ApiResponse({ status: 201, description: 'Respuesta generada por el asistente IA' })
  async chat(@Req() req: any, @Body() dto: ChatDto) {
    const userId = req.user.id;
    const res = await this.ai.chat(userId, dto.conversationId as any, dto.message, dto.teacherId);
    return res;
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Enviar mensaje y recibir respuesta en streaming (SSE)' })
  @ApiBody({ type: ChatDto })
  @ApiResponse({ status: 201, description: 'Stream SSE iniciado correctamente' })
  async streamChat(@Req() req: any, @Res() res: Response, @Body() dto: ChatDto) {
    const userId = req.user.id;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    try {
      await this.ai.streamChat(userId, dto.conversationId as any, dto.message, dto.teacherId, async (chunk: string) => {
        if (closed) return;
        // Escape newlines per SSE
        const payload = chunk.replace(/\n/g, '\n');
        res.write(`event: message\ndata: ${payload}\n\n`);
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
  async listConversations(@Req() req: any) {
    const userId = req.user.id;
    const convs = await this.ai['conversations'].find({ userId }).sort({ lastMessageAt: -1 }).toArray();
    return convs;
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
