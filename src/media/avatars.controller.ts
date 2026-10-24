import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MediaService } from './media.service';

/**
 * Los avatares se sirven desde MongoDB con una URL inmutable por versión. Al
 * cambiar la foto cambia el hash, así que el navegador puede cachear para siempre
 * y nunca se muestra una imagen vieja.
 */
@ApiTags('Media')
@Controller('media/avatars')
export class AvatarsController {
  constructor(private readonly media: MediaService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Obtener la imagen de avatar (público, cacheable)' })
  @ApiParam({ name: 'id', description: 'Id de la imagen en MongoDB' })
  @ApiParam({ name: 'v', required: false, description: 'Versión (hash) para caché inmutable' })
  async getAvatar(
    @Param('id') id: string,
    @Query('v') version: string | undefined,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const image = await this.media.getAvatar(id);

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
      isCurrentVersion ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    );

    res.end(image.data);
  }
}
