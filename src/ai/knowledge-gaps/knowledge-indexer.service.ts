import { Inject, Injectable, Logger } from '@nestjs/common';
import { Collection } from 'mongodb';
import { PrismaService } from '../../prisma/prisma.service';
import { CONVERSATIONS_COLLECTION, MESSAGES_COLLECTION } from '../mongo.provider';
import { GeneratedResourcesRepository } from '../generated-resources/generated-resources.repository';
import { MemoryRepository } from '../memory/memory.repository';
import { EMBEDDINGS_PROVIDER } from './knowledge-gap-detector.contract';
import type { EmbeddingsProvider, KnowledgeItem } from './knowledge-gap-detector.contract';
import { hashKnowledgeText, KnowledgeVectorsRepository } from './knowledge-vectors.repository';
import { KnowledgeVectorSource } from './knowledge-vector.types';

@Injectable()
export class KnowledgeIndexerService {
  private readonly logger = new Logger(KnowledgeIndexerService.name);
  private readonly lastSyncAt = new Map<number, number>();
  private readonly syncTtlMs = Number(process.env.KNOWLEDGE_INDEX_TTL_MS || 5 * 60 * 1000);

  constructor(
    private readonly memoryRepo: MemoryRepository,
    private readonly resourcesRepo: GeneratedResourcesRepository,
    private readonly vectorsRepo: KnowledgeVectorsRepository,
    private readonly prisma: PrismaService,
    @Inject(EMBEDDINGS_PROVIDER) private readonly embeddings: EmbeddingsProvider,
    @Inject(CONVERSATIONS_COLLECTION) private readonly conversations: Collection,
    @Inject(MESSAGES_COLLECTION) private readonly messages: Collection,
  ) {}

  async syncUserKnowledge(userId: number, academicContext: any, force = false): Promise<number> {
    if (!this.embeddings.isConfigured?.()) {
      return 0;
    }

    const now = Date.now();
    const lastSync = this.lastSyncAt.get(userId) || 0;
    if (!force && now - lastSync < this.syncTtlMs) {
      return 0;
    }

    const items = await this.collectItems(userId, academicContext);
    const indexed = await this.indexItems(userId, items);
    this.lastSyncAt.set(userId, now);
    return indexed;
  }

  async collectItems(userId: number, academicContext: any): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = [];

    const memories = await this.memoryRepo.findByUser(userId);
    for (const memory of memories || []) {
      const text = [memory.key, memory.value].filter(Boolean).join(' — ');
      if (!text.trim()) continue;
      items.push({
        id: String(memory._id),
        text,
        metadata: {
          source: 'memory' as KnowledgeVectorSource,
          sourceId: String(memory._id),
          topic: this.extractTopicFromMemory(memory),
          subject: this.extractSubjectFromMemory(memory, academicContext),
          memoryType: memory.type,
          textHash: hashKnowledgeText(text),
        },
      });
    }

    const notes = await this.prisma.note.findMany({
      where: { subject: { userId } },
      include: { subject: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    for (const note of notes) {
      const text = [note.title, note.content].filter(Boolean).join('\n').slice(0, 4000);
      if (!text.trim()) continue;
      items.push({
        id: String(note.id),
        text,
        metadata: {
          source: 'note' as KnowledgeVectorSource,
          sourceId: String(note.id),
          topic: note.title || 'Nota sin título',
          subject: note.subject?.nombre || null,
          textHash: hashKnowledgeText(text),
        },
      });
    }

    const resources = await this.resourcesRepo.findByUser(userId);
    for (const resource of resources || []) {
      const text = this.resourceToText(resource);
      if (!text.trim()) continue;
      items.push({
        id: String(resource.id || resource._id),
        text,
        metadata: {
          source: 'generated_resource' as KnowledgeVectorSource,
          sourceId: String(resource.id || resource._id),
          topic: resource.title || String(resource.type || resource.resourceType || 'Recurso'),
          subject: resource.subject || null,
          resourceType: resource.type || resource.resourceType,
          textHash: hashKnowledgeText(text),
        },
      });
    }

    const subjects = academicContext?.subjects || [];
    for (const subject of subjects) {
      const pendingTitles = (subject.tasksPending || []).map((task: any) => task.title).filter(Boolean);
      const text = [subject.name, subject.professor, ...pendingTitles].filter(Boolean).join('\n');
      if (!text.trim()) continue;
      items.push({
        id: `subject:${subject.id}`,
        text,
        metadata: {
          source: 'subject' as KnowledgeVectorSource,
          sourceId: String(subject.id),
          topic: subject.name,
          subject: subject.name,
          textHash: hashKnowledgeText(text),
        },
      });
    }

    const conversations = await this.conversations.find({ userId }).sort({ lastMessageAt: -1 }).limit(20).toArray();
    for (const conversation of conversations) {
      const summary = await this.buildConversationSummary(conversation._id, conversation.title);
      if (!summary.trim()) continue;
      items.push({
        id: String(conversation._id),
        text: summary,
        metadata: {
          source: 'conversation_summary' as KnowledgeVectorSource,
          sourceId: String(conversation._id),
          topic: conversation.title || 'Conversación reciente',
          subject: null,
          textHash: hashKnowledgeText(summary),
        },
      });
    }

    return items;
  }

  async indexItems(userId: number, items: KnowledgeItem[]): Promise<number> {
    if (!items.length) return 0;

    const pending: KnowledgeItem[] = [];
    for (const item of items) {
      const source = item.metadata?.source as KnowledgeVectorSource;
      const sourceId = item.metadata?.sourceId || item.id;
      const textHash = item.metadata?.textHash || hashKnowledgeText(item.text);
      const existing = await this.vectorsRepo.findOneBySource(userId, source, sourceId);
      if (existing?.textHash === textHash) continue;
      pending.push({ ...item, metadata: { ...(item.metadata || {}), textHash } });
    }

    if (!pending.length) return 0;

    const batchSize = Number(process.env.KNOWLEDGE_EMBED_BATCH_SIZE || 16);
    let indexed = 0;

    for (let i = 0; i < pending.length; i += batchSize) {
      const chunk = pending.slice(i, i + batchSize);
      const embeddings = await this.embeddings.embedBatch(chunk.map((item) => item.text));

      for (let j = 0; j < chunk.length; j++) {
        const item = chunk[j];
        const embedding = embeddings[j];
        if (!embedding?.length) continue;

        const source = item.metadata?.source as KnowledgeVectorSource;
        const sourceId = item.metadata?.sourceId || item.id;
        await this.vectorsRepo.upsertVector(userId, source, sourceId, {
          topic: item.metadata?.topic || item.text.slice(0, 80),
          subject: item.metadata?.subject || null,
          text: item.text,
          textHash: item.metadata?.textHash || hashKnowledgeText(item.text),
          embedding,
          metadata: item.metadata || {},
        });
        indexed += 1;
      }
    }

    this.logger.log(`Indexed ${indexed} knowledge vectors for user ${userId}`);
    return indexed;
  }

  private async buildConversationSummary(conversationId: any, title?: string | null) {
    const rows = await this.messages.find({ conversationId }).sort({ createdAt: -1 }).limit(12).toArray();
    const ordered = rows.reverse();
    const userLines = ordered.filter((row) => row.role === 'user').map((row) => row.content).filter(Boolean);
    const assistantLines = ordered.filter((row) => row.role === 'assistant').map((row) => row.content).filter(Boolean);

    const parts = [
      title ? `Título: ${title}` : null,
      userLines.length ? `Preguntas del estudiante:\n${userLines.join('\n')}` : null,
      assistantLines.length ? `Respuestas del profesor:\n${assistantLines.slice(-3).join('\n')}` : null,
    ].filter(Boolean);

    return parts.join('\n\n').slice(0, 4000);
  }

  private resourceToText(resource: any): string {
    const type = String(resource.type || resource.resourceType || 'RESOURCE');
    const title = resource.title || type;
    const content = resource.content;
    if (typeof content === 'string') return `${title}\n${content}`.slice(0, 4000);
    if (content && typeof content === 'object') return `${title}\n${JSON.stringify(content)}`.slice(0, 4000);
    return title;
  }

  private extractTopicFromMemory(memory: any): string {
    if (memory.value) return String(memory.value).slice(0, 120);
    if (memory.key?.includes(':')) return memory.key.split(':').slice(1).join(':');
    return String(memory.key || memory.type || 'Memoria');
  }

  private extractSubjectFromMemory(memory: any, academicContext: any): string | null {
    if (memory.key?.includes(':')) {
      const candidate = memory.key.split(':')[1];
      if (candidate) return candidate;
    }
    const subjects = academicContext?.subjects || [];
    const text = `${memory.key || ''} ${memory.value || ''}`.toLowerCase();
    for (const subject of subjects) {
      if (subject.name && text.includes(String(subject.name).toLowerCase())) {
        return subject.name;
      }
    }
    return null;
  }
}
