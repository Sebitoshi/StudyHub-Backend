import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StudyGroupsService } from './study-groups.service';
import { GroupRecommendationService } from './group-recommendation.service';
import { GroupChatService } from './group-chat.service';
import { GroupChatGateway } from './group-chat.gateway';
import { CloudinaryService } from './cloudinary.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateSessionDto } from './dto/create-session.dto';

@ApiTags('Study Groups')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('groups')
export class StudyGroupsController {
  constructor(
    private readonly groupsService: StudyGroupsService,
    private readonly recommendationService: GroupRecommendationService,
    private readonly chatService: GroupChatService,
    private readonly chatGateway: GroupChatGateway,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear grupo de estudio' })
  @ApiResponse({ status: 201, description: 'Grupo creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  create(@CurrentUser() user: { id: number }, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar grupos públicos' })
  @ApiResponse({ status: 200, description: 'Lista de grupos públicos paginada' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, type: String, example: 'desc' })
  findAll(
    @CurrentUser() _user: { id: number },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: string,
  ) {
    return this.groupsService.findAll(
      0,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      sortBy,
      order,
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'Grupos del usuario' })
  @ApiResponse({ status: 200, description: 'Grupos del usuario' })
  getMyGroups(@CurrentUser() user: { id: number }) {
    return this.groupsService.getMyGroups(user.id);
  }

  @Get('recommended')
  @ApiOperation({ summary: 'Grupos recomendados según perfil académico' })
  @ApiResponse({ status: 200, description: 'Grupos recomendados por IA' })
  getRecommended(@CurrentUser() user: { id: number }) {
    return this.recommendationService.getRecommendations(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del grupo' })
  @ApiResponse({ status: 200, description: 'Detalle del grupo' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  findOne(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupsService.findOne(id, user.id);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Unirse al grupo' })
  @ApiResponse({ status: 200, description: 'Unido al grupo exitosamente' })
  @ApiResponse({ status: 400, description: 'Ya eres miembro o grupo lleno' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  join(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password?: string },
  ) {
    return this.groupsService.join(id, user.id, body?.password);
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Salirse del grupo' })
  @ApiResponse({ status: 200, description: 'Saliste del grupo' })
  @ApiResponse({ status: 400, description: 'No eres miembro del grupo' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  leave(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupsService.leave(id, user.id);
  }

  @Post(':id/sessions')
  @ApiOperation({ summary: 'Crear sesión de estudio' })
  @ApiResponse({ status: 201, description: 'Sesión creada' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  createSession(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSessionDto,
  ) {
    return this.groupsService.createSession(id, user.id, dto);
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'Listar sesiones del grupo' })
  @ApiResponse({ status: 200, description: 'Sesiones del grupo' })
  @ApiResponse({ status: 404, description: 'Grupo no encontrado' })
  getSessions(
    @CurrentUser() _user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupsService.getSessions(id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Obtener historial de mensajes del chat' })
  getMessages(@Param('id', ParseIntPipe) id: number) {
    return this.chatService.getMessages(id);
  }

  @Post(':id/messages/image')
  @ApiOperation({ summary: 'Subir imagen al chat del grupo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No file provided');
    const imageUrl = await this.cloudinaryService.uploadImage(file);
    const message = await this.chatService.saveMessage(
      id,
      user.id,
      undefined,
      imageUrl,
    );
    this.chatGateway.emitImageMessage(id, message);
    return message;
  }
}
