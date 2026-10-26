import { Injectable, Logger } from '@nestjs/common';
import type { ChatMessage } from './groq.service';

/**
 * Cliente de Gemini (API generateContent). Habla el mismo contrato que
 * `GroqService` para que el resto de la app no sepa qué proveedor responde.
 *
 * El contexto se envía completo: los mensajes `system` se convierten en
 * `systemInstruction`, el historial `assistant` pasa a rol `model` y las
 * imágenes (`image_url` con data URL o URL https) pasan a `inlineData`.
 */
const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 120_000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
/** Con modelos que piensan, un tope de salida muy bajo puede dejar la respuesta vacía. */
const MIN_THINKING_OUTPUT_TOKENS = 2048;

export interface GeminiChatOptions {
  /** Solicitar JSON válido (responseMimeType application/json). */
  json?: boolean;
  /** Límite de tokens de salida (maxOutputTokens). */
  maxTokens?: number;
  /** Modelo para esta llamada; los ids de Groq se ignoran. */
  model?: string;
  /** Temperatura de muestreo. */
  temperature?: number;
}

export interface GeminiChatResponse {
  content: string;
  tokensUsed?: number;
  model?: string;
}

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

interface GeminiPayload {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: Record<string, unknown>;
}

/** Error con el status HTTP de Gemini para que el proveedor decida el fallback. */
export class GeminiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'GeminiRequestError';
  }
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly visionModel: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly streamTimeoutMs: number;

  constructor() {
    this.apiKey = (process.env.GEMINI_API_KEY || '').trim();
    this.model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    this.visionModel = (process.env.GEMINI_VISION_MODEL || this.model).trim();
    this.baseUrl = (
      process.env.GEMINI_API_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');

    this.timeoutMs = this.envNumber(
      'GEMINI_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      3_000,
      120_000,
    );
    this.streamTimeoutMs = this.envNumber(
      'GEMINI_STREAM_TIMEOUT_MS',
      DEFAULT_STREAM_TIMEOUT_MS,
      5_000,
      600_000,
    );

    if (this.apiKey) {
      this.logger.log(
        `Gemini configurado como proveedor principal (${this.model})`,
      );
    } else {
      this.logger.warn(
        'GEMINI_API_KEY no configurada: se usará Groq como proveedor principal.',
      );
    }
  }

  /** False cuando no hay clave; el enrutador pasa directo a Groq. */
  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async chat(
    messages: ChatMessage[],
    options?: GeminiChatOptions,
  ): Promise<GeminiChatResponse> {
    this.assertEnabled();

    const model = this.resolveModel(options?.model, this.hasImages(messages));
    const payload = await this.buildPayload(messages, options, model);
    const response = await this.generate(model, payload, this.timeoutMs);
    const content = this.extractText(response);

    if (!content.trim()) {
      const reason = response?.candidates?.[0]?.finishReason || 'sin contenido';
      throw new GeminiRequestError(
        `Gemini no devolvió texto (${reason}).`,
        502,
      );
    }

    return {
      content,
      tokensUsed: response?.usageMetadata?.totalTokenCount,
      model: this.responseModel(response, model),
    };
  }

  async chatJson(
    messages: ChatMessage[],
    options?: GeminiChatOptions,
  ): Promise<{ data: any; tokensUsed?: number; model?: string }> {
    const response = await this.chat(messages, { ...options, json: true });
    return {
      data: this.parseJson(response.content),
      tokensUsed: response.tokensUsed,
      model: response.model,
    };
  }

  /**
   * Indica si Gemini emitió el stream. Si no llegó ningún trozo, `used` es
   * false para que el enrutador pruebe Groq sin duplicar texto.
   */
  async stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<{ used: boolean; model?: string }> {
    if (!this.isEnabled()) return { used: false };

    const model = this.resolveModel(undefined, this.hasImages(messages));
    const payload = await this.buildPayload(messages, undefined, model);
    const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.streamTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) throw await this.httpError(response);
      if (!response.body) {
        throw new GeminiRequestError('Gemini no abrió el stream.', 502);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emitted = false;

      const handleLine = async (rawLine: string) => {
        const line = rawLine.replace(/\r$/, '');
        if (!line.startsWith('data:')) return;

        const json = line.slice(5).trim();
        if (!json || json === '[DONE]') return;

        let event: any;
        try {
          event = JSON.parse(json);
        } catch {
          return;
        }

        if (event?.error) throw this.errorFromPayload(event.error);
        const text = this.extractText(event);
        if (text) {
          emitted = true;
          await onChunk(text);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          await handleLine(line);
          newline = buffer.indexOf('\n');
        }
      }

      if (buffer) await handleLine(buffer);
      return { used: emitted, model };
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        throw new GeminiRequestError(
          `Gemini no terminó el stream en ${this.streamTimeoutMs} ms.`,
          504,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Construcción del payload ───────────────────────────────

  private async buildPayload(
    messages: ChatMessage[],
    options: GeminiChatOptions | undefined,
    model: string,
  ): Promise<GeminiPayload> {
    const systemParts: string[] = [];
    const contents: GeminiContent[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        const text = this.contentText(message.content);
        if (text.trim()) systemParts.push(text.trim());
        continue;
      }

      const parts = await this.contentParts(message.content);
      if (!parts.length) continue;

      const role: 'user' | 'model' =
        message.role === 'assistant' || message.role === 'model'
          ? 'model'
          : 'user';
      const last = contents[contents.length - 1];

      // Gemini espera turnos alternos; unir consecutivos evita un 400.
      if (last && last.role === role) {
        last.parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }

    if (!contents.length) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Responde usando el contexto anterior.' }],
      });
    }

    const payload: GeminiPayload = { contents };
    if (systemParts.length) {
      payload.systemInstruction = {
        parts: [{ text: systemParts.join('\n\n') }],
      };
    }

    payload.generationConfig = this.generationConfig(model, options);
    return payload;
  }

  private generationConfig(
    model: string,
    options?: GeminiChatOptions,
  ): Record<string, unknown> | undefined {
    const config: Record<string, unknown> = {};

    if (options?.temperature !== undefined)
      config.temperature = options.temperature;
    if (options?.maxTokens) config.maxOutputTokens = options.maxTokens;
    if (options?.json) config.responseMimeType = 'application/json';

    const isGemini3 = /^gemini-3/i.test(model);
    const isGemini25 = /^gemini-2\.5/i.test(model);

    if (isGemini3) {
      // Gemini 3 siempre piensa; el nivel bajo mantiene la latencia razonable.
      const level = (process.env.GEMINI_THINKING_LEVEL || 'low')
        .trim()
        .toLowerCase();
      if (['low', 'medium', 'high'].includes(level)) {
        config.thinkingConfig = { thinkingLevel: level };
      }
      if (
        typeof config.maxOutputTokens === 'number' &&
        config.maxOutputTokens < MIN_THINKING_OUTPUT_TOKENS
      ) {
        config.maxOutputTokens = MIN_THINKING_OUTPUT_TOKENS;
      }
    } else if (isGemini25) {
      const rawBudget = Number(process.env.GEMINI_THINKING_BUDGET);
      const budget = Number.isFinite(rawBudget) ? rawBudget : 0;
      config.thinkingConfig = { thinkingBudget: Math.max(0, budget) };
      if (budget > 0 && typeof config.maxOutputTokens === 'number') {
        config.maxOutputTokens += budget;
      }
    }

    return Object.keys(config).length ? config : undefined;
  }

  private async contentParts(
    content: ChatMessage['content'],
  ): Promise<GeminiPart[]> {
    if (typeof content === 'string') {
      return content.trim() ? [{ text: content }] : [];
    }

    const parts: GeminiPart[] = [];
    for (const part of content || []) {
      if (part?.type === 'text' && part.text?.trim()) {
        parts.push({ text: part.text });
      } else if (part?.type === 'image_url' && part.image_url?.url) {
        parts.push(await this.imagePart(part.image_url.url));
      }
    }
    return parts;
  }

  private async imagePart(url: string): Promise<GeminiPart> {
    const dataUrl = url.match(/^data:([^;,]+);base64,([\s\S]+)$/i);
    if (dataUrl) {
      const mimeType = dataUrl[1].trim().toLowerCase();
      if (!mimeType.startsWith('image/')) {
        throw new GeminiRequestError(
          'El adjunto no es una imagen.',
          400,
          false,
        );
      }
      return {
        inlineData: {
          mimeType,
          data: dataUrl[2].replace(/\s/g, ''),
        },
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new GeminiRequestError('URL de imagen inválida.', 400, false);
    }
    // Solo https: evita que un usuario fuerce peticiones a la red interna.
    if (parsed.protocol !== 'https:') {
      throw new GeminiRequestError(
        'Solo se permiten imágenes por https o data URL.',
        400,
        false,
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(parsed, { signal: controller.signal });
      if (!response.ok) {
        throw new GeminiRequestError(
          `No se pudo descargar la imagen (${response.status}).`,
          502,
        );
      }

      const mimeType = (response.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!mimeType.startsWith('image/')) {
        throw new GeminiRequestError(
          'El adjunto remoto no es una imagen.',
          400,
          false,
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new GeminiRequestError('La imagen supera los 6 MB.', 413, false);
      }

      return {
        inlineData: { mimeType, data: buffer.toString('base64') },
      };
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        throw new GeminiRequestError(
          'La descarga de la imagen tardó demasiado.',
          504,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── HTTP ───────────────────────────────────────────────────

  private async generate(
    model: string,
    payload: GeminiPayload,
    timeoutMs: number,
  ): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) throw await this.httpError(response);

      const raw = await response.text();
      try {
        return JSON.parse(raw);
      } catch {
        throw new GeminiRequestError(
          'Gemini devolvió una respuesta que no es JSON.',
          502,
        );
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        throw new GeminiRequestError(
          `Gemini no respondió en ${timeoutMs} ms.`,
          504,
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.apiKey,
    };
  }

  private async httpError(response: Response): Promise<GeminiRequestError> {
    const raw = await response.text().catch(() => '');
    let message = raw.slice(0, 400);

    try {
      const parsed = JSON.parse(raw);
      message = String(parsed?.error?.message || message).slice(0, 400);
    } catch {
      // El cuerpo no era JSON; se conserva el texto recortado.
    }

    return new GeminiRequestError(
      `Gemini ${response.status}: ${message || 'sin detalle'}`,
      response.status,
    );
  }

  private errorFromPayload(error: any): GeminiRequestError {
    const status = Number(error?.code) || 502;
    return new GeminiRequestError(
      `Gemini ${status}: ${String(error?.message || 'error en el stream').slice(0, 400)}`,
      status,
    );
  }

  // ── Utilidades ─────────────────────────────────────────────

  private assertEnabled() {
    if (!this.isEnabled()) {
      throw new GeminiRequestError('GEMINI_API_KEY no está configurada.', 503);
    }
  }

  private resolveModel(requested?: string, hasImages = false): string {
    const clean = (requested || process.env.GEMINI_MODEL || '')
      .trim()
      .replace(/^models\//, '');

    // Los callers históricos pasan modelos de Groq (p. ej. openai/gpt-oss-120b);
    // para Gemini se ignora ese id y se usa el modelo configurado.
    if (/^gemini[-.]/i.test(clean)) return clean;
    return hasImages ? this.visionModel : this.model;
  }

  private hasImages(messages: ChatMessage[]): boolean {
    return messages.some(
      (message) =>
        Array.isArray(message.content) &&
        message.content.some((part) => part?.type === 'image_url'),
    );
  }

  private contentText(content: ChatMessage['content']): string {
    if (typeof content === 'string') return content;
    return (content || [])
      .filter((part) => part?.type === 'text')
      .map((part) => (part as { text: string }).text)
      .join('\n');
  }

  private extractText(response: any): string {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';

    return parts
      .filter(
        (part: any) =>
          part && part.thought !== true && typeof part.text === 'string',
      )
      .map((part: any) => part.text)
      .join('');
  }

  private responseModel(response: any, fallback: string): string {
    const version = String(response?.modelVersion || '').replace(
      /^models\//,
      '',
    );
    return version || fallback;
  }

  private parseJson(raw: string): any {
    let text = (raw || '').trim();
    if (!text) throw new Error('Gemini devolvió un JSON vacío.');

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();

    try {
      return JSON.parse(text);
    } catch {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {
          // cae al error de abajo
        }
      }
    }

    throw new Error('Gemini devolvió un JSON inválido.');
  }

  private envNumber(
    name: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.min(max, Math.max(min, value));
  }
}
