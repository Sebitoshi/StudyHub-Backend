import { Module } from '@nestjs/common';
import { KnowledgeGapsService } from './knowledge-gaps.service';
import { KnowledgeGapsRepository } from './knowledge-gaps.repository';
import { SemanticDetectorService } from './semantic-detector.service';
import { KNOWLEDGE_GAP_DETECTOR, VECTOR_STORE } from './knowledge-gap-detector.contract';
import { mongoProviders } from '../mongo.provider';
import { MemoryModule } from '../memory/memory.module';
import { KnowledgeVectorsRepository } from './knowledge-vectors.repository';
import { MongoCosineVectorStore } from './vector-store/mongo-cosine.vector-store';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { OpenAiEmbeddingsProvider } from './embeddings/openai-embeddings.provider';
import { HttpEmbeddingsProvider } from './embeddings/http-embeddings.provider';
import { embeddingsProviderFactory } from './embeddings/embeddings.factory';
import { GeneratedResourcesRepository } from '../generated-resources/generated-resources.repository';
import { LearningAnalyticsRepository } from '../learning-analytics/learning-analytics.repository';
import { LearningAnalyticsService } from '../learning-analytics/learning-analytics.service';
import { GapConfidenceEngine } from './gap-confidence.engine';
import { GapRecoveryService } from './gap-recovery.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [MemoryModule, PrismaModule],
  providers: [
    ...mongoProviders,
    KnowledgeGapsService,
    KnowledgeGapsRepository,
    KnowledgeVectorsRepository,
    OpenAiEmbeddingsProvider,
    HttpEmbeddingsProvider,
    embeddingsProviderFactory,
    MongoCosineVectorStore,
    {
      provide: VECTOR_STORE,
      useExisting: MongoCosineVectorStore,
    },
    KnowledgeIndexerService,
    SemanticDetectorService,
    GeneratedResourcesRepository,
    LearningAnalyticsRepository,
    LearningAnalyticsService,
    GapConfidenceEngine,
    GapRecoveryService,
    {
      provide: KNOWLEDGE_GAP_DETECTOR,
      useExisting: SemanticDetectorService,
    },
  ],
  exports: [KnowledgeGapsService, SemanticDetectorService, KNOWLEDGE_GAP_DETECTOR],
})
export class KnowledgeGapsModule {}
