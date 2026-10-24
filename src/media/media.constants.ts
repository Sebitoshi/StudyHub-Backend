/** Tamaño de cada trozo: 512 KB, muy por debajo del límite de Vercel (~4,5 MB). */
export const IMAGE_CHUNK_BYTES = 512 * 1024;

/** Con 8 trozos el límite de subida es 4 MB; la imagen final se limita a 2 MB. */
export const MAX_IMAGE_CHUNKS = 8;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** Evita imágenes gigantes que puedan reventar la memoria del navegador al mostrarlas. */
export const MAX_IMAGE_DIMENSION = 2048;

/** Una subida abandonada se descarta pasada media hora. */
export const STALE_IMAGE_UPLOAD_MS = 30 * 60 * 1000;

export const AVATAR_KIND = 'avatar';
