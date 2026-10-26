import { Injectable, Logger } from '@nestjs/common';

/** Parte de un mensaje multimodal (texto o imagen). */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatContent = string | ChatContentPart[];

export interface ChatMessage {
  role: string;
  content: ChatContent;
}

interface ChatOptions {
  /** Solicitar la respuesta como JSON válido (response_format json_object). */
  json?: boolean;
  /** Límite de tokens de salida (max_tokens). */
  maxTokens?: number;
  /** Modelo para esta llamada (p. ej. el modelo multimodal de visión). */
  model?: string;
  /** Temperatura de muestreo (0 = determinista). */
  temperature?: number;
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private client: any | null = null;
  private readonly model: string;
  private readonly fallbackModels: string[];
  private readonly defaultMaxTokens: number;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    this.fallbackModels = this.parseModelList(
      process.env.GROQ_FALLBACK_MODELS,
      'openai/gpt-oss-120b,llama-3.3-70b-versatile,llama-3.1-8b-instant',
    ).filter((model) => model !== this.model);
    this.defaultMaxTokens = this.envNumber(
      'GROQ_CHAT_MAX_TOKENS',
      900,
      128,
      4096,
    );

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required for GroqService');
    }

    try {
      // Use official Groq SDK

      const { Groq } = require('groq-sdk');
      this.client = new Groq({ apiKey });
      this.logger.log('Groq client configured');
    } catch (err) {
      this.logger.error(
        'Failed to initialize Groq client. Ensure `groq` SDK is installed and GROQ_API_KEY is set. ' +
          err,
      );
      throw err;
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<{ content: string; tokensUsed?: number; model?: string }> {
    if (!this.client) {
      throw new Error('Groq client not initialized');
    }

    const models = this.modelCandidates(options?.model);
    let lastError: any;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];

      try {
        return await this.requestChat(model, messages, options);
      } catch (err) {
        lastError = err;
        if (i < models.length - 1 && this.shouldTryNextModel(err)) {
          this.logger.warn(
            `Groq ${model} falló (${this.errorMessage(err)}); probando ${models[i + 1]}.`,
          );
          continue;
        }
        this.logger.error('Groq API call failed: ' + err);
        throw err;
      }
    }

    throw lastError;
  }

  private async requestChat(
    model: string,
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<{ content: string; tokensUsed?: number; model?: string }> {
    const maxTokens = this.maxTokensFor(model, options?.maxTokens);
    const params: any = {
      model,
      messages,
      ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
      max_tokens: maxTokens,
      ...(options?.temperature !== undefined
        ? { temperature: options.temperature }
        : {}),
    };

    const response = await this.client.chat.completions.create(params);

    // Try to extract content from common response shapes
    const content =
      response?.choices?.[0]?.message?.content ??
      response?.choices?.[0]?.text ??
      response?.output?.[0]?.content ??
      JSON.stringify(response);
    const tokensUsed =
      response?.usage?.total_tokens ?? response?.usage?.totalTokens ?? null;

    return { content, tokensUsed, model };
  }

  /**
   * Request structured JSON from the model. Parses response and returns the parsed object.
   *
   * Robustez:
   * - Pide JSON mode (response_format json_object) y un max_tokens acotado al límite
   *   de tokens por minuto (TPM) del plan (GROQ_MAX_TOKENS, default 6000): el tier
   *   gratuito de Groq rechaza con 413 si input + max_tokens supera el TPM (8000 en
   *   openai/gpt-oss-120b).
   * - Si el modelo no soporta JSON mode, reintenta sin él.
   * - Si el error es de límite de tokens/TPM, reduce max_tokens y reintenta.
   * - Reintenta hasta 3 veces (la salida del LLM no es determinista) reparando el JSON
   *   en cada intento.
   */
  async chatJson(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<{ data: any; tokensUsed?: number; model?: string }> {
    const maxAttempts = 3;
    let jsonMode = true;
    // Default 6000 (cabe en el TPM 8000 del tier gratuito dejando margen para el input).
    // Techo de 7500 para que un valor alto en el env no reproduzca el 413.
    let maxTokens =
      options?.maxTokens ??
      Math.min(Number(process.env.GROQ_MAX_TOKENS) || 6000, 7500);
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.chat(messages, {
          json: jsonMode,
          maxTokens,
          model: options?.model,
          temperature: options?.temperature,
        });
        const data = this.parseJsonContent(response.content);
        return { data, tokensUsed: response.tokensUsed, model: response.model };
      } catch (err) {
        lastError = err;
        const message = String(err?.message ?? err);
        const jsonModeUnsupported =
          /response_format/.test(message) ||
          /(not supported|unsupported|not valid|invalid|does not support|doesn't support|only supported).{0,60}(response_format|json)/i.test(
            message,
          );
        const rateLimited =
          /rate_limit|request too large|output tokens per minute|OTPM/i.test(message);
        const tokenLimitExceeded =
          /max_tokens|maximum.{0,20}(token|context)|exceeds.{0,20}limit|tokens per minute|\bTPM\b|rate_limit|request too large|reduce your message/i.test(
            message,
          );

        if (jsonMode && jsonModeUnsupported) {
          this.logger.warn(
            `Model ${options?.model || this.model} does not support JSON mode; retrying without it.`,
          );
          jsonMode = false;
        } else if (rateLimited) {
          // Límite de tokens de salida por minuto (OTPM). No sirve reintentar con
          // el mismo max_tokens: se recorta por debajo del límite y se espera a
          // que se reinicie la ventana (Groq lo indica en las cabeceras).
          const limitMatch = message.match(/output tokens per minute \(OTPM\)[^]*?Limit\s+(\d+)/i);
          const limit = Number(limitMatch?.[1]) || 1000;
          const safe = Math.max(256, Math.min(900, limit - 100));
          if (maxTokens > safe) maxTokens = safe;

          const waitSeconds = this.rateLimitResetSeconds(err);
          this.logger.warn(
            `Límite OTPM alcanzado (${limit}); reintentando con maxTokens=${maxTokens} en ${waitSeconds}s.`,
          );
          await new Promise((r) => setTimeout(r, waitSeconds * 1000 + 400));
        } else if (tokenLimitExceeded && maxTokens > 1024) {
          // Límite de tokens/TPM alcanzado (ej. 413): recortar max_tokens y reintentar
          maxTokens = Math.max(1024, maxTokens - 2048);
          this.logger.warn(
            `Token/TPM limit reached; retrying with maxTokens=${maxTokens}.`,
          );
          // Los límites TPM se miden por ventana de 1 minuto: dar tiempo entre intentos
          await new Promise((r) => setTimeout(r, 1000));
        } else if (jsonMode && attempt >= 2) {
          // Si dos intentos con JSON mode fallaron por cualquier motivo, probar sin él
          this.logger.warn(
            `chatJson attempt ${attempt}/${maxAttempts} failed; retrying without JSON mode.`,
          );
          jsonMode = false;
        } else {
          this.logger.warn(
            `chatJson attempt ${attempt}/${maxAttempts} failed: ${message}`,
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Segundos que hay que esperar para que Groq reinicie la ventana de tokens.
   * Se lee de las cabeceras de la respuesta 429 y se acota para no bloquear la
   * función más de la cuenta.
   */
  private rateLimitResetSeconds(err: any): number {
    const header =
      err?.headers?.get?.('x-ratelimit-reset-tokens') ??
      err?.headers?.['x-ratelimit-reset-tokens'];
    if (typeof header === 'string') {
      const match = header.match(/([\d.]+)\s*s/i);
      if (match) return Math.min(30, Math.ceil(Number(match[1])));
    }

    const retryAfter =
      err?.headers?.get?.('retry-after') ?? err?.headers?.['retry-after'];
    if (retryAfter !== undefined && !Number.isNaN(Number(retryAfter))) {
      return Math.min(30, Math.max(1, Number(retryAfter)));
    }

    return 12;
  }

  /**
   * Si el caller pide un modelo concreto (p. ej. uno de visión), se respeta y
   * no se cambia por un modelo de texto. Para el modelo por defecto se prueban
   * alternativas gratuitas cuando el principal está limitado o retirado.
   */
  private modelCandidates(requested?: string): string[] {
    const clean = requested?.trim();
    if (clean) return [clean];

    return [this.model, ...this.fallbackModels].filter(
      (model, index, all) => !!model && all.indexOf(model) === index,
    );
  }

  private maxTokensFor(model: string, requested?: number): number {
    const value = Number(requested);
    const base =
      Number.isFinite(value) && value > 0 ? value : this.defaultMaxTokens;
    // qwen/qwen3.8-27b del tier gratuito tiene un OTPM de 1000. Los modelos
    // de respaldo aceptan más, pero no necesitamos respuestas gigantes.
    const cap = /qwen/i.test(model) ? 900 : 2048;
    return Math.max(128, Math.min(base, cap));
  }

  private shouldTryNextModel(err: any): boolean {
    const status = Number(err?.status ?? err?.response?.status ?? 0);
    if (status === 401 || status === 403) return false;

    const message = this.errorMessage(err);
    if (
      status === 400 &&
      !/model|decommission|not found|not supported|does not exist/i.test(
        message,
      )
    ) {
      return false;
    }

    return (
      status === 404 ||
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      /rate_limit|OTPM|TPM|model_not_found|decommission|not found|not supported|does not exist/i.test(
        message,
      )
    );
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 300);
    return String(error).slice(0, 300);
  }

  private parseModelList(raw: string | undefined, fallback: string): string[] {
    const source = raw?.trim() ? raw : fallback;
    return source
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean);
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

  private parseJsonContent(raw: string): any {
    const text = (raw || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let candidate = (fenced?.[1] || text).trim();

    // 1) Intento directo (preserva arrays válidos de nivel superior)
    try {
      return JSON.parse(candidate);
    } catch {
      /* continuar con reparaciones */
    }

    // 2) Extraer el primer objeto JSON completo (ignora prosa antes/después)
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      candidate = candidate.slice(start, end + 1);
    }
    try {
      return JSON.parse(candidate);
    } catch {
      /* continuar */
    }

    // 3) Eliminar comas finales (`,}` o `,]`) fuera de strings
    candidate = this.removeTrailingCommas(candidate);
    try {
      return JSON.parse(candidate);
    } catch {
      /* continuar */
    }

    // 4) Reparar JSON truncado: cerrar strings y estructuras abiertas y, si aún falla,
    //    recortar progresivamente el último elemento incompleto.
    let lastParseError: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      const completed = this.completeTruncatedJson(candidate);
      if (completed === null) break;
      try {
        return JSON.parse(completed);
      } catch (err) {
        lastParseError = err;
        /* recortar en la última coma y reintentar */
      }
      const cut = this.lastCommaPosition(completed);
      if (cut <= 0) break;
      candidate = completed.slice(0, cut);
    }

    throw new Error(
      'Failed to parse JSON from Groq response: ' +
        (lastParseError?.message ?? lastParseError),
    );
  }

  /** Elimina comas finales (`,}` / `,]`) que estén fuera de strings. */
  private removeTrailingCommas(candidate: string): string {
    const result: string[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        result.push(ch);
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        result.push(ch);
        continue;
      }
      if (ch === ',') {
        let j = i + 1;
        while (j < candidate.length && /\s/.test(candidate[j])) j++;
        if (
          j < candidate.length &&
          (candidate[j] === '}' || candidate[j] === ']')
        ) {
          continue; // descartar la coma final
        }
      }
      result.push(ch);
    }
    return result.join('');
  }

  /**
   * Cierra strings y estructuras abiertas de un JSON truncado a mitad de respuesta.
   * Devuelve null si el JSON no es reparable (estructura inválida).
   */
  private completeTruncatedJson(candidate: string): string | null {
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    let lastStringStart = -1;

    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        lastStringStart = i;
        continue;
      }
      if (ch === '{' || ch === '[') {
        stack.push(ch);
        continue;
      }
      if (ch === '}' || ch === ']') {
        const open = stack.pop();
        const expected = open === '{' ? '}' : ']';
        if (ch !== expected) return null; // estructura inválida, no reparable
      }
    }

    let result = candidate;
    if (inString) {
      if (lastStringStart < 0) return null;
      // Recortar el contenido incompleto de la última string y cerrarla
      result = result.slice(0, lastStringStart + 1) + '"';
    }

    // Cerrar las estructuras que quedaron abiertas
    while (stack.length) {
      const open = stack.pop();
      result += open === '{' ? '}' : ']';
    }

    return result;
  }

  /** Posición de la última coma que está fuera de una string. */
  private lastCommaPosition(candidate: string): number {
    let inString = false;
    let escaped = false;
    let lastComma = -1;
    for (let i = 0; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === ',') lastComma = i;
    }
    return lastComma;
  }

  /**
   * Try to stream completions if the SDK exposes a streaming interface.
   * onChunk will be called with partial strings as they arrive.
   * Returns true if streaming was used, false otherwise.
   */
  async stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<boolean> {
    if (!this.client) throw new Error('Groq client not initialized');

    const models = this.modelCandidates();
    let lastError: any;

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      let emitted = false;

      try {
        const used = await this.streamModel(model, messages, async (chunk) => {
          emitted = true;
          await onChunk(chunk);
        });
        if (used) return true;
        if (i === models.length - 1) return false;
      } catch (err) {
        lastError = err;
        if (emitted) {
          this.logger.error('Groq streaming failed: ' + err);
          return false;
        }
        if (i < models.length - 1 && this.shouldTryNextModel(err)) {
          this.logger.warn(
            `Groq ${model} falló en stream (${this.errorMessage(err)}); probando ${models[i + 1]}.`,
          );
          continue;
        }
        this.logger.error('Groq streaming failed: ' + err);
        return false;
      }
    }

    this.logger.error('Groq streaming failed: ' + lastError);
    return false;
  }

  private async streamModel(
    model: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<boolean> {
    // Try common streaming entry points
    const streamFn =
      this.client?.chat?.completions?.stream ??
      this.client?.chat?.completions?.createStream ??
      null;
    if (!streamFn) return false;

    const stream = await streamFn.call(this.client.chat.completions, {
      model,
      messages,
      max_tokens: this.maxTokensFor(model),
    });

    // If the stream is async iterable, iterate and forward chunks
    if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
      for await (const part of stream) {
        // Try to extract text chunk from common shapes
        const chunk =
          part?.delta?.content ??
          part?.choices?.[0]?.delta?.content ??
          part?.text ??
          part?.content ??
          JSON.stringify(part);
        if (chunk) await onChunk(chunk);
      }
      return true;
    }

    // If stream provides an on('data') API
    if (typeof stream.on === 'function') {
      stream.on('data', async (part: any) => {
        const chunk =
          part?.delta?.content ??
          part?.choices?.[0]?.delta?.content ??
          part?.text ??
          part?.content ??
          JSON.stringify(part);
        if (chunk) await onChunk(chunk);
      });
      // await finished
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      return true;
    }

    return false;
  }
}
