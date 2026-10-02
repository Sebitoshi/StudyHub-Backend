/**
 * Runtime mínimo para pdf-parse/pdf.js en entornos sin DOM del navegador.
 *
 * En Vercel (serverless) el binario nativo `@napi-rs/canvas` no siempre está
 * disponible. Cuando eso pasa, pdf.js no puede crear sus clases de referencia y
 * `require('pdf-parse')` revienta con `ReferenceError: DOMMatrix is not defined`,
 * lo que se traduce en un 400 "No pudimos leer el archivo PDF" para el usuario.
 *
 * Instalamos aquí equivalentes 2D suficientes para **extraer texto** (que es lo
 * único que hace la app: ni renderiza páginas ni genera miniaturas). Si el
 * entorno ya trae las clases reales, no se toca nada.
 */

import { existsSync } from 'fs';
import { dirname, join } from 'path';

type Matrix2D = [number, number, number, number, number, number];

const IDENTITY: Matrix2D = [1, 0, 0, 1, 0, 0];

/** Convierte lo que recibe el constructor de DOMMatrix a los 6 valores 2D. */
function toMatrix2D(init: unknown): Matrix2D {
  if (typeof init === 'string') {
    const match = init.match(/matrix\(([^)]+)\)/);
    if (match) {
      const values = match[1].split(/[,\s]+/).filter(Boolean).map(Number);
      if (values.length === 6) return values as Matrix2D;
    }
    return [...IDENTITY];
  }
  if (init == null) return [...IDENTITY];
  if (typeof init === 'number') return [init, 0, 0, init, 0, 0];
  if (Array.isArray(init) || ArrayBuffer.isView(init)) {
    const values = Array.from(init as ArrayLike<number>);
    if (values.length === 6) return values as Matrix2D;
    // matrix3d: primer y quinta columna de la matriz 4x4.
    if (values.length >= 16) return [values[0], values[1], values[4], values[5], values[12], values[13]];
    if (values.length === 4) return [values[0], values[1], values[2], values[3], 0, 0];
    return [...IDENTITY];
  }
  const source = init as Record<string, number>;
  return [source.a ?? 1, source.b ?? 0, source.c ?? 0, source.d ?? 1, source.e ?? 0, source.f ?? 0];
}

class DOMMatrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(init?: unknown) {
    const [a, b, c, d, e, f] = toMatrix2D(init);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  static fromMatrix(init?: unknown) {
    return new DOMMatrix2D(init);
  }

  static fromFloat32Array(values: Float32Array | number[]) {
    return new DOMMatrix2D(values);
  }

  static fromFloat64Array(values: Float64Array | number[]) {
    return new DOMMatrix2D(values);
  }

  get m11() { return this.a; }
  set m11(value: number) { this.a = value; }
  get m12() { return this.b; }
  set m12(value: number) { this.b = value; }
  get m21() { return this.c; }
  set m21(value: number) { this.c = value; }
  get m22() { return this.d; }
  set m22(value: number) { this.d = value; }
  get m41() { return this.e; }
  set m41(value: number) { this.e = value; }
  get m42() { return this.f; }
  set m42(value: number) { this.f = value; }

  get is2D() {
    return true;
  }

  get isIdentity() {
    return this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0;
  }

  multiply(other: unknown) {
    return this.clone().multiplySelf(other);
  }

  multiplySelf(other: unknown) {
    const { a, b, c, d, e, f } = this;
    const [oa, ob, oc, od, oe, of] = toMatrix2D(other);
    this.a = a * oa + c * ob;
    this.b = b * oa + d * ob;
    this.c = a * oc + c * od;
    this.d = b * oc + d * od;
    this.e = a * oe + c * of + e;
    this.f = b * oe + d * of + f;
    return this;
  }

  preMultiplySelf(other: unknown) {
    const current = this.toJSON();
    this.multiplySelf(new DOMMatrix2D(toMatrix2D(other)).multiplySelf(current));
    return this;
  }

  translate(x: number, y = 0) {
    return this.clone().translateSelf(x, y);
  }

  translateSelf(x: number, y = 0) {
    this.e += this.a * x + this.c * y;
    this.f += this.b * x + this.d * y;
    return this;
  }

  scale(x: number, y = x) {
    return this.clone().scaleSelf(x, y);
  }

  scaleSelf(x: number, y = x) {
    this.a *= x;
    this.b *= x;
    this.c *= y;
    this.d *= y;
    return this;
  }

  rotate(degrees: number) {
    return this.clone().rotateSelf(degrees);
  }

  rotateSelf(degrees: number) {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const { a, b, c, d } = this;
    this.a = a * cos + c * sin;
    this.b = b * cos + d * sin;
    this.c = c * cos - a * sin;
    this.d = d * cos - b * sin;
    return this;
  }

  rotateAxisAngleSelf() {
    return this;
  }

  skewXSelf() {
    return this;
  }

  skewYSelf() {
    return this;
  }

  inverse() {
    const { a, b, c, d, e, f } = this;
    const determinant = a * d - b * c;
    if (!determinant) throw new Error('DOMMatrix is not invertible');
    const result = new DOMMatrix2D(this.toJSON());
    result.a = d / determinant;
    result.b = -b / determinant;
    result.c = -c / determinant;
    result.d = a / determinant;
    result.e = (c * f - d * e) / determinant;
    result.f = (b * e - a * f) / determinant;
    return result;
  }

  invert() {
    return this.inverse();
  }

  transformPoint(point: { x?: number; y?: number; z?: number } = {}) {
    const x = point.x ?? 0;
    const y = point.y ?? 0;
    const z = point.z ?? 0;
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f,
      z,
    };
  }

  toFloat32Array() {
    return new Float32Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]);
  }

  toFloat64Array() {
    return new Float64Array([this.a, this.b, 0, 0, this.c, this.d, 0, 0, 0, 0, 1, 0, this.e, this.f, 0, 1]);
  }

  toJSON() {
    return { a: this.a, b: this.b, c: this.c, d: this.d, e: this.e, f: this.f };
  }

  clone() {
    return new DOMMatrix2D(this.toJSON());
  }

  toString() {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

class ImageData2D {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(a: number | Uint8ClampedArray, b?: number, c?: number) {
    if (typeof a === 'number') {
      this.width = a;
      this.height = b ?? 0;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = a;
      this.width = b ?? 0;
      this.height = c ?? 0;
    }
  }
}

class Path2D2D {
  addPath() {}
  arc() {}
  arcTo() {}
  bezierCurveTo() {}
  closePath() {}
  ellipse() {}
  lineTo() {}
  moveTo() {}
  quadraticCurveTo() {}
  rect() {}
  roundRect() {}
}

/**
 * Instala los sustitutos 2D si el runtime no los trae. Idempotente: se puede
 * llamar antes de cada lectura de PDF.
 */
export function ensurePdfRuntime(): void {
  const scope = globalThis as Record<string, unknown>;
  if (typeof scope.DOMMatrix !== 'function') scope.DOMMatrix = DOMMatrix2D;
  if (typeof scope.ImageData !== 'function') scope.ImageData = ImageData2D;
  if (typeof scope.Path2D !== 'function') scope.Path2D = Path2D2D;
}

/**
 * Ruta del `pdf.worker.mjs` que pdf.js carga con `await import(workerSrc)`.
 *
 * Prioridad:
 *  1. La copia que `scripts/copy-pdf-worker.js` deja junto al build. Es la única
 *     forma de que el archivo exista en Vercel: el trazador de archivos de la
 *     plataforma no sigue el import dinámico que hace pdf-parse dentro de su
 *     propio paquete (de ahí el "Setting up fake worker failed: Cannot find
 *     module .../pdf.worker.mjs" al subir un PDF).
 *  2. La del paquete `pdf-parse`, que sirve en desarrollo local.
 */
function resolveWorkerPath(): string | undefined {
  try {
    const bundled = require.resolve('./pdf.worker.mjs');
    if (existsSync(bundled)) return bundled;
  } catch {
    // Sin copia (build sin el paso extra): seguimos con la opción 2.
  }
  try {
    const delPaquete = join(dirname(require.resolve('pdf-parse')), 'pdf.worker.mjs');
    if (existsSync(delPaquete)) return delPaquete;
  } catch {
    // pdf-parse no resoluble: que pdf-parse use su valor por defecto.
  }
  return undefined;
}

/** Apunta a pdf-parse a un worker que realmente exista en el runtime. */
function applyPdfWorker(PDFParse: { setWorker?: (src?: string) => string }): void {
  const ruta = resolveWorkerPath();
  if (!ruta || typeof PDFParse?.setWorker !== 'function') return;
  try {
    PDFParse.setWorker(ruta);
  } catch {
    // Se deja el workerSrc por defecto; lo avisará pdf.js si falla.
  }
}

/**
 * Extrae el texto de un PDF con pdf-parse v2 (clase `PDFParse`), garantizando el
 * runtime y el worker antes de leer. Lanza si el documento no se puede leer.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  ensurePdfRuntime();
  // pdf-parse v2 ya no es una función: expone la clase PDFParse.
  const { PDFParse } = require('pdf-parse');
  applyPdfWorker(PDFParse);
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    return data?.text || '';
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
