import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { DocumentTextService } from '../document-text.service';
import { CHUNK_SIZE_BYTES, MAX_CHUNKS, UploadsRepository } from './uploads.repository';

export interface UploadChunkInput {
  uploadId?: string | null;
  index?: number;
  total?: number;
  filename?: string;
  mimetype?: string;
  buffer: Buffer;
}

export interface UploadProgress {
  uploadId: string;
  received: number;
  total: number;
  chunkSize: number;
  complete: boolean;
}

export interface AssembledDocument {
  text: string;
  topic: string;
  filename: string;
  bytes: number;
}

/**
 * Subidas por trozos para documentos grandes.
 *
 * Cada trozo viaja en su propia petición (por debajo del límite de cuerpo de la
 * plataforma) y se guarda en MongoDB asociado a una sesión de subida. Al pedir el
 * recurso, se juntan los trozos, se extrae el texto con `DocumentTextService` y la
 * subida se borra.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly repo: UploadsRepository,
    private readonly documents: DocumentTextService,
  ) {}

  /** Guarda un trozo del documento y devuelve el progreso de la subida. */
  async saveChunk(userId: number, input: UploadChunkInput): Promise<UploadProgress> {
    const buffer = input.buffer;
    if (!buffer?.length) {
      throw new BadRequestException('El trozo llegó vacío. Vuelve a intentarlo.');
    }
    if (buffer.length > CHUNK_SIZE_BYTES * 2) {
      throw new BadRequestException('El trozo es demasiado grande.');
    }

    const index = Math.max(0, Number(input.index) || 0);
    const total = Math.min(MAX_CHUNKS, Math.max(1, Number(input.total) || 1));

    let session = input.uploadId ? await this.repo.getSession(input.uploadId) : null;
    if (session && session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida');
    }

    if (!session) {
      if (index !== 0) {
        throw new BadRequestException('La subida debe empezar por el primer trozo.');
      }
      // Evita acumular subidas abandonadas del mismo usuario.
      await this.repo.deleteStaleUploads(userId).catch(() => undefined);
      session = await this.repo.createSession({
        _id: new ObjectId().toHexString(),
        userId,
        filename: (input.filename || 'documento.pdf').slice(0, 160),
        mimetype: (input.mimetype || 'application/pdf').slice(0, 120),
        total,
        received: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await this.repo.saveChunk(session._id, userId, index, buffer);
    const received = await this.repo.countChunks(session._id);
    await this.repo.setReceived(session._id, received);

    return {
      uploadId: session._id,
      received,
      total: session.total,
      chunkSize: CHUNK_SIZE_BYTES,
      complete: received >= session.total,
    };
  }

  /** Junta los trozos, extrae el texto y libera la subida. */
  async assembleText(userId: number, uploadId: string): Promise<AssembledDocument> {
    const session = await this.repo.getSession(uploadId);
    if (!session) {
      throw new NotFoundException('La subida no existe o ya se procesó.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida');
    }

    const received = await this.repo.countChunks(uploadId);
    if (received < session.total) {
      throw new BadRequestException(
        `La subida está incompleta (${received}/${session.total} trozos). Vuelve a intentarlo.`,
      );
    }

    try {
      const chunks = await this.repo.listChunks(uploadId);
      const buffer = Buffer.concat(
        (chunks || []).map((chunk: any) => Buffer.from(String(chunk?.data || ''), 'base64')),
      );
      const file = {
        buffer,
        originalname: session.filename,
        mimetype: session.mimetype,
        size: buffer.length,
      } as Express.Multer.File;

      const text = await this.documents.extractText(file);
      return {
        text,
        topic: this.documents.guessTopic(file, text),
        filename: session.filename,
        bytes: buffer.length,
      };
    } finally {
      // Pase lo que pase, no dejamos el documento en la base de datos.
      await this.repo.deleteUpload(uploadId).catch((err) => this.logger.warn(`No se pudo limpiar la subida: ${err}`));
    }
  }

  /** Cancela una subida (el usuario cambia de archivo o cierra la pantalla). */
  async cancel(userId: number, uploadId: string) {
    const session = await this.repo.getSession(uploadId);
    if (session && session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida');
    }
    await this.repo.deleteUpload(uploadId);
    return { ok: true };
  }
}
