import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { PrismaService } from '../prisma/prisma.service';
import {
  AVATAR_KIND,
  IMAGE_CHUNK_BYTES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_CHUNKS,
  MAX_IMAGE_DIMENSION,
  MAX_NOTE_IMAGES_PER_NOTE,
  NOTE_KIND,
  SUPPORTED_IMAGE_KINDS,
} from './media.constants';
import { MediaRepository, type NoteImageRow } from './media.repository';
import {
  detectImageMime,
  hashBytes,
  readImageDimensions,
  type ImageDimensions,
  type ImageMime,
} from './image.util';

export interface ImageChunkInput {
  uploadId?: string | null;
  index?: number;
  total?: number;
  kind?: string;
  buffer: Buffer;
}

export interface ImageChunkProgress {
  uploadId: string;
  received: number;
  total: number;
  complete: boolean;
  chunkBytes: number;
}

export interface StoredAvatar {
  foto: string;
  bytes: number;
  mime: string;
  width: number;
  height: number;
  chunks: number;
  deduped: boolean;
}

export interface AvatarPayload {
  data: Buffer;
  mime: string;
  bytes: number;
  hash: string;
}

export interface NoteImagePayload {
  id: string;
  /** Ruta de la API para incrustar en el apunte: `/media/notes/<id>?v=<hash>`. */
  url: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  subjectId: number | null;
  noteId: number | null;
}

/**
 * Pipeline de imágenes: el navegador optimiza y parte la imagen; aquí se guardan
 * los trozos en MongoDB, se validan los bytes reales y se conserva solo la imagen
 * final (compacta) para servirla desde la API. Nunca se guarda una URL externa.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  /** Caché por instancia: evita ir a Mongo en cada carga de avatar. */
  private readonly avatarCache = new Map<string, AvatarPayload>();
  private readonly AVATAR_CACHE_LIMIT = 200;

  constructor(
    private readonly repo: MediaRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ── Subida por trozos ──────────────────────────────────────

  async saveChunk(userId: number, input: ImageChunkInput): Promise<ImageChunkProgress> {
    const buffer = input.buffer;
    if (!buffer?.length) {
      throw new BadRequestException('El trozo llegó vacío. Vuelve a intentarlo.');
    }
    if (buffer.length > IMAGE_CHUNK_BYTES) {
      throw new PayloadTooLargeException(
        `Cada trozo debe pesar como máximo ${Math.round(IMAGE_CHUNK_BYTES / 1024)} KB.`,
      );
    }

    const kind = String(input.kind || AVATAR_KIND).trim().toLowerCase();
    if (!SUPPORTED_IMAGE_KINDS.has(kind)) {
      throw new BadRequestException('Tipo de imagen no soportado.');
    }

    const index = Number(input.index);
    const total = Number(input.total);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('El índice del trozo no es válido.');
    }
    if (!Number.isInteger(total) || total < 1 || total > MAX_IMAGE_CHUNKS) {
      throw new BadRequestException('El número de trozos no es válido.');
    }

    let session = input.uploadId ? await this.repo.getSession(input.uploadId) : null;
    if (session && session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida.');
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
        kind,
        total,
        received: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (index >= session.total) {
      throw new BadRequestException('El trozo está fuera del rango de la subida.');
    }

    await this.repo.saveChunk(session._id, userId, index, buffer);
    const received = await this.repo.countChunks(session._id);
    await this.repo.setReceived(session._id, received);

    return {
      uploadId: session._id,
      received,
      total: session.total,
      complete: received >= session.total,
      chunkBytes: IMAGE_CHUNK_BYTES,
    };
  }

  /** Une los trozos, valida la imagen real y la guarda como avatar del usuario. */
  async completeAvatar(userId: number, uploadId: string): Promise<StoredAvatar> {
    const session = await this.repo.getSession(uploadId);
    if (!session) {
      throw new NotFoundException('La subida no existe o ya se procesó.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida.');
    }

    try {
      const { buffer, mime, dimensions, hash } = await this.assembleImage(
        session,
        uploadId,
        AVATAR_KIND,
      );
      const existing = await this.repo.getImageForUser(userId, AVATAR_KIND);

      // Misma imagen: no se reescribe nada, solo se devuelve la ruta vigente.
      if (existing?.hash === hash) {
        return {
          foto: this.fotoPath(existing._id, hash),
          bytes: existing.bytes,
          mime: existing.mime,
          width: existing.width,
          height: existing.height,
          chunks: session.total,
          deduped: true,
        };
      }

      const imageId = new ObjectId();
      await this.repo.insertImage({
        _id: imageId,
        userId,
        kind: AVATAR_KIND,
        mime,
        width: dimensions.width,
        height: dimensions.height,
        bytes: buffer.length,
        hash,
        data: buffer,
        createdAt: new Date(),
      });

      const foto = this.fotoPath(imageId, hash);
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { foto } });
      } catch (error) {
        // Si Postgres falla, no dejamos una imagen huérfana en Mongo.
        await this.repo.deleteImageById(imageId).catch(() => undefined);
        this.logger.error(`No se pudo actualizar el avatar del usuario ${userId}: ${error}`);
        throw new ServiceUnavailableException('No pudimos guardar tu foto. Inténtalo de nuevo.');
      }

      if (existing) {
        await this.repo.deleteImageById(existing._id).catch((error) => {
          this.logger.warn(`No se pudo borrar el avatar anterior: ${error}`);
        });
      }

      return {
        foto,
        bytes: buffer.length,
        mime,
        width: dimensions.width,
        height: dimensions.height,
        chunks: session.total,
        deduped: false,
      };
    } finally {
      await this.repo.deleteUpload(uploadId).catch((error) => {
        this.logger.warn(`No se pudo limpiar la subida ${uploadId}: ${error}`);
      });
    }
  }

  /**
   * Guarda una imagen para un apunte. `noteId` es opcional porque el estudiante
   * puede subir la foto antes de crear la nota: luego se liga al guardarla.
   */
  async completeNoteImage(
    userId: number,
    uploadId: string,
    options: { subjectId: number; noteId?: number | null },
  ): Promise<NoteImagePayload> {
    const session = await this.repo.getSession(uploadId);
    if (!session) {
      throw new NotFoundException('La subida no existe o ya se procesó.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida.');
    }

    const subject = await this.prisma.subject.findFirst({
      where: { id: options.subjectId, userId },
      select: { id: true },
    });
    if (!subject) {
      throw new NotFoundException('Materia no encontrada.');
    }

    let noteId: number | null = null;
    if (options.noteId != null) {
      const note = await this.prisma.note.findFirst({
        where: { id: options.noteId, subjectId: options.subjectId },
        select: { id: true },
      });
      if (!note) {
        throw new NotFoundException('Nota no encontrada.');
      }
      const stored = await this.repo.countNoteImages(note.id);
      if (stored >= MAX_NOTE_IMAGES_PER_NOTE) {
        throw new BadRequestException(
          `Un apunte admite como máximo ${MAX_NOTE_IMAGES_PER_NOTE} imágenes.`,
        );
      }
      noteId = note.id;
    }

    try {
      const { buffer, mime, dimensions, hash } = await this.assembleImage(
        session,
        uploadId,
        NOTE_KIND,
      );

      const imageId = new ObjectId();
      await this.repo.insertImage({
        _id: imageId,
        userId,
        kind: NOTE_KIND,
        subjectId: options.subjectId,
        noteId,
        mime,
        width: dimensions.width,
        height: dimensions.height,
        bytes: buffer.length,
        hash,
        data: buffer,
        createdAt: new Date(),
      });

      return {
        id: imageId.toHexString(),
        url: this.noteImagePath(imageId, hash),
        mime,
        width: dimensions.width,
        height: dimensions.height,
        bytes: buffer.length,
        subjectId: options.subjectId,
        noteId,
      };
    } finally {
      await this.repo.deleteUpload(uploadId).catch((error) => {
        this.logger.warn(`No se pudo limpiar la subida ${uploadId}: ${error}`);
      });
    }
  }

  /** Imágenes de varios apuntes sin los bytes: solo metadatos y URL de la API. */
  async listNoteImages(userId: number, noteIds: number[]): Promise<NoteImagePayload[]> {
    if (!noteIds.length) return [];
    const rows = await this.repo.listNoteImages(userId, noteIds);
    return rows.map((row) => this.noteImageFromRow(row));
  }

  /** Liga al apunte imágenes subidas antes de guardarlo (mismo dueño y materia). */
  async attachImagesToNote(userId: number, noteId: number, imageIds: string[]): Promise<number> {
    const ids = (imageIds || [])
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (!ids.length) return 0;

    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, subjectId: true },
    });
    if (!note) {
      throw new NotFoundException('Nota no encontrada.');
    }

    const stored = await this.repo.countNoteImages(note.id);
    if (stored + ids.length > MAX_NOTE_IMAGES_PER_NOTE) {
      throw new BadRequestException(
        `Un apunte admite como máximo ${MAX_NOTE_IMAGES_PER_NOTE} imágenes.`,
      );
    }

    return this.repo.attachImagesToNote(userId, ids, note.id, note.subjectId);
  }

  async deleteNoteImage(userId: number, imageId: string): Promise<{ ok: boolean }> {
    if (!ObjectId.isValid(imageId)) {
      throw new NotFoundException('Imagen no encontrada.');
    }
    const deleted = await this.repo.deleteNoteImage(userId, new ObjectId(imageId));
    if (!deleted) {
      throw new NotFoundException('Imagen no encontrada.');
    }
    this.avatarCache.delete(imageId);
    return { ok: true };
  }

  /** Postgres borra la nota con CASCADE, así que las imágenes se limpian aquí. */
  async deleteImagesForNote(userId: number, noteId: number): Promise<void> {
    const deleted = await this.repo.deleteImagesForNote(userId, noteId);
    if (deleted) this.avatarCache.clear();
  }

  async deleteImagesForSubject(userId: number, subjectId: number): Promise<void> {
    const deleted = await this.repo.deleteImagesForSubject(userId, subjectId);
    if (deleted) this.avatarCache.clear();
  }

  async cancel(userId: number, uploadId: string): Promise<{ ok: boolean }> {
    const session = await this.repo.getSession(uploadId);
    if (session && session.userId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta subida.');
    }
    await this.repo.deleteUpload(uploadId);
    return { ok: true };
  }

  // ── Lectura y borrado ──────────────────────────────────────

  async getAvatar(imageId: string): Promise<AvatarPayload> {
    if (!ObjectId.isValid(imageId)) {
      throw new NotFoundException('Imagen no encontrada.');
    }

    const cached = this.avatarCache.get(imageId);
    if (cached) return cached;

    const image = await this.repo.getImageById(new ObjectId(imageId));
    if (!image || image.kind !== AVATAR_KIND) {
      throw new NotFoundException('Imagen no encontrada.');
    }

    const payload: AvatarPayload = {
      data: image.data,
      mime: image.mime,
      bytes: image.bytes,
      hash: image.hash,
    };
    this.cacheImage(imageId, payload);
    return payload;
  }

  /** Imagen incrustada en un apunte (la caché es la misma que la de avatares). */
  async getNoteImage(imageId: string): Promise<AvatarPayload> {
    if (!ObjectId.isValid(imageId)) {
      throw new NotFoundException('Imagen no encontrada.');
    }

    const cached = this.avatarCache.get(imageId);
    if (cached) return cached;

    const image = await this.repo.getImageById(new ObjectId(imageId));
    if (!image || image.kind !== NOTE_KIND) {
      throw new NotFoundException('Imagen no encontrada.');
    }

    const payload: AvatarPayload = {
      data: image.data,
      mime: image.mime,
      bytes: image.bytes,
      hash: image.hash,
    };
    this.cacheImage(imageId, payload);
    return payload;
  }

  private cacheImage(imageId: string, payload: AvatarPayload): void {
    if (this.avatarCache.size >= this.AVATAR_CACHE_LIMIT) {
      const oldest = this.avatarCache.keys().next().value;
      if (oldest) this.avatarCache.delete(oldest);
    }
    this.avatarCache.set(imageId, payload);
  }

  private noteImageFromRow(row: NoteImageRow): NoteImagePayload {
    return {
      id: row._id,
      url: this.noteImagePath(new ObjectId(row._id), row.hash),
      mime: row.mime,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      subjectId: row.subjectId ?? null,
      noteId: row.noteId ?? null,
    };
  }

  private noteImagePath(imageId: ObjectId, hash: string): string {
    return `/media/notes/${imageId.toHexString()}?v=${hash.slice(0, 10)}`;
  }

  /**
   * Une los trozos y valida la imagen real (tipo, peso y dimensiones). El
   * llamador decide en qué documento de Mongo se guarda.
   */
  private async assembleImage(
    session: { _id: string; total: number; kind?: string },
    uploadId: string,
    expectedKind: string,
  ): Promise<{ buffer: Buffer; mime: ImageMime; dimensions: ImageDimensions; hash: string }> {
    if (session.kind && session.kind !== expectedKind) {
      throw new BadRequestException('Esta subida pertenece a otro tipo de imagen.');
    }

    const chunks = await this.repo.listChunks(uploadId);
    if (chunks.length < session.total) {
      throw new BadRequestException(
        `La subida está incompleta (${chunks.length}/${session.total} trozos).`,
      );
    }

    // Los índices van de 0 a total-1 y no se permiten duplicados.
    const indices = new Set(chunks.map((chunk) => chunk.index));
    if (indices.size !== session.total || chunks.some((chunk) => chunk.index >= session.total)) {
      throw new BadRequestException('Faltan trozos de la imagen. Vuelve a intentarlo.');
    }

    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    if (totalBytes === 0) {
      throw new BadRequestException('La imagen llegó vacía.');
    }
    if (totalBytes > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException(
        `La imagen supera el máximo de ${Math.round(MAX_IMAGE_BYTES / 1024)} KB.`,
      );
    }

    const buffer = Buffer.concat(chunks.map((chunk) => chunk.data));
    const mime = detectImageMime(buffer);
    if (!mime) {
      throw new UnsupportedMediaTypeException(
        'Formato no soportado. Sube una imagen JPG, PNG o WebP.',
      );
    }

    const dimensions = readImageDimensions(buffer, mime);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
      throw new BadRequestException('No pudimos leer las dimensiones de la imagen.');
    }
    if (dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
      throw new BadRequestException(
        `La imagen es demasiado grande (máximo ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} px).`,
      );
    }

    return { buffer, mime, dimensions, hash: hashBytes(buffer) };
  }

  async removeAvatar(userId: number): Promise<{ ok: boolean; foto: null }> {
    const existing = await this.repo.getImageForUser(userId, AVATAR_KIND);
    if (existing) {
      await this.repo.deleteImageById(existing._id);
      this.avatarCache.delete(existing._id.toHexString());
    }
    await this.prisma.user.update({ where: { id: userId }, data: { foto: null } });
    return { ok: true, foto: null };
  }

  private fotoPath(imageId: ObjectId, hash: string): string {
    return `/media/avatars/${imageId.toHexString()}?v=${hash.slice(0, 10)}`;
  }
}
