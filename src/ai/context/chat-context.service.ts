import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GeneratedResourcesService,
  SIMULACRO_TRIGGER,
} from '../generated-resources/generated-resources.service';
import { MediaService } from '../../media/media.service';
import { ImageAnalysisService } from '../image-analysis.service';
import { ChatDepth } from './chat-depth';

const MAX_NOTES_MAX = 8;
const MAX_NOTES_MAXPRO = 8;
const MAX_NOTE_CHARS = 360;
const MAX_PROGRESS_ROWS = 8;
/** Un apunte pedido explícitamente se entrega completo (no recortado a 360). */
const MAX_FULL_NOTE_CHARS = 6000;
/** Tope de imágenes que se leen con visión: cada una cuesta tokens. */
const MAX_NOTE_IMAGES_READ = 3;
const MAX_NOTE_IMAGE_CHARS = 700;

/** Opciones del apunte que el estudiante quiere que el profesor lea. */
export interface ChatContextOptions {
  /** Id del apunte seleccionado en la interfaz. */
  noteId?: number;
  /** Leer sus imágenes con visión (solo cuando el estudiante lo pide). */
  includeImages?: boolean;
}

const STOP_WORDS = new Set([
  'para', 'como', 'sobre', 'este', 'esta', 'esto', 'estos', 'estas',
  'tengo', 'tiene', 'hacer', 'quiero', 'necesito', 'puedes', 'podrias',
  'ayuda', 'ayudame', 'explica', 'explicame', 'dime', 'sabes', 'tema',
  'clase', 'tarea', 'trabajo', 'examen', 'parcial', 'pregunta', 'favor',
]);

interface TeacherLike {
  name?: string | null;
  subjects?: string[] | null;
}

interface RequestedNoteRow {
  id: number;
  title: string;
  content: string;
  subject?: { nombre?: string | null } | null;
}

interface NoteRow {
  title: string;
  content: string;
  updatedAt: Date;
  subjectId: number;
  subject?: { nombre?: string | null } | null;
}

function truncate(value: string, max: number): string {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
}

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatDate(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Construye el bloque de contexto que se inyecta al Profesor IA según el modo
 * elegido por el estudiante. Cada modo añade una capa y descarta el resto:
 * así el modo rápido no paga consultas ni tokens que no necesita.
 */
@Injectable()
export class ChatContextService {
  private readonly logger = new Logger(ChatContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: GeneratedResourcesService,
    private readonly media: MediaService,
    private readonly imageAnalysis: ImageAnalysisService,
  ) {}

  async build(
    userId: number,
    depth: ChatDepth,
    message: string,
    teacher?: TeacherLike | null,
    options: ChatContextOptions = {},
  ): Promise<string> {
    if (depth === 'low' && !options.noteId) return '';

    try {
      const [profile, progress, roadmaps] = await Promise.all([
        this.loadAcademicProfile(userId),
        this.loadProgress(userId),
        this.loadRoadmaps(userId),
      ]);

      const sections: string[] = [];

      if (profile) sections.push(profile);
      if (progress) sections.push(progress);
      if (roadmaps) sections.push(roadmaps);

      // Si el estudiante pide un apunte concreto se envía completo y se omiten
      // los apuntes genéricos: gasta menos tokens y responde sobre lo que pidió.
      const requested = await this.loadRequestedNote(userId, message, options);

      if (requested) {
        sections.push(requested);
      } else if (depth === 'max' || depth === 'auto') {
        const notes = await this.loadNotesForTeacher(userId, teacher);
        if (notes) sections.push(notes);
      } else if (depth === 'maxpro') {
        const notes = await this.loadAllNotes(userId, message, teacher);
        if (notes) sections.push(notes);
      }

      return sections.join('\n\n');
    } catch (error) {
      this.logger.warn(`No se pudo construir el contexto (${depth}): ${error}`);
      return '';
    }
  }

  private async loadAcademicProfile(userId: number): Promise<string> {
    const profile = await this.prisma.academicProfile.findUnique({
      where: { userId },
      select: { carrera: true, universidad: true, semestreActual: true },
    });

    const pieces: string[] = [];
    if (profile?.carrera) pieces.push(`Carrera: ${profile.carrera}`);
    if (profile?.universidad) pieces.push(`Universidad: ${profile.universidad}`);
    if (profile?.semestreActual) pieces.push(`Semestre: ${profile.semestreActual}`);

    return pieces.length ? `Perfil académico:\n${pieces.join(' · ')}` : '';
  }

  /**
   * Solo resultados de quizzes y simulacros: es lo que el estudiante espera que
   * el profesor tenga en cuenta para saber cómo le está yendo.
   */
  private async loadProgress(userId: number): Promise<string> {
    const rows = await this.resources
      .listCompletedAssessments(userId, MAX_PROGRESS_ROWS)
      .catch(() => []);

    if (!rows?.length) return '';

    const lines = rows.map((row: any) => {
      const isSimulacro = String(row.trigger || '').toUpperCase() === SIMULACRO_TRIGGER;
      const label = isSimulacro ? 'Simulacro' : 'Quiz';
      const subject = row.subject && row.subject !== 'general' ? ` (${row.subject})` : '';
      const score = this.formatScore(row);
      const date = formatDate(row.completedAt || row.createdAt);
      return `- ${label} "${truncate(row.title || 'sin título', 80)}"${subject}: ${score}${
        date ? ` · ${date}` : ''
      }`;
    });

    return `Progreso reciente en quizzes y simulacros:\n${lines.join('\n')}`;
  }

  private formatScore(row: any): string {
    const correct = Number(row.resultCorrect);
    const total = Number(row.resultTotal);
    if (Number.isFinite(correct) && Number.isFinite(total) && total > 0) {
      return `${correct}/${total} (${Math.round((correct / total) * 100)}%)`;
    }
    const score = Number(row.resultScore);
    if (Number.isFinite(score)) {
      const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
      return `${pct}%`;
    }
    return 'completado sin puntuación';
  }

  private async loadRoadmaps(userId: number): Promise<string> {
    const roadmaps = await this.prisma.roadmap
      .findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: {
          title: true,
          topic: true,
          currentLevel: true,
          totalLevels: true,
          steps: { select: { completed: true } },
        },
      })
      .catch(() => []);

    if (!roadmaps.length) return '';

    const lines = roadmaps.map((roadmap: any) => {
      const total = roadmap.steps?.length || 0;
      const done = (roadmap.steps || []).filter((step: any) => step.completed).length;
      const topic = roadmap.topic && roadmap.topic !== roadmap.title ? ` (${roadmap.topic})` : '';
      const level = roadmap.totalLevels > 1 ? ` · nivel ${roadmap.currentLevel}/${roadmap.totalLevels}` : '';
      return `- Ruta "${truncate(roadmap.title, 80)}"${topic}: ${done}/${total} pasos${level}`;
    });

    return `Rutas de aprendizaje:\n${lines.join('\n')}`;
  }

  /**
   * Modo Max: apuntes de las materias que corresponden al profesor elegido.
   * Se comparan las materias del perfil del profesor con el nombre y el
   * profesor real de cada asignatura.
   */
  private async loadNotesForTeacher(
    userId: number,
    teacher?: TeacherLike | null,
  ): Promise<string> {
    const keywords = this.teacherKeywords(teacher);
    if (!keywords.length) return '';

    const subjects = await this.prisma.subject.findMany({
      where: { userId },
      select: { id: true, nombre: true, profesor: true },
    });

    const matchedIds = subjects
      .filter((subject) => {
        const name = normalize(subject.nombre);
        const professor = normalize(subject.profesor || '');
        return keywords.some((keyword) => name.includes(keyword) || professor.includes(keyword));
      })
      .map((subject) => subject.id);

    if (!matchedIds.length) return '';

    const notes = await this.prisma.note.findMany({
      where: { subjectId: { in: matchedIds } },
      orderBy: { updatedAt: 'desc' },
      take: MAX_NOTES_MAX,
      select: {
        title: true,
        content: true,
        updatedAt: true,
        subjectId: true,
        subject: { select: { nombre: true } },
      },
    });

    return this.formatNotes(notes, 'materias relacionadas con la pregunta');
  }

  /**
   * Modo Max Pro: apuntes de cualquier materia. Se toman los dos más recientes
   * por materia, priorizando los que comparten palabras con la pregunta.
   */
  private async loadAllNotes(
    userId: number,
    message: string,
    teacher?: TeacherLike | null,
  ): Promise<string> {
    const subjects = await this.prisma.subject.findMany({
      where: { userId },
      select: { id: true, nombre: true, profesor: true },
    });
    if (!subjects.length) return '';

    const notes = await this.prisma.note.findMany({
      where: { subjectId: { in: subjects.map((subject) => subject.id) } },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: {
        title: true,
        content: true,
        updatedAt: true,
        subjectId: true,
        subject: { select: { nombre: true } },
      },
    });
    if (!notes.length) return '';

    const keywords = this.messageKeywords(message);
    const teacherKeywords = this.teacherKeywords(teacher);
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

    const scoreOf = (note: NoteRow): number => {
      const haystack = normalize(`${note.title} ${note.content}`);
      const matches = keywords.reduce(
        (acc, keyword) => acc + (haystack.includes(keyword) ? 1 : 0),
        0,
      );
      const subject = subjectById.get(note.subjectId);
      const teacherBoost =
        subject && teacherKeywords.some((keyword) => normalize(subject.nombre).includes(keyword))
          ? 0.5
          : 0;
      return matches + teacherBoost;
    };

    const bySubject = new Map<number, NoteRow[]>();
    for (const note of notes as NoteRow[]) {
      const list = bySubject.get(note.subjectId) || [];
      list.push(note);
      bySubject.set(note.subjectId, list);
    }

    const selected: Array<{ note: NoteRow; score: number }> = [];
    for (const list of bySubject.values()) {
      const ranked = list
        .map((note) => ({ note, score: scoreOf(note) }))
        .sort(
          (a, b) =>
            b.score - a.score ||
            +new Date(b.note.updatedAt) - +new Date(a.note.updatedAt),
        )
        .slice(0, 2);
      selected.push(...ranked);
    }

    const ordered = selected
      .sort(
        (a, b) =>
          b.score - a.score ||
          +new Date(b.note.updatedAt) - +new Date(a.note.updatedAt),
      )
      .slice(0, MAX_NOTES_MAXPRO);

    return this.formatNotes(
      ordered.map((item) => item.note),
      'cualquier materia',
      true,
    );
  }

  // ── Apunte pedido por el estudiante ────────────────────────

  /**
   * Apunte que el estudiante quiere que el profesor revise: por id (lo elige la
   * interfaz) o porque el mensaje nombra su título. El texto va completo; las
   * imágenes solo se leen si lo pide (ver `asksForImages`).
   */
  private async loadRequestedNote(
    userId: number,
    message: string,
    options: ChatContextOptions,
  ): Promise<string> {
    const note = options.noteId
      ? await this.findNoteById(userId, options.noteId)
      : await this.findNoteByTitle(userId, message);

    if (!note) return '';

    const includeImages = options.includeImages || this.asksForImages(message);
    return this.formatRequestedNote(userId, note, includeImages);
  }

  private async findNoteById(
    userId: number,
    noteId: number,
  ): Promise<RequestedNoteRow | null> {
    return this.prisma.note.findFirst({
      where: { id: noteId, subject: { userId } },
      select: {
        id: true,
        title: true,
        content: true,
        subject: { select: { nombre: true } },
      },
    });
  }

  /** Título contenido en el mensaje: «mira mi apunte de límites por la derecha». */
  private async findNoteByTitle(
    userId: number,
    message: string,
  ): Promise<RequestedNoteRow | null> {
    const text = normalize(message);
    if (text.length < 8) return null;

    const notes = await this.prisma.note.findMany({
      where: { subject: { userId } },
      orderBy: { updatedAt: 'desc' },
      take: 60,
      select: {
        id: true,
        title: true,
        content: true,
        subject: { select: { nombre: true } },
      },
    });

    let best: { note: RequestedNoteRow; length: number } | null = null;
    for (const note of notes) {
      const title = normalize(note.title).trim();
      if (title.length < 4 || !text.includes(title)) continue;
      if (!best || title.length > best.length) best = { note, length: title.length };
    }

    return best?.note ?? null;
  }

  private async formatRequestedNote(
    userId: number,
    note: RequestedNoteRow,
    includeImages: boolean,
  ): Promise<string> {
    const subject = note.subject?.nombre ? `[${note.subject.nombre}] ` : '';
    const parts = [
      `Apunte que el estudiante quiere que revises: ${subject}"${note.title}"`,
      'Contenido completo del apunte:',
      this.truncateLong(note.content, MAX_FULL_NOTE_CHARS),
    ];

    const [files, images] = await Promise.all([
      this.media.listNoteFiles(userId, [note.id]).catch(() => []),
      this.media.listNoteImages(userId, [note.id]).catch(() => []),
    ]);

    if (files.length) {
      parts.push(`PDFs adjuntos al apunte: ${files.map((file) => file.filename).join(', ')}.`);
    }

    if (!images.length) return parts.join('\n');

    if (!includeImages) {
      parts.push(
        `El apunte tiene ${images.length} imagen(es) que NO se han leído para no gastar tokens. ` +
          'Si el estudiante pregunta por ellas, dile que puede pedir que las incluyas.',
      );
      return parts.join('\n');
    }

    const descriptions = await this.readImages(images.slice(0, MAX_NOTE_IMAGES_READ));
    if (descriptions) parts.push(descriptions);
    return parts.join('\n');
  }

  /** Lee las imágenes del apunte con el mismo modelo de visión del análisis. */
  private async readImages(images: Array<{ id: string }>): Promise<string> {
    const lines: string[] = ['Imágenes del apunte (leídas con visión):'];

    for (let index = 0; index < images.length; index += 1) {
      try {
        const payload = await this.media.getNoteImage(images[index].id);
        const file = {
          buffer: payload.data,
          size: payload.bytes,
          mimetype: payload.mime,
          originalname: `imagen-${index + 1}`,
          fieldname: 'image',
          encoding: '7bit',
        } as unknown as Express.Multer.File;

        const { contenido } = await this.imageAnalysis.extractContent(file, {
          enfoque: 'apunte del estudiante',
        });
        const body = [contenido.contenidoPrincipal, contenido.textoDetectado]
          .filter(Boolean)
          .join(' ')
          .trim();
        lines.push(`- Imagen ${index + 1}: ${this.truncateLong(body, MAX_NOTE_IMAGE_CHARS)}`);
      } catch (error) {
        this.logger.warn(`No se pudo leer una imagen del apunte: ${error}`);
        lines.push(`- Imagen ${index + 1}: no se pudo leer.`);
      }
    }

    return lines.length > 1 ? lines.join('\n') : '';
  }

  /** Solo se leen imágenes cuando el mensaje las menciona explícitamente. */
  private asksForImages(message: string): boolean {
    const text = normalize(message);
    return /(imagen|imagenes|foto|fotos|captura|diagrama|grafic|figura|esquema)/.test(text);
  }

  private truncateLong(value: string, max: number): string {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max).trim()}…` : text;
  }

  private formatNotes(
    notes: NoteRow[],
    scope: string,
    markRelevance = false,
  ): string {
    if (!notes.length) return '';

    const header = markRelevance
      ? `Apuntes del estudiante (${scope}; priorizados por relación con la pregunta):`
      : `Apuntes del estudiante (${scope}):`;

    const lines = notes.map((note) => {
      const subject = note.subject?.nombre ? `[${note.subject.nombre}] ` : '';
      return `- ${subject}"${truncate(note.title, 90)}": ${truncate(note.content, MAX_NOTE_CHARS)}`;
    });

    return `${header}\n${lines.join('\n')}`;
  }

  private teacherKeywords(teacher?: TeacherLike | null): string[] {
    if (!teacher) return [];

    const raw: string[] = [...(teacher.subjects || [])];
    if (teacher.name) {
      raw.push(
        String(teacher.name)
          .replace(/^profesor(a)?\s+(de\s+)?/i, '')
          .replace(/^preparador(a)?\s+(de\s+)?/i, '')
          .replace(/^entrenador(a)?\s+(de\s+)?/i, ''),
      );
    }

    return Array.from(
      new Set(
        raw
          .map((value) => normalize(value).trim())
          .filter((value) => value.length >= 3),
      ),
    );
  }

  private messageKeywords(message: string): string[] {
    const words = normalize(message)
      .split(/[^a-z0-9ñ]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
    return Array.from(new Set(words)).slice(0, 12);
  }
}
