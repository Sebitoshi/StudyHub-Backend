import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsProvider } from '../knowledge-gap-detector.contract';

@Injectable()
export class OpenAiEmbeddingsProvider implements EmbeddingsProvider {
  private readonly logger = new Logger(OpenAiEmbeddingsProvider.name);
  private readonly apiKey = process.env.OPENAI_API_KEY || '';
  private readonly model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  private readonly baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured()) {
      throw new Error('OPENAI_API_KEY is not configured for embeddings');
    }

    const input = texts.map((text) => text.trim()).filter(Boolean);
    if (!input.length) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`OpenAI embeddings failed (${response.status}): ${body}`);
      throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    return (data.data || []).map((row) => row.embedding);
  }
}
