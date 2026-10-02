import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ensurePdfRuntime } from '../common/pdf-runtime';

/**
 * Máximo de caracteres del documento que se envían al modelo (≈ 10 mil tokens).
 * Da para un tema completo o un capítulo largo sin acercarse al contexto del
 * modelo ni disparar el costo de la llamada.
 */
export const MAX_MATERIAL_CHARS = 40000;

/** Mínimo de texto útil para considerar que el documento se pudo leer. */
const MIN_USEFUL_CHARS = 40;

/**
 * Convierte un archivo subido (PDF, DOCX, TXT/MD) en texto plano para que la IA
 * pueda generar flashcards o un simulacro basados en el material del estudiante.
 *
 * Usa `pdf-parse` y `mammoth`, que ya son dependencias del proyecto (el analizador
 * de CV las usa), para no añadir nada nuevo al despliegue.
 */
@Injectable()
export class DocumentTextService {
  private readonly logger = new Logger(DocumentTextService.name);

  /** Extrae y normaliza el texto del archivo. Lanza 400 si no hay texto legible. */
  async extractText(file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debes subir un archivo con contenido.');
    }

    const text = this.normalize(await this.readRaw(file)).slice(0, MAX_MATERIAL_CHARS);

    if (text.length < MIN_USEFUL_CHARS) {
      throw new BadRequestException(
        'No pudimos leer texto de ese archivo. Si es un PDF escaneado (solo imágenes) necesitas uno con texto seleccionable.',
      );
    }

    return text;
  }

  /** Tema legible para el recurso generado: nombre del archivo o su primer título. */
  guessTopic(file: Express.Multer.File, text: string): string {
    const fromFilename = (file?.originalname || '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_\-.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (fromFilename.length >= 4 && /[a-záéíóúñ]/i.test(fromFilename)) {
      return fromFilename.slice(0, 80);
    }

    const firstLine = (text || '')
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length >= 6 && line.length <= 90);

    return firstLine ? firstLine.slice(0, 80) : 'Material del documento';
  }

  private async readRaw(file: Express.Multer.File): Promise<string> {
    const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';
    const mime = (file.mimetype || '').toLowerCase();

    if (mime === 'application/pdf' || ext === 'pdf') return this.parsePdf(file.buffer);
    if (ext === 'docx' || mime.includes('wordprocessingml')) return this.parseDocx(file.buffer);
    if (['txt', 'md', 'markdown', 'csv', 'tex'].includes(ext) || mime.startsWith('text/')) {
      return file.buffer.toString('utf8');
    }

    // Sin extensión reconocible: intentamos PDF y, si falla, texto plano.
    try {
      return await this.parsePdf(file.buffer);
    } catch {
      return file.buffer.toString('utf8');
    }
  }

  private async parsePdf(buffer: Buffer): Promise<string> {
    try {
      // Garantiza DOMMatrix y compañía ANTES de cargar pdf-parse: en serverless
      // no existe `@napi-rs/canvas` y el require revienta con "DOMMatrix is not
      // defined" (error que se devolvía como 400 al subir un PDF).
      ensurePdfRuntime();
      // pdf-parse v2 ya no es una función: expone la clase PDFParse.
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      try {
        const data = await parser.getText();
        return data?.text || '';
      } finally {
        await parser.destroy().catch(() => undefined);
      }
    } catch (err: any) {
      this.logger.warn(`No se pudo leer el PDF: ${err?.stack || err}`);
      throw new BadRequestException('No pudimos leer el archivo PDF.');
    }
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result?.value || '';
    } catch (err) {
      this.logger.warn(`No se pudo leer el DOCX: ${err}`);
      throw new BadRequestException('No pudimos leer el archivo DOCX.');
    }
  }

  /** Une líneas partidas por el PDF y elimina ruido de control. */
  private normalize(raw: string): string {
    return (raw || '')
      .replace(/\u0000/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
