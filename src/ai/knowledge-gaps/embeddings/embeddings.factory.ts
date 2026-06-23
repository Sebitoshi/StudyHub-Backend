import { Provider } from '@nestjs/common';
import { EMBEDDINGS_PROVIDER } from '../knowledge-gap-detector.contract';
import { HttpEmbeddingsProvider } from './http-embeddings.provider';
import { OpenAiEmbeddingsProvider } from './openai-embeddings.provider';

export const embeddingsProviderFactory: Provider = {
  provide: EMBEDDINGS_PROVIDER,
  useFactory: (httpProvider: HttpEmbeddingsProvider, openAiProvider: OpenAiEmbeddingsProvider) => {
    if (httpProvider.isConfigured()) return httpProvider;
    if (openAiProvider.isConfigured()) return openAiProvider;
    return {
      isConfigured: () => false,
      embed: async () => {
        throw new Error('No embeddings provider configured. Set EMBEDDINGS_HTTP_URL or OPENAI_API_KEY.');
      },
      embedBatch: async () => {
        throw new Error('No embeddings provider configured. Set EMBEDDINGS_HTTP_URL or OPENAI_API_KEY.');
      },
    };
  },
  inject: [HttpEmbeddingsProvider, OpenAiEmbeddingsProvider],
};
