export interface KnowledgeItem {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface SemanticSearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface EmbeddingsProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isConfigured?(): boolean;
}

export interface VectorStore {
  upsert(userId: number, items: Array<KnowledgeItem & { embedding: number[] }>): Promise<void>;
  query(userId: number, embedding: number[], topK: number): Promise<SemanticSearchResult[]>;
}

export interface KnowledgeGapDetectOptions {
  message?: string;
  conversationId?: string;
  skipIndex?: boolean;
}

export interface KnowledgeGapDetector {
  detect(userId: number, academicContext: any, options?: KnowledgeGapDetectOptions): Promise<any[]>;
  indexKnowledge(userId: number, items: KnowledgeItem[]): Promise<boolean>;
  querySimilar(userId: number, query: string, topK?: number): Promise<SemanticSearchResult[]>;
}

/** Injection token for swapping V1 heuristics with semantic V2 without changing consumers. */
export const KNOWLEDGE_GAP_DETECTOR = Symbol('KNOWLEDGE_GAP_DETECTOR');

/** Injection token for vector store implementations (cosine today, Atlas tomorrow). */
export const VECTOR_STORE = Symbol('VECTOR_STORE');

/** Injection token for embeddings backends (HTTP local, OpenAI, etc.). */
export const EMBEDDINGS_PROVIDER = Symbol('EMBEDDINGS_PROVIDER');
