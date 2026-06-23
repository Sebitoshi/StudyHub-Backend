export type KnowledgeVectorSource = 'memory' | 'note' | 'generated_resource' | 'conversation_summary' | 'subject';

export interface KnowledgeVectorDocument {
  userId: number;
  source: KnowledgeVectorSource;
  sourceId: string;
  topic: string;
  subject?: string | null;
  text: string;
  textHash: string;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DetectedGapCandidate {
  subject: string;
  topic: string;
  confidence: number;
  evidence: string[];
  source: 'semantic' | 'heuristic';
}
