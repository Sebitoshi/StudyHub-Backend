import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GroqService {
  private readonly logger = new Logger(GroqService.name);
  private client: any | null = null;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is required for GroqService');
    }

    try {
      // Use official Groq SDK
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Groq } = require('groq-sdk');
      this.client = new Groq({ apiKey });
      this.logger.log('Groq client configured');
    } catch (err) {
      this.logger.error('Failed to initialize Groq client. Ensure `groq` SDK is installed and GROQ_API_KEY is set. ' + err);
      throw err;
    }
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<{ content: string; tokensUsed?: number; model?: string }> {
    if (!this.client) {
      throw new Error('Groq client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({ model: this.model, messages });

      // Try to extract content from common response shapes
      const content =
        response?.choices?.[0]?.message?.content ?? response?.choices?.[0]?.text ?? response?.output?.[0]?.content ?? JSON.stringify(response);
      const tokensUsed = response?.usage?.total_tokens ?? response?.usage?.totalTokens ?? null;

      return { content, tokensUsed, model: this.model };
    } catch (err) {
      this.logger.error('Groq API call failed: ' + err);
      throw err;
    }
  }

  /**
   * Request structured JSON from the model. Parses response and returns the parsed object.
   */
  async chatJson(messages: Array<{ role: string; content: string }>): Promise<{ data: any; tokensUsed?: number; model?: string }> {
    const response = await this.chat(messages);
    const data = this.parseJsonContent(response.content);
    return { data, tokensUsed: response.tokensUsed, model: response.model };
  }

  private parseJsonContent(raw: string): any {
    const text = (raw || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced?.[1] || text).trim();
    try {
      return JSON.parse(candidate);
    } catch (err) {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(candidate.slice(start, end + 1));
      }
      throw new Error('Failed to parse JSON from Groq response: ' + err);
    }
  }

  /**
   * Try to stream completions if the SDK exposes a streaming interface.
   * onChunk will be called with partial strings as they arrive.
   * Returns true if streaming was used, false otherwise.
   */
  async stream(messages: Array<{ role: string; content: string }>, onChunk: (chunk: string) => Promise<void> | void): Promise<boolean> {
    if (!this.client) throw new Error('Groq client not initialized');

    // Try common streaming entry points
    const streamFn = this.client?.chat?.completions?.stream ?? this.client?.chat?.completions?.createStream ?? null;
    if (!streamFn) return false;

    try {
      const stream = await streamFn.call(this.client.chat.completions, { model: this.model, messages });

      // If the stream is async iterable, iterate and forward chunks
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const part of stream) {
          // Try to extract text chunk from common shapes
          const chunk = part?.delta?.content ?? part?.choices?.[0]?.delta?.content ?? part?.text ?? part?.content ?? JSON.stringify(part);
          if (chunk) await onChunk(chunk);
        }
        return true;
      }

      // If stream provides an on('data') API
      if (typeof stream.on === 'function') {
        stream.on('data', async (part: any) => {
          const chunk = part?.delta?.content ?? part?.choices?.[0]?.delta?.content ?? part?.text ?? part?.content ?? JSON.stringify(part);
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
