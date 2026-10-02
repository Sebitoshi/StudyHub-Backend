/**
 * Deja `pdf.worker.mjs` junto al build para que el despliegue lo incluya.
 *
 * pdf.js carga su worker con `await import(workerSrc)` usando una ruta calculada
 * en tiempo de ejecución, y el trazador de archivos de Vercel no sigue ese tipo
 * de imports dinámicos: en serverless faltaba el archivo y cualquier PDF
 * terminaba en 400 "No pudimos leer el archivo PDF"
 * ("Setting up fake worker failed: Cannot find module .../pdf.worker.mjs").
 *
 * Se ejecuta al final de `pnpm build` (ver "scripts.build" de package.json).
 */
const fs = require('fs');
const path = require('path');

function main() {
  const cjsDir = path.dirname(require.resolve('pdf-parse'));
  const origen = path.join(cjsDir, 'pdf.worker.mjs');
  const destino = path.join(__dirname, '..', 'dist', 'src', 'common', 'pdf.worker.mjs');

  if (!fs.existsSync(origen)) {
    console.warn(`[copy-pdf-worker] No existe ${origen}; se omite la copia.`);
    return;
  }

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
  const bytes = fs.statSync(destino).size;
  console.log(`[copy-pdf-worker] pdf.worker.mjs copiado (${bytes} bytes) -> ${destino}`);
}

try {
  main();
} catch (err) {
  // Un fallo aquí no debe tumbar el build: en desarrollo el worker se resuelve
  // desde node_modules directamente.
  console.warn(`[copy-pdf-worker] No se pudo copiar el worker: ${err.message}`);
  process.exitCode = 0;
}
