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
  _id: string;
  userId: number;
  filename: string;
  mimetype: string;
  total: number;
  received: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UploadsRepository {
  constructor(
    @Inject(DOCUMENT_UPLOADS_COLLECTION) private readonly sessions: Collection,
    @Inject(DOCUMENT_UPLOAD_CHUNKS_COLLECTION) private readonly chunks: Collection,
  ) {}

  async createSession(session: UploadSession) {
    await this.sessions.insertOne({ ...session });
    return session;
  }

  async getSession(uploadId: string): Promise<UploadSession | null> {
    return this.sessions.findOne({ _id: uploadId as any });
  }

  async setReceived(uploadId: string, received: number) {
    await this.sessions.updateOne(
      { _id: uploadId as any },
      { $set: { received, updatedAt: new Date() } },
    );
  }

  /** Guarda un trozo en base64 para no depender del tipo binario de BSON. */
  async saveChunk(uploadId: string, userId: number, index: number, buffer: Buffer) {
    await this.chunks.deleteOne({ uploadId, index } as any);
    await this.chunks.insertOne({
      uploadId,
      userId,
      index,
      size: buffer.length,
      data: buffer.toString('base64'),
      createdAt: new Date(),
    } as any);
  }

  async listChunks(uploadId: string): Promise<Array<{ index: number; data: string }>> {
    return this.chunks.find({ uploadId } as any).sort({ index: 1 }).toArray() as any;
  }

  async countChunks(uploadId: string): Promise<number> {
    return this.chunks.countDocuments({ uploadId } as any);
  }

  async deleteUpload(uploadId: string) {
    await this.chunks.deleteMany({ uploadId } as any);
    await this.sessions.deleteOne({ _id: uploadId as any });
  }

  /** Limpia subidas viejas del usuario para no acumular basura. */
  async deleteStaleUploads(userId: number) {
    const cutoff = new Date(Date.now() - STALE_UPLOAD_MS);
    const stale = (await this.sessions.find({ userId, updatedAt: { $lt: cutoff } } as any).toArray()) as any[];
    for (const session of stale || []) {
      await this.chunks.deleteMany({ uploadId: session._id } as any);
    }
    await this.sessions.deleteMany({ userId, updatedAt: { $lt: cutoff } } as any);
  }
}
