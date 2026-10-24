import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { IMAGE_CHUNK_BYTES } from './media.constants';
import { MediaService } from './media.service';

function png(width: number, height: number, padding = 0): Buffer {
  const buffer = Buffer.alloc(33 + padding);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe('MediaService', () => {
  const repo = {
    createSession: jest.fn(),
    getSession: jest.fn(),
    setReceived: jest.fn(),
    saveChunk: jest.fn(),
    listChunks: jest.fn(),
    countChunks: jest.fn(),
    deleteUpload: jest.fn(),
    deleteStaleUploads: jest.fn(),
    getImageById: jest.fn(),
    getImageForUser: jest.fn(),
    insertImage: jest.fn(),
    deleteImageById: jest.fn(),
  };
  const prisma = { user: { update: jest.fn() } };
  let service: MediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MediaService(repo as any, prisma as any);
    repo.deleteUpload.mockResolvedValue(undefined);
    repo.deleteStaleUploads.mockResolvedValue(undefined);
    repo.setReceived.mockResolvedValue(undefined);
    repo.saveChunk.mockResolvedValue(undefined);
    repo.insertImage.mockResolvedValue(undefined);
  });

  it('crea una sesión con el primer trozo y reporta progreso', async () => {
    repo.createSession.mockImplementation(async (session: any) => session);
    repo.countChunks.mockResolvedValue(1);

    const progress = await service.saveChunk(7, {
      index: 0,
      total: 2,
      buffer: Buffer.from('trozo'),
    });

    expect(progress).toMatchObject({ received: 1, total: 2, complete: false });
    expect(progress.uploadId).toHaveLength(24);
    expect(repo.saveChunk).toHaveBeenCalledWith(progress.uploadId, 7, 0, Buffer.from('trozo'));
  });

  it('rechaza trozos que no empiezan en 0 o superan el límite', async () => {
    await expect(
      service.saveChunk(7, { index: 1, total: 2, buffer: Buffer.from('x') }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.saveChunk(7, {
        index: 0,
        total: 1,
        buffer: Buffer.alloc(IMAGE_CHUNK_BYTES + 1),
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('no permite tocar la subida de otro usuario', async () => {
    repo.getSession.mockResolvedValue({ _id: 'abc', userId: 99, total: 1 });

    await expect(
      service.saveChunk(7, { uploadId: 'abc', index: 0, total: 1, buffer: Buffer.from('x') }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('junta los trozos, valida y guarda el avatar con ruta versionada', async () => {
    repo.getSession.mockResolvedValue({ _id: 'abc', userId: 7, total: 1, kind: 'avatar' });
    repo.listChunks.mockResolvedValue([{ index: 0, data: png(320, 320) }]);
    repo.getImageForUser.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({});

    const result = await service.completeAvatar(7, 'abc');

    expect(result).toMatchObject({ bytes: 33, mime: 'image/png', width: 320, height: 320 });
    expect(result.foto).toMatch(/^\/media\/avatars\/[a-f0-9]{24}\?v=[a-f0-9]{10}$/);
    expect(repo.insertImage).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { foto: result.foto },
    });
    expect(repo.deleteUpload).toHaveBeenCalledWith('abc');
  });

  it('no reescribe si la imagen es idéntica (dedupe por hash)', async () => {
    const buffer = png(128, 128);
    const id = new ObjectId();
    repo.getSession.mockResolvedValue({ _id: 'abc', userId: 7, total: 1, kind: 'avatar' });
    repo.listChunks.mockResolvedValue([{ index: 0, data: buffer }]);
    repo.getImageForUser.mockResolvedValue({
      _id: id,
      hash: require('crypto').createHash('sha256').update(buffer).digest('hex'),
      bytes: buffer.length,
      mime: 'image/png',
      width: 128,
      height: 128,
    });

    const result = await service.completeAvatar(7, 'abc');

    expect(result.deduped).toBe(true);
    expect(repo.insertImage).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.foto).toContain(id.toHexString());
  });

  it('rechaza contenido que no es una imagen real', async () => {
    repo.getSession.mockResolvedValue({ _id: 'abc', userId: 7, total: 1, kind: 'avatar' });
    repo.listChunks.mockResolvedValue([{ index: 0, data: Buffer.from('<svg></svg>') }]);

    await expect(service.completeAvatar(7, 'abc')).rejects.toBeInstanceOf(
      UnsupportedMediaTypeException,
    );
    expect(repo.deleteUpload).toHaveBeenCalledWith('abc');
  });

  it('rechaza imágenes con dimensiones abusivas', async () => {
    repo.getSession.mockResolvedValue({ _id: 'abc', userId: 7, total: 1, kind: 'avatar' });
    repo.listChunks.mockResolvedValue([{ index: 0, data: png(5000, 5000) }]);

    await expect(service.completeAvatar(7, 'abc')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('elimina el avatar y limpia la foto del usuario', async () => {
    const id = new ObjectId();
    repo.getImageForUser.mockResolvedValue({ _id: id });

    const result = await service.removeAvatar(7);

    expect(result).toEqual({ ok: true, foto: null });
    expect(repo.deleteImageById).toHaveBeenCalledWith(id);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { foto: null },
    });
  });
});
