import { Injectable, Logger } from '@nestjs/common';
import { MemoryRepository } from './memory.repository';

export type MemoryType =
  | 'SUBJECT_PREFERENCE'
  | 'SUBJECT_DIFFICULTY'
  | 'LEARNING_STYLE'
  | 'STUDY_GOAL'
  | 'CAREER_GOAL'
  | 'RECURRING_MISTAKE'
  | 'KNOWLEDGE_GAP'
  | 'STRONG_SKILL'
  | 'WEAK_SKILL';

// Added additional memory types for student metadata
export type MemoryTypeExtended = MemoryType | 'STUDENT_LEVEL';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly repo: MemoryRepository) {}

  async storeMemory(userId: number, type: MemoryTypeExtended, key: string, value: any, confidence = 0.7, source = 'ai') {
    const now = new Date();
    const doc = { userId, type, key, value, confidence, source, createdAt: now, updatedAt: now };
    const id = await this.repo.insert(doc);
    return id;
  }

  async updateMemory(id: string, update: Partial<any>) {
    update.updatedAt = new Date();
    await this.repo.update(id, update);
  }

  async deleteMemory(id: string) {
    await this.repo.delete(id);
  }

  async getUserMemories(userId: number) {
    return this.repo.findByUser(userId);
  }

  /**
   * Return up to `limit` relevant memories based on keywords extracted from the message.
   * Simple keyword matching for v1.
   */
  async getRelevantMemories(userId: number, message: string, limit = 10) {
    const keywords = this.extractKeywords(message);
    if (!keywords.length) return [];
    return this.repo.findRelevant(userId, keywords, limit);
  }

  extractKeywords(text: string) {
    if (!text) return [];
    const cleaned = text.toLowerCase().replace(/[.,;:!?()\"']/g, ' ');
    const words = cleaned.split(/\s+/).filter(Boolean);
    const stop = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'de', 'del', 'que', 'como', 'para', 'con', 'mi', 'me', 'tengo', 'tiene', 'estoy']);
    const candidates = words.filter((w) => w.length > 3 && !stop.has(w));
    // return top unique words
    const uniq = Array.from(new Set(candidates));
    return uniq.slice(0, 8);
  }

  /**
   * Analyze recent conversation messages and store/update memories using simple rules.
   * This is rule-based and does not call any LLM.
   */
  async analyzeAndStore(userId: number, messages: Array<{ role: string; content: string }>, academicContext: any) {
    // Look at last N user messages
    const userMessages = messages.filter((m) => m.role === 'user').slice(-6).map((m) => m.content).join('\n');

    const rules = [
      { type: 'KNOWLEDGE_GAP', patterns: ['no entiendo', 'me confundo', 'me cuesta', 'no sé', 'no se'] },
      { type: 'SUBJECT_DIFFICULTY', patterns: ['me cuesta', 'difícil', 'complicado', 'no entiendo', 'me confundo'] },
      { type: 'LEARNING_STYLE', patterns: ['visual', 'ejemplo', 'práctico', 'diagramas', 'video'] },
      { type: 'STUDY_GOAL', patterns: ['preparar', 'estudiar para', 'preparándome', 'quiero aprobar', 'objetivo'] },
      { type: 'CAREER_GOAL', patterns: ['trabajo', 'empleo', 'contratar', 'contratado', 'developer', 'desarrollador'] },
      { type: 'STRONG_SKILL', patterns: ['soy bueno', 'domino', 'experiencia en', 'fuerte en'] },
      { type: 'WEAK_SKILL', patterns: ['malo en', 'no soy bueno', 'no puedo', 'me cuesta'] },
      { type: 'RECURRING_MISTAKE', patterns: ['siempre me confundo', 'siempre me equivoco', 'siempre confundo'] },
    ];

    // Additional quick pattern checks: subject preferences and student level
    const preferencePatterns = ['me gusta', 'me encanta', 'prefiero', 'mi materia favorita', 'me interesa'];
    const levelPatterns = ['semestre', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'año', 'grado', 'secundaria', 'universidad', 'bachillerato'];

    const found: Array<{ type: MemoryType; key: string; value: string }> = [];
    const text = userMessages.toLowerCase();
    // detect explicit student level mentions
    for (const lp of levelPatterns) {
      if (text.includes(lp)) {
        const snippet = text.match(new RegExp(`(?:${lp}[^\.\n]{0,60})`)) || [];
        const val = snippet[0] || `Mencion de nivel: ${lp}`;
        // store as STUDENT_LEVEL
        // @ts-ignore allow extended type at runtime
        found.push({ type: 'STUDENT_LEVEL' as any, key: 'STUDENT_LEVEL', value: val });
        break;
      }
    }
    for (const r of rules) {
      for (const p of r.patterns) {
        if (text.includes(p)) {
          // try to extract subject mention from academicContext subjects
          let subject = null;
          if (academicContext?.subjects && academicContext.subjects.length) {
            for (const s of academicContext.subjects) {
              if (text.includes(s.name.toLowerCase())) {
                subject = s.name;
                break;
              }
            }
          }

          const key = subject ? `${r.type}:${subject}` : r.type;
          const value = subject ? `Subject:${subject} — example sentence: ${p}` : `Detected phrase: ${p}`;
          found.push({ type: r.type as MemoryType, key, value });
          break;
        }
      }
    }

    // Preferences: check if user mentions liking a subject
    if (academicContext?.subjects && academicContext.subjects.length) {
      for (const s of academicContext.subjects) {
        const name = (s.name || '').toLowerCase();
        for (const pp of preferencePatterns) {
          if (text.includes(pp) && text.includes(name)) {
            found.push({ type: 'SUBJECT_PREFERENCE', key: `SUBJECT_PREFERENCE:${name}`, value: `Prefers subject: ${s.name}` });
          }
        }
      }
    }

    // Store found memories (de-duplicate by key)
    const existing = await this.getUserMemories(userId);
    for (const f of found) {
      const ex = existing.find((e) => e.key === f.key);
      if (ex) {
        // bump confidence and update timestamp
        await this.updateMemory(ex._id.toString(), { value: f.value, confidence: Math.min((ex.confidence ?? 0.5) + 0.1, 0.95) });
      } else {
        await this.storeMemory(userId, f.type, f.key, f.value, 0.7, 'rules');
      }
    }

    return found;
  }
}
