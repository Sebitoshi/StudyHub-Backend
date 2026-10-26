import { Injectable, Logger } from '@nestjs/common';
import { GeminiRequestError, GeminiService } from './gemini.service';
import { GroqService } from './groq.service';
import type { ChatMessage } from './groq.service';

export interface AiChatOptions {
  json?: boolean;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}

export interface AiChatResponse {
  content: string;
  tokensUsed?: number;
  model?: string;
  provider?: 'gemini' | 'groq';
}

export interface AiStreamResult {
  used: boolean;
  model?: string;
  provider: 'gemini' | 'groq';
}

/**
 * Enrutador de IA: Gemini responde primero y Groq entra solo si Gemini falla,
 * no está configurado o está en enfriamiento. Los servicios existentes siguen
 * llamando a `chat`, `chatJson` y `stream` sin cambiar su lógica.
 */
@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly cooldownMs: number;
  private geminiCooldownUntil = 0;

  constructor(
    private readonly gemini: GeminiService,
    private readonly groq: GroqService,
  ) {
    this.cooldownMs = this.envNumber('AI_FALLBACK_COOLDOWN_MS', 30_000);
  }

  /** Proveedor que respondería ahora mismo (útil para diagnóstico y tests). */
  primary(): 'gemini' | 'groq' {
    return this.canUseGemini() ? 'gemini' : 'groq';
  }

  async chat(
    messages: ChatMessage[],
    options?: AiChatOptions,
  ): Promise<AiChatResponse> {
    const fromGemini = await this.tryGemini('chat', () =>
      this.gemini.chat(messages, options),
    );
    if (fromGemini) return { ...fromGemini, provider: 'gemini' };

    const fromGroq = await this.groq.chat(messages, options);
    return { ...fromGroq, provider: 'groq' };
  }

  async chatJson(
    messages: ChatMessage[],
    options?: AiChatOptions,
  ): Promise<{
    data: any;
    tokensUsed?: number;
    model?: string;
    provider?: 'gemini' | 'groq';
  }> {
    const fromGemini = await this.tryGemini('chatJson', () =>
      this.gemini.chatJson(messages, options),
    );
    if (fromGemini) return { ...fromGemini, provider: 'gemini' };

    const fromGroq = await this.groq.chatJson(messages, options);
    return { ...fromGroq, provider: 'groq' };
  }

  /**
   * Streaming con fallback sin duplicar texto: si Gemini ya emitió parte de la
   * respuesta, el error se propaga; solo se pasa a Groq si no llegó nada.
   */
  async stream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => Promise<void> | void,
  ): Promise<AiStreamResult> {
    if (this.canUseGemini()) {
      let emitted = false;

      try {
        const result = await this.gemini.stream(messages, async (chunk) => {
          emitted = true;
          await onChunk(chunk);
        });
        if (result.used) return { ...result, provider: 'gemini' };
      } catch (error) {
        this.markGeminiFailure(error);
        if (emitted) {
          this.logger.error(
            `Gemini cortó el stream tras emitir texto; no se reintenta con Groq para no duplicar: ${this.errorMessage(error)}`,
          );
          throw error;
        }
        this.logger.warn(
          `Gemini no pudo iniciar el stream; se usa Groq: ${this.errorMessage(error)}`,
        );
      }
    }

    const used = await this.groq.stream(messages, onChunk);
    return {
      used,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      provider: 'groq',
    };
  }

  private canUseGemini(): boolean {
    return this.gemini.isEnabled() && Date.now() >= this.geminiCooldownUntil;
  }

  private async tryGemini<T>(
    operation: string,
    run: () => Promise<T>,
  ): Promise<T | null> {
    if (!this.canUseGemini()) return null;

    try {
      const result = await run();
      this.geminiCooldownUntil = 0;
      return result;
    } catch (error) {
      this.markGeminiFailure(error);
      this.logger.warn(
        `Gemini falló en ${operation}; se usa Groq: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Solo se apaga Gemini para fallos del proveedor (clave, cuota, modelo o
   * red). Un prompt bloqueado, un 400 de contenido o un JSON inválido son
   * fallos de esa respuesta y no deben afectar a las demás peticiones.
   */
  private markGeminiFailure(error: unknown) {
    if (error instanceof GeminiRequestError) {
      const status = Number(error.status) || 0;
      const message = this.errorMessage(error);
      const invalidKey = /api.?key|permission|unauthorized|forbidden/i.test(
        message,
      );
      const providerFailure =
        status === 401 ||
        status === 403 ||
        status === 404 ||
        status === 429 ||
        status === 500 ||
        status === 503 ||
        status === 504 ||
        invalidKey;
      if (providerFailure) {
        this.geminiCooldownUntil = Date.now() + this.cooldownMs;
      }
      return;
    }

    const isBadOutput = /json|vac[íi]o|empty/i.test(this.errorMessage(error));
    if (!isBadOutput) {
      this.geminiCooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 300);
    return String(error).slice(0, 300);
  }

  private envNumber(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    if (!Number.isFinite(value) || value < 0) return fallback;
    return value;
  }
}
