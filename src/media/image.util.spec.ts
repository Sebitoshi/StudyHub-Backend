import { detectImageMime, hashBytes, readImageDimensions } from './image.util';

function png(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer[24] = 8;
  buffer[25] = 6;
  return buffer;
}

function jpeg(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(20);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(17, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
}

function webpVp8x(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(40);
  buffer.write('RIFF', 0, 'latin1');
  buffer.writeUInt32LE(32, 4);
  buffer.write('WEBP', 8, 'latin1');
  buffer.write('VP8X', 12, 'latin1');
  buffer.writeUInt32LE(10, 16);
  buffer[24] = (width - 1) & 0xff;
  buffer[25] = ((width - 1) >> 8) & 0xff;
  buffer[26] = ((width - 1) >> 16) & 0xff;
  buffer[27] = (height - 1) & 0xff;
  buffer[28] = ((height - 1) >> 8) & 0xff;
  buffer[29] = ((height - 1) >> 16) & 0xff;
  return buffer;
}

describe('image.util', () => {
  it('detecta PNG, JPEG y WebP por sus bytes reales', () => {
    expect(detectImageMime(png(10, 10))).toBe('image/png');
    expect(detectImageMime(jpeg(10, 10))).toBe('image/jpeg');
    expect(detectImageMime(webpVp8x(10, 10))).toBe('image/webp');
  });

  it('rechaza SVG y archivos arbitrarios', () => {
    expect(detectImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageMime(Buffer.from('no soy una imagen'))).toBeNull();
  });

  it('lee dimensiones de PNG, JPEG y WebP', () => {
    expect(readImageDimensions(png(320, 240), 'image/png')).toEqual({ width: 320, height: 240 });
    expect(readImageDimensions(jpeg(800, 600), 'image/jpeg')).toEqual({
      width: 800,
      height: 600,
    });
    expect(readImageDimensions(webpVp8x(512, 256), 'image/webp')).toEqual({
      width: 512,
      height: 256,
    });
  });

  it('genera hashes estables y distintos', () => {
    const a = hashBytes(Buffer.from('hola'));
    expect(a).toHaveLength(64);
    expect(hashBytes(Buffer.from('hola'))).toBe(a);
    expect(hashBytes(Buffer.from('otra'))).not.toBe(a);
  });
});
