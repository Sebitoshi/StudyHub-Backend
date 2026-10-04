/**
 * Incrusta `pdf.worker.mjs` (de pdf-parse) dentro de `src/common/pdf-worker-content.ts`.
 *
 * ¿Por qué dentro del código y no como archivo suelto?
 * pdf.js carga su worker con `await import(workerSrc)`, un import dinámico que el
 * trazador de archivos de Vercel (`@vercel/nft`) no sigue. Resultado: aunque el
 * build copie `pdf.worker.mjs` a `dist/`, ese archivo NO viaja en la función
 * serverless y cualquier PDF termina en 400 "No pudimos leer el archivo PDF"
 * ("Setting up fake worker failed: Cannot find module .../pdf.worker.mjs").
 *
 * Al incrustarlo como base64 dentro de un `.ts`, el worker viaja en el propio
 * JavaScript de la función. En runtime, `pdf-runtime.ts` lo escribe en /tmp y le
 * pasa esa ruta a pdf-parse.
 *
 * Se ejecuta al inicio de `pnpm build` y es idempotente: si el worker no cambió,
 * no reescribe nada.
 */
const fs = require('fs');
const path = require('path');

const DESTINO = path.join(__dirname, '..', 'src', 'common', 'pdf-worker-content.ts');

function leerWorker() {
  try {
    const delPaquete = path.join(path.dirname(require.resolve('pdf-parse')), 'pdf.worker.mjs');
    if (fs.existsSync(delPaquete)) return fs.readFileSync(delPaquete);
  } catch {
    // pdf-parse no instalado: se conserva la copia embebida existente.
  }
  return null;
}

const worker = leerWorker();

if (!worker) {
  if (fs.existsSync(DESTINO)) {
    console.warn('[embed-pdf-worker] No se encontró pdf.worker.mjs; se conserva la copia embebida actual.');
    process.exit(0);
  }
  console.error('[embed-pdf-worker] No se encontró pdf.worker.mjs y no hay copia embebida.');
  process.exit(1);
}

const base64 = worker.toString('base64');
const contenido = `/**
 * GENERADO por scripts/embed-pdf-worker.js — no editar a mano.
 *
 * Contenido exacto de pdf.worker.mjs del pdf-parse instalado (${worker.length} bytes).
 * Va incrustado aquí para que sobreviva al empaquetado de Vercel: pdf.js lo carga
 * con un import dinámico que el trazador de archivos no sigue, así que un archivo
 * suelto nunca llega a la función serverless. pdf-runtime.ts lo escribe en /tmp
 * antes de leer un PDF.
 */
export const PDF_WORKER_BASE64 = '${base64}';
`;

if (fs.existsSync(DESTINO) && fs.readFileSync(DESTINO, 'utf8') === contenido) {
  console.log('[embed-pdf-worker] pdf-worker-content.ts ya está al día.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, contenido);
console.log(`[embed-pdf-worker] pdf-worker-content.ts actualizado (${(contenido.length / 1024).toFixed(0)} KB).`);
