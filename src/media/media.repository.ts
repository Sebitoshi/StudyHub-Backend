import { Inject, Injectable } from '@nestjs/common';
import { Collection, ObjectId } from 'mongodb';
import {
  MEDIA_IMAGES_COLLECTION,
  MEDIA_UPLOADS_COLLECTION,
  MEDIA_UPLOAD_CHUNKS_COLLECTION,
} from '../ai/mongo.provider';
import { STALE_IMAGE_UPLOAD_MS } from './media.constants';
import type { ImageMime } from './image.util';

export interface ImageUploadSession {
  /** Id aleatorio de la subida; también es el `_id` del documento. */
  _id: string;
  userId: number;
  kind: string;
  total: number;
  received: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImageChunkRow {
  uploadId: string;
  userId: number;
  index: number;
  size: number;
  /** Bytes crudos (BSON Binary), no base64: ahorra un 33 % de espacio. */
  data: Buffer;
  createdAt: Date;
}

export interface StoredImage {
  _id: ObjectId;
  userId: number;
  kind: string;
  mime: ImageMime;
  width: number;
  height: number;
  bytes: number;
  hash: string;
  data: Buffer;
  createdAt: Date;
}

/** El driver devuelve BSON Binary; lo normalizamos siempre a Buffer. */
export function asBuffer(value: any): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value && typeof value.value === 'function') {
    // `value(true)` devuelve los bytes crudos. Sin `true` devuelve un string
    // ISO-8859-1 que `Buffer.from` reinterpreta como UTF-8 y corrompe la imagen.
    const inner = value.value(true);
    if (Buffer.isBuffer(inner)) return inner;
    if (ArrayBuffer.isView(inner)) {
      return Buffer.from(new Uint8Array(inner.buffer, inner.byteOffset, inner.byteLength));
    }
    return Buffer.from(inner);
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  if (value?.buffer) return Buffer.from(value.buffer);
  return Buffer.alloc(0);
}

@Injectable()
export class MediaRepository {
  constructor(
    @Inject(MEDIA_UPLOADS_COLLECTION) private readonly sessions: Collection<any>,
    @Inject(MEDIA_UPLOAD_CHUNKS_COLLECTION) private readonly chunks: Collection<any>,
    @Inject(MEDIA_IMAGES_COLLECTION) private readonly images: Collection<any>,
  ) {}

  // ── Subidas por trozos ─────────────────────────────────────

  async createSession(session: ImageUploadSession): Promise<ImageUploadSession> {
    await this.sessions.insertOne({ ...session });
    return session;
  }

  async getSession(uploadId: string): Promise<ImageUploadSession | null> {
    return this.sessions.findOne({ _id: uploadId });
  }

  async setReceived(uploadId: string, received: number): Promise<void> {
    await this.sessions.updateOne({ _id: uploadId }, { $set: { received, updatedAt: new Date() } });
  }

  /** Idempotente: reintentar un trozo reemplaza el anterior en vez de duplicarlo. */
  async saveChunk(uploadId: string, userId: number, index: number, buffer: Buffer): Promise<void> {
    await this.chunks.replaceOne(
      { uploadId, index },
      {
        uploadId,
        userId,
        index,
        size: buffer.length,
        data: buffer,
        createdAt: new Date(),
      },
      { upsert: true },
    );
  }

  async listChunks(uploadId: string): Promise<ImageChunkRow[]> {
    const rows = await this.chunks.find({ uploadId }).sort({ index: 1 }).toArray();
    return rows.map((row: any) => ({ ...row, data: asBuffer(row.data) }));
  }

  async countChunks(uploadId: string): Promise<number> {
    return this.chunks.countDocuments({ uploadId });
  }

  async deleteUpload(uploadId: string): Promise<void> {
    await this.chunks.deleteMany({ uploadId });
    await this.sessions.deleteOne({ _id: uploadId });
  }

  /** Limpia subidas viejas del usuario al empezar una nueva. */
  async deleteStaleUploads(userId: number): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_IMAGE_UPLOAD_MS);
    const stale: ImageUploadSession[] = await this.sessions
      .find({ userId, updatedAt: { $lt: cutoff } })
      .toArray();

    for (const session of stale) {
      await this.chunks.deleteMany({ uploadId: session._id });
    }
    await this.sessions.deleteMany({ userId, updatedAt: { $lt: cutoff } });
  }

  // ── Imágenes guardadas ─────────────────────────────────────

  async getImageById(id: ObjectId): Promise<StoredImage | null> {
    const image = await this.images.findOne({ _id: id });
    return image ? { ...image, data: asBuffer(image.data) } : null;
  }

  async getImageForUser(userId: number, kind: string): Promise<StoredImage | null> {
    const image = await this.images.findOne({ userId, kind });
    return image ? { ...image, data: asBuffer(image.data) } : null;
  }

  async insertImage(image: StoredImage): Promise<void> {
    await this.images.insertOne(image);
  }

  async deleteImageById(id: ObjectId): Promise<void> {
    await this.images.deleteOne({ _id: id });
  }
}
