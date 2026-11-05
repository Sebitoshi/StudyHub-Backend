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
/** Imágenes incrustadas en los apuntes. */
export const NOTE_KIND = 'note';
/** PDFs adjuntos a los apuntes. */
export const NOTE_FILE_KIND = 'note-file';

export const SUPPORTED_IMAGE_KINDS = new Set([AVATAR_KIND, NOTE_KIND]);
export const SUPPORTED_UPLOAD_KINDS = new Set([AVATAR_KIND, NOTE_KIND, NOTE_FILE_KIND]);

/** Tope de imágenes por apunte: evita apuntes inmanejables en móvil. */
export const MAX_NOTE_IMAGES_PER_NOTE = 20;

/** PDFs: hasta 12 MB repartidos en trozos de 512 KB y 5 documentos por apunte. */
export const MAX_NOTE_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_NOTE_FILE_CHUNKS = Math.ceil(MAX_NOTE_FILE_BYTES / IMAGE_CHUNK_BYTES);
export const MAX_NOTE_FILES_PER_NOTE = 5;
export const NOTE_FILE_MIME = 'application/pdf';
