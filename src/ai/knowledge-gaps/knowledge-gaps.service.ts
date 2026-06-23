import { Inject, Injectable, Logger } from '@nestjs/common';
import { KnowledgeGapsRepository } from './knowledge-gaps.repository';
import { MemoryRepository } from '../memory/memory.repository';
import { LEARNING_ANALYTICS_COLLECTION, MESSAGES_COLLECTION, MEMORIES_COLLECTION } from '../mongo.provider';
import { Collection } from 'mongodb';

@Injectable()
export class KnowledgeGapsService {
  private readonly logger = new Logger(KnowledgeGapsService.name);

  constructor(
    private readonly repo: KnowledgeGapsRepository,
    private readonly memoryRepo: MemoryRepository,
    @Inject(MESSAGES_COLLECTION) private readonly messages: Collection,
  ) {}

  /**
   * Detect gaps using learning analytics, teacher memories and recent messages.
   * This is a heuristic V1 implementation.
   */
  async detectAndUpsertGaps(userId: number, academicContext: any) {
    const created: any[] = [];

    // 1) From teacher memories: KNOWLEDGE_GAP, RECURRING_MISTAKE, WEAK_SKILL
    const mems = await this.memoryRepo.findByUser(userId);
    const relevant = (mems || []).filter((m) => ['KNOWLEDGE_GAP', 'RECURRING_MISTAKE', 'WEAK_SKILL'].includes(m.type));
    for (const m of relevant) {
      const subject = m.key.includes(':') ? m.key.split(':')[1] : (academicContext?.subjects?.[0]?.name || 'general');
      const topic = m.value || m.key;
      const evid = `memory:${m._id}`;
      const confidence = Math.min((m.confidence || 0.6) + 0.1, 0.95);
      const doc = { confidence, status: 'DETECTED', evidence: [evid] };
      const up = await this.repo.upsert(userId, subject, topic, doc);
      created.push(up);
    }

    // 2) From recent messages: repeated questions and explicit phrases
    const recentMsgs = await this.messages.find({ userId, role: 'user' }).sort({ createdAt: -1 }).limit(500).toArray();
    const texts = recentMsgs.map((r) => (r.content || '').toLowerCase());
    // count occurrences of keywords
    const freq: Record<string, number> = {};
    for (const t of texts) {
      const words = t.replace(/[^a-z0-9áéíóúñ ]/gi, ' ').split(/\s+/).filter(Boolean);
      for (let i = 0; i < Math.min(words.length, 8); i++) {
        const w = words[i];
        if (w.length < 4) continue;
        freq[w] = (freq[w] || 0) + 1;
      }
    }
    // any token repeated > 3 times may indicate a gap
    for (const [token, count] of Object.entries(freq)) {
      if (count >= 3) {
        const subj = academicContext?.subjects?.find((s) => (s.name || '').toLowerCase().includes(token))?.name || 'general';
        const topic = token;
        const evid = `messages:token:${token}`;
        const confidence = Math.min(0.4 + Math.min(count / 10, 0.5), 0.9);
        const doc = { confidence, status: 'DETECTED', evidence: [evid] };
        const up = await this.repo.upsert(userId, subj, topic, doc);
        created.push(up);
      }
    }

    // 3) From subject topics vs asked topics -> detect missing concepts (low confidence)
    try {
      const subjects = academicContext?.subjects || [];
      for (const s of subjects) {
        const name = (s.name || '').toLowerCase();
        // build subject keyword set from name and notes/snippets
        const keywords = new Set<string>();
        if (name) keywords.add(name);
        if (s.tasks) for (const t of s.tasks) (t.title || '').split(/\W+/).forEach((w) => w.length > 3 && keywords.add(w.toLowerCase()));
        if (s.notes) for (const n of s.notes) (n.snippet || '').split(/\W+/).forEach((w) => w.length > 3 && keywords.add(w.toLowerCase()));

        // asked topics tokens intersect
        const asked = new Set<string>(Object.keys(freq));
        // missing = keywords - asked
        const missing: string[] = [];
        for (const k of Array.from(keywords)) {
          if (!asked.has(k) && k.length > 3) missing.push(k);
        }
        // pick up to 3 missing as low-confidence gaps
        for (const mtopic of missing.slice(0, 3)) {
          const topic = mtopic;
          const evid = `missing:subject:${s.name}`;
          const confidence = 0.2;
          const doc = { confidence, status: 'DETECTED', evidence: [evid] };
          const up = await this.repo.upsert(userId, s.name, topic, doc);
          created.push(up);
        }
      }
    } catch (err) {
      this.logger.warn('Subject missing detection failed: ' + err);
    }

    // 4) Learning analytics signals: if many questions and low correctness -> gap
    // For v1 rely on learning analytics collection presence via messages or memory; attempt to check precomputed analytics documents
    // This part left light: analytics integration should call LearningAnalyticsRepository. For now, we skip direct DB call to keep service simple.

    return created;
  }

  async getTopGaps(userId: number, limit = 5) {
    return this.repo.findTop(userId, limit);
  }

  async list(userId: number) {
    return this.repo.findByUser(userId, 200);
  }

  async listBySubject(userId: number, subject: string) {
    return this.repo.findByUserAndSubject(userId, subject);
  }

  async patch(id: string, update: any) {
    return this.repo.updateById(id, update);
  }
}
