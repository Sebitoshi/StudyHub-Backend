import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';
import { DOCUMENT_UPLOAD_CHUNKS_COLLECTION, DOCUMENT_UPLOADS_COLLECTION } from '../mongo.provider';

/**
 * Tamaño máximo de cada trozo. Las funciones serverless tienen un límite de cuerpo
 * de petición (~4.5 MB), así que el frontend parte el documento en trozos de 3 MB.
 */
export const CHUNK_SIZE_BYTES = 3 * 1024 * 1024;

/** Máximo de trozos por documento (≈ 600 MB con trozos de 3 MB). */
export const MAX_CHUNKS = 200;

/** Las subidas a medias se descartan después de esta antigüedad. */
const STALE_UPLOAD_MS = 60 * 60 * 1000;

export interface UploadSession {
  /** Se usa el propio id de la subida como `_id` (string, no ObjectId). */
  _id: string;
  userId: number;
  filename: string;
  mimetype: string;
  total: number;
  received: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadChunkRow {
  uploadId: string;
  userId: number;
  index: number;
  size: number;
  /** Contenido del trozo en base64. */
  data: string;
  createdAt: Date;
}

@Injectable()
export class UploadsRepository {
  // Se tipan como `any` a propósito: estos documentos usan `_id` string, no ObjectId.
  constructor(
    @Inject(DOCUMENT_UPLOADS_COLLECTION) private readonly sessions: Collection<any>,
    @Inject(DOCUMENT_UPLOAD_CHUNKS_COLLECTION) private readonly chunks: Collection<any>,
  ) {}

  async createSession(session: UploadSession): Promise<UploadSession> {
    await this.sessions.insertOne({ ...session });
    return session;
  }

  async getSession(uploadId: string): Promise<UploadSession | null> {
    return this.sessions.findOne({ _id: uploadId });
  }

  async setReceived(uploadId: string, received: number): Promise<void> {
    await this.sessions.updateOne({ _id: uploadId }, { $set: { received, updatedAt: new Date() } });
  }

  /** Guarda un trozo en base64 para no depender del tipo binario de BSON. */
  async saveChunk(uploadId: string, userId: number, index: number, buffer: Buffer): Promise<void> {
    await this.chunks.deleteOne({ uploadId, index });
    await this.chunks.insertOne({
      uploadId,
      userId,
      index,
      size: buffer.length,
      data: buffer.toString('base64'),
      createdAt: new Date(),
    });
  }

  async listChunks(uploadId: string): Promise<UploadChunkRow[]> {
    return this.chunks.find({ uploadId }).sort({ index: 1 }).toArray();
  }

  async countChunks(uploadId: string): Promise<number> {
    return this.chunks.countDocuments({ uploadId });
  }

  async deleteUpload(uploadId: string): Promise<void> {
    await this.chunks.deleteMany({ uploadId });
    await this.sessions.deleteOne({ _id: uploadId });
  }

  /** Limpia subidas viejas del usuario para no acumular basura. */
  async deleteStaleUploads(userId: number): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_UPLOAD_MS);
    const stale: UploadSession[] = await this.sessions
      .find({ userId, updatedAt: { $lt: cutoff } })
      .toArray();

    for (const session of stale) {
      await this.chunks.deleteMany({ uploadId: session._id });
    }
    await this.sessions.deleteMany({ userId, updatedAt: { $lt: cutoff } });
  }
}
