import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MediaService } from './media.service';

/**
 * Las imágenes de los apuntes se sirven desde MongoDB con una URL inmutable por
 * versión, igual que los avatares: el navegador puede cachearlas para siempre y
 * una imagen nueva nunca aparece con los bytes viejos.
 */
@ApiTags('Media')
@Controller('media/notes')
export class NoteImagesController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener la imagen de un apunte (cacheable por versión)' })
  @ApiParam({ name: 'id', description: 'Id de la imagen en MongoDB' })
  @ApiQuery({ name: 'v', required: false, description: 'Versión (hash) para caché inmutable' })
  async getImage(
    @Param('id') id: string,
    @Query('v') version: string | undefined,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const image = await this.media.getNoteImage(id);

    const etag = `"${image.hash}"`;
    const ifNoneMatch = String(req.headers['if-none-match'] || '');
    if (ifNoneMatch && (ifNoneMatch.includes(etag) || ifNoneMatch.includes('*'))) {
      res.status(304).end();
      return;
    }

    const isCurrentVersion = version === image.hash.slice(0, 10);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Content-Length', image.bytes);
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Cache-Control',
      isCurrentVersion ? 'private, max-age=31536000, immutable' : 'private, max-age=300',
    );

    res.end(image.data);
  }
}
