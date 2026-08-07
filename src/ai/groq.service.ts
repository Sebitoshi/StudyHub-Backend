import { Injectable, Logger } from '@nestjs/common';

interface ChatOptions {
  /** Solicitar la respuesta como JSON válido (response_format json_object). */
  json?: boolean;
  /** Límite de tokens de salida (max_tokens). */
  maxTokens?: number;
}

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private client: any | null = null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

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
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions,
  ): Promise<{ content: string; tokensUsed?: number; model?: string }> {
    if (!this.client) {
      throw new Error('Groq client not initialized');
    }

    try {
      const params: any = {
        model: this.model,
        messages,
        ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
        ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
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

      return { content, tokensUsed, model: this.model };
    } catch (err) {
      this.logger.error('Groq API call failed: ' + err);
      throw err;
    }
  }

  /**
   * Request structured JSON from the model. Parses response and returns the parsed object.
   *
   * Robustez:
   * - Pide JSON mode (response_format json_object) y un max_tokens amplio para evitar
   *   respuestas truncadas.
   * - Si el modelo no soporta JSON mode, reintenta sin él.
   * - Reintenta hasta 3 veces (la salida del LLM no es determinista) reparando el JSON
   *   en cada intento.
   */
  async chatJson(
    messages: Array<{ role: string; content: string }>,
  ): Promise<{ data: any; tokensUsed?: number; model?: string }> {
    const maxAttempts = 3;
    let jsonMode = true;
    let maxTokens = 32768;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.chat(messages, {
          json: jsonMode,
          maxTokens,
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
        const tokenLimitExceeded =
          /max_tokens|maximum.{0,20}(token|context)|exceeds.{0,20}limit/i.test(
            message,
          );

        if (jsonMode && jsonModeUnsupported) {
          this.logger.warn(
            `Model ${this.model} does not support JSON mode; retrying without it.`,
          );
          jsonMode = false;
        } else if (tokenLimitExceeded && maxTokens > 8192) {
          // El modelo tiene un límite de salida menor: reducir max_tokens y reintentar
          maxTokens = Math.floor(maxTokens / 2);
          this.logger.warn(
            `max_tokens limit reached; retrying with maxTokens=${maxTokens}.`,
          );
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
    messages: Array<{ role: string; content: string }>,
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<boolean> {
    if (!this.client) throw new Error('Groq client not initialized');

    // Try common streaming entry points
    const streamFn =
      this.client?.chat?.completions?.stream ??
      this.client?.chat?.completions?.createStream ??
      null;
    if (!streamFn) return false;

    try {
      const stream = await streamFn.call(this.client.chat.completions, {
        model: this.model,
        messages,
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
    } catch (err) {
      this.logger.error('Groq streaming failed: ' + err);
      return false;
    }
  }
}
