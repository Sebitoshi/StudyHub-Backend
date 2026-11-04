import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IMAGE_CHUNK_BYTES, NOTE_KIND } from './media.constants';
import { MediaService } from './media.service';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(AuthGuard('jwt'))
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('images/chunk')
  @ApiOperation({
    summary: 'Subir un trozo de imagen (máx. 512 KB) para evitar el límite de Vercel',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'uploadId', required: false, description: 'Se omite en el primer trozo.' })
  @ApiQuery({ name: 'index', required: true, type: Number, example: 0 })
  @ApiQuery({ name: 'total', required: true, type: Number, example: 1 })
  @ApiQuery({ name: 'kind', required: false, example: 'avatar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_CHUNK_BYTES } }))
  uploadChunk(
    @CurrentUser() user: { id: number },
    @UploadedFile() file: Express.Multer.File,
    @Query('uploadId') uploadId?: string,
    @Query('index') index?: string,
    @Query('total') total?: string,
    @Query('kind') kind?: string,
  ) {
    if (!file) throw new BadRequestException('Falta el trozo de la imagen.');
    return this.media.saveChunk(user.id, {
      uploadId: uploadId || null,
      index: Number(index),
      total: Number(total),
      kind,
      buffer: file.buffer,
    });
  }

  @Post('images/:uploadId/complete')
  @ApiOperation({
    summary: 'Unir los trozos, validar la imagen y guardarla como avatar en MongoDB',
  })
  @ApiResponse({ status: 201, description: 'Avatar guardado; devuelve la ruta de la API' })
  complete(@CurrentUser() user: { id: number }, @Param('uploadId') uploadId: string) {
    return this.media.completeAvatar(user.id, uploadId);
  }

  @Delete('images/:uploadId')
  @ApiOperation({ summary: 'Cancelar una subida de imagen y descartar sus trozos' })
  cancel(@CurrentUser() user: { id: number }, @Param('uploadId') uploadId: string) {
    return this.media.cancel(user.id, uploadId);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Eliminar la foto de perfil guardada' })
  removeAvatar(@CurrentUser() user: { id: number }) {
    return this.media.removeAvatar(user.id);
  }

  // ─── Imágenes de apuntes ────────────────────────────────

  @Post('notes/images/chunk')
  @ApiOperation({
    summary: 'Subir un trozo de imagen para un apunte (máx. 512 KB) y evitar el límite de Vercel',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'uploadId', required: false, description: 'Se omite en el primer trozo.' })
  @ApiQuery({ name: 'index', required: true, type: Number, example: 0 })
  @ApiQuery({ name: 'total', required: true, type: Number, example: 1 })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_CHUNK_BYTES } }))
  uploadNoteChunk(
    @CurrentUser() user: { id: number },
    @UploadedFile() file: Express.Multer.File,
    @Query('uploadId') uploadId?: string,
    @Query('index') index?: string,
    @Query('total') total?: string,
  ) {
    if (!file) throw new BadRequestException('Falta el trozo de la imagen.');
    return this.media.saveChunk(user.id, {
      uploadId: uploadId || null,
      index: Number(index),
      total: Number(total),
      kind: NOTE_KIND,
      buffer: file.buffer,
    });
  }

  @Post('notes/images/:uploadId/complete')
  @ApiOperation({ summary: 'Unir los trozos y guardar la imagen del apunte en MongoDB' })
  @ApiQuery({ name: 'subjectId', required: true, type: Number, description: 'Materia del apunte' })
  @ApiQuery({
    name: 'noteId',
    required: false,
    type: Number,
    description: 'Apunte al que pertenece; si se omite, se liga al guardar la nota.',
  })
  @ApiResponse({ status: 201, description: 'Imagen guardada; devuelve id, url y dimensiones' })
  completeNoteImage(
    @CurrentUser() user: { id: number },
    @Param('uploadId') uploadId: string,
    @Query('subjectId') subjectId?: string,
    @Query('noteId') noteId?: string,
  ) {
    const subject = Number(subjectId);
    if (!Number.isInteger(subject) || subject < 1) {
      throw new BadRequestException('Falta la materia de la imagen.');
    }
    const note = noteId === undefined || noteId === '' ? null : Number(noteId);
    if (note !== null && (!Number.isInteger(note) || note < 1)) {
      throw new BadRequestException('El apunte indicado no es válido.');
    }
    return this.media.completeNoteImage(user.id, uploadId, { subjectId: subject, noteId: note });
  }

  @Delete('notes/images/:imageId')
  @ApiOperation({ summary: 'Eliminar una imagen de apunte' })
  removeNoteImage(@CurrentUser() user: { id: number }, @Param('imageId') imageId: string) {
    return this.media.deleteNoteImage(user.id, imageId);
  }
}
