import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingsProvider } from '../knowledge-gap-detector.contract';

type HttpEmbeddingStyle = 'ollama' | 'openai' | 'tei';

@Injectable()
export class HttpEmbeddingsProvider implements EmbeddingsProvider {
  private readonly logger = new Logger(HttpEmbeddingsProvider.name);
  private readonly url = process.env.EMBEDDINGS_HTTP_URL || '';
  private readonly model = process.env.EMBEDDINGS_HTTP_MODEL || 'nomic-embed-text';
  private readonly style = (process.env.EMBEDDINGS_HTTP_STYLE || 'ollama') as HttpEmbeddingStyle;

  isConfigured(): boolean {
    return Boolean(this.url);
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured()) {
      throw new Error('EMBEDDINGS_HTTP_URL is not configured');
    }

    const vectors: number[][] = [];
    for (const text of texts) {
      const trimmed = text.trim();
      if (!trimmed) {
        vectors.push([]);
        continue;
      }
      vectors.push(await this.requestEmbedding(trimmed));
    }
    return vectors;
  }

  private async requestEmbedding(text: string): Promise<number[]> {
    const body = this.buildRequestBody(text);
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.text();
      this.logger.error(`HTTP embeddings failed (${response.status}): ${payload}`);
      throw new Error(`HTTP embeddings request failed with status ${response.status}`);
    }

    const data = await response.json();
    return this.extractEmbedding(data);
  }

  private buildRequestBody(text: string) {
    if (this.style === 'openai') {
      return { model: this.model, input: text };
    }
    if (this.style === 'tei') {
      return { inputs: text };
    }
    return { model: this.model, prompt: text };
  }

  private extractEmbedding(data: any): number[] {
    if (Array.isArray(data?.embedding)) return data.embedding;
    if (Array.isArray(data?.data?.[0]?.embedding)) return data.data[0].embedding;
    if (Array.isArray(data?.embeddings?.[0])) return data.embeddings[0];
    if (Array.isArray(data?.[0])) return data[0];
    throw new Error('Unsupported HTTP embeddings response shape');
  }
}
