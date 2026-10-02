import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GeneratedResourcesRepository } from './generated-resources.repository';

/** Trigger con el que se marcan los recursos creados desde la zona de Simulacro. */
export const SIMULACRO_TRIGGER = 'SIMULACRO_TAB';

@Injectable()
export class GeneratedResourcesService {
  constructor(private readonly repo: GeneratedResourcesRepository) {}

  async saveResource(userId: number, conversationId: any, resourceType: string, title: string, content: any, metadata: any = {}) {
    const type = String(resourceType || '').toUpperCase();
    const doc = {
      userId,
      conversationId,
      subject: metadata.subject || 'general',
      type,
      resourceType: type,
      title,
      content,
      difficulty: metadata.difficulty || null,
      generatedFrom: metadata.generatedFrom || null,
      sourceKnowledgeGap: metadata.sourceKnowledgeGap || null,
      completed: metadata.completed ?? false,
      completedAt: metadata.completedAt || null,
      trigger: metadata.trigger || null,
    };
    return this.repo.insert(doc);
  }

  async listForUser(userId: number) {
    return this.repo.findByUser(userId);
  }

  async listResourcesForUser(userId: number, type?: string, scope?: string) {
    const rows = await this.repo.findByUser(userId);
    const filteredByType = type
      ? rows.filter((row) => String(row.type || row.resourceType).toUpperCase() === type.toUpperCase())
      : rows;
    return this.filterByScope(filteredByType, scope).map((row) => this.serialize(row, false));
  }

  /**
   * `scope` separa las dos zonas del Profesor IA: `simulacro` devuelve solo los
   * recursos del examen cronometrado y `quiz` todo lo demás (así los simulacros
   * no se mezclan con los quizzes). Sin `scope` se devuelve todo.
   */
  private filterByScope(rows: any[], scope?: string) {
    const normalized = String(scope || '').toLowerCase();
    if (normalized !== 'simulacro' && normalized !== 'quiz') return rows;
    const isSimulacro = (row: any) => String(row.trigger || '').toUpperCase() === SIMULACRO_TRIGGER;
    return normalized === 'simulacro' ? rows.filter(isSimulacro) : rows.filter((row) => !isSimulacro(row));
  }

  async getByIdForUser(userId: number, id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Recurso no encontrado');
    if (row.userId !== userId) throw new ForbiddenException('No tienes acceso a este recurso');
    return this.serialize(row, true);
  }

  async deleteForUser(userId: number, id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Recurso no encontrado');
    if (row.userId !== userId) throw new ForbiddenException('No tienes acceso a este recurso');
    await this.repo.deleteById(id);
    return { ok: true };
  }

  async completeForUser(
    userId: number,
    id: string,
    result: { resultScore?: number; resultCorrect?: number; resultTotal?: number } = {},
  ) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Recurso no encontrado');
    if (row.userId !== userId) throw new ForbiddenException('No tienes acceso a este recurso');
    return this.repo.markCompleted(id, result);
  }

  async countCompletedForUser(userId: number) {
    return this.repo.countCompletedByUser(userId);
  }

  private serialize(row: any, includeContent: boolean) {
    const base = {
      id: String(row.id || row._id),
      userId: row.userId,
      subject: row.subject,
      type: row.type || row.resourceType,
      title: row.title,
      difficulty: row.difficulty || null,
      generatedFrom: row.generatedFrom || null,
      completed: row.completed ?? false,
      completedAt: row.completedAt || null,
      resultScore: row.resultScore ?? null,
      resultCorrect: row.resultCorrect ?? null,
      resultTotal: row.resultTotal ?? null,
      trigger: row.trigger || null,
      createdAt: row.createdAt,
    };
    if (includeContent) {
      return { ...base, content: row.content };
    }
    return base;
  }
}
