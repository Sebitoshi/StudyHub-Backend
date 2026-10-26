import { Binary } from 'mongodb';
import { asBuffer } from './media.repository';
import { detectImageMime } from './image.util';

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
]);

const WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0xce, 0x02, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
]);

describe('asBuffer', () => {
  it('devuelve el mismo Buffer sin copiarlo', () => {
    expect(asBuffer(PNG)).toBe(PNG);
  });

  it('preserva los bytes de un BSON Binary (WebP)', () => {
    const normalized = asBuffer(new Binary(WEBP));

    expect(normalized.equals(WEBP)).toBe(true);
    expect(detectImageMime(normalized)).toBe('image/webp');
  });

  it('preserva los bytes altos de un PNG guardado como Binary', () => {
    const normalized = asBuffer(new Binary(PNG));

    expect(normalized.equals(PNG)).toBe(true);
    expect(detectImageMime(normalized)).toBe('image/png');
  });

  it('normaliza un Uint8Array', () => {
    const normalized = asBuffer(new Uint8Array(WEBP));

    expect(normalized.equals(WEBP)).toBe(true);
  });
});
