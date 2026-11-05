import {
  BadRequestException,
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
import { IMAGE_CHUNK_BYTES, NOTE_FILE_KIND } from './media.constants';
import { MediaService } from './media.service';

/**
 * PDFs de los apuntes. Se suben en trozos de 512 KB (Vercel corta los cuerpos
 * grandes), se guardan en MongoDB y se sirven con URL inmutable: `GET
 * /media/notes/files/:id` (en NoteImagesController, sin guard, para poder
 * abrirlos desde un enlace o un iframe).
 */
@ApiTags('Media')
@ApiBearerAuth()
@Controller('media/notes/files')
@UseGuards(AuthGuard('jwt'))
export class NoteFilesController {
  constructor(private readonly media: MediaService) {}

  @Post('chunk')
  @ApiOperation({ summary: 'Subir un trozo de PDF (máx. 512 KB)' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'uploadId', required: false, description: 'Se omite en el primer trozo.' })
  @ApiQuery({ name: 'index', required: true, type: Number, example: 0 })
  @ApiQuery({ name: 'total', required: true, type: Number, example: 3 })
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
  ) {
    if (!file) throw new BadRequestException('Falta el trozo del PDF.');
    return this.media.saveChunk(user.id, {
      uploadId: uploadId || null,
      index: Number(index),
      total: Number(total),
      kind: NOTE_FILE_KIND,
      buffer: file.buffer,
    });
  }

  @Post(':uploadId/complete')
  @ApiOperation({ summary: 'Unir los trozos y guardar el PDF del apunte en MongoDB' })
  @ApiQuery({ name: 'subjectId', required: true, type: Number, description: 'Materia del apunte' })
  @ApiQuery({
    name: 'noteId',
    required: false,
    type: Number,
    description: 'Apunte al que pertenece; si se omite, se liga al guardar la nota.',
  })
  @ApiQuery({ name: 'filename', required: false, description: 'Nombre visible del PDF' })
  @ApiResponse({ status: 201, description: 'PDF guardado; devuelve id, url y nombre' })
  complete(
    @CurrentUser() user: { id: number },
    @Param('uploadId') uploadId: string,
    @Query('subjectId') subjectId?: string,
    @Query('noteId') noteId?: string,
    @Query('filename') filename?: string,
  ) {
    const subject = Number(subjectId);
    if (!Number.isInteger(subject) || subject < 1) {
      throw new BadRequestException('Falta la materia del PDF.');
    }
    const note = noteId === undefined || noteId === '' ? null : Number(noteId);
    if (note !== null && (!Number.isInteger(note) || note < 1)) {
      throw new BadRequestException('El apunte indicado no es válido.');
    }
    return this.media.completeNoteFile(user.id, uploadId, {
      subjectId: subject,
      noteId: note,
      filename,
    });
  }

  @Delete(':fileId')
  @ApiOperation({ summary: 'Eliminar un PDF de apunte' })
  remove(@CurrentUser() user: { id: number }, @Param('fileId') fileId: string) {
    return this.media.deleteNoteFile(user.id, fileId);
  }

  @Delete('uploads/:uploadId')
  @ApiOperation({ summary: 'Cancelar una subida de PDF y descartar sus trozos' })
  cancelUpload(@CurrentUser() user: { id: number }, @Param('uploadId') uploadId: string) {
    return this.media.cancel(user.id, uploadId);
  }
}
