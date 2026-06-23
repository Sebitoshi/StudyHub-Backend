import { Injectable, Logger } from '@nestjs/common';
import { AcademicContextService } from './academic-context.service';

@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  constructor(private readonly academic: AcademicContextService) {}

  /**
   * Build final prompt messages for the model.
   * Returns an array of `{role, content}` objects to feed to GroqService.
   */
  async buildPrompt(
    userId: number,
    conversationContext: Array<{ role: string; content: string }>,
    userMessage: string,
    memories: any = [],
    teacherProfile?: { code?: string; name?: string; systemPrompt?: string; teachingStyle?: string },
    promptTemplate?: { code?: string; name?: string; prompt?: string },
    knowledgeGaps?: any,
    studentModel?: any,
    adaptive?: any,
  ) {
    const defaultSystem = `Eres Profesor IA: un tutor académico para estudiantes de secundaria y universidad. Sigue estos principios:
- Enseñar antes que responder: prioriza la explicación y el razonamiento paso a paso cuando sea pertinente.
- Adaptar el nivel: detecta y ajusta la complejidad según el nivel, semestre y perfil del estudiante.
- Evitar dependencia: si es un ejercicio, guía con preguntas, pistas y procedimientos; no entregues la solución completa salvo que el estudiante la solicite explícitamente.
- Aprendizaje activo: usa preguntas de comprobación, mini-ejercicios y retos para validar comprensión.
- Preparación para exámenes: si detectas preparación, genera simulacros, preguntas tipo examen y prioriza conceptos fundamentales.
- Generación de recursos: ofrece resúmenes, flashcards, quizzes y cronogramas cuando sean útiles.
- Uso del contexto: integra materias, tareas, notas, historial y memorias del estudiante en tus respuestas.
- Estilo: claro, estructurado, pedagógico y motivador; evita tecnicismos innecesarios.`

  const systemPrompt = process.env.AI_SYSTEM_PROMPT || defaultSystem;
    const academicContext = await this.academic.buildAcademicContext(userId);

    // Summarize academic context into a compact string
    const pieces: string[] = [];
    if (academicContext.career) pieces.push(`Carrera: ${academicContext.career}`);
    if (academicContext.university) pieces.push(`Universidad: ${academicContext.university}`);
    if (academicContext.semester) pieces.push(`Semestre: ${academicContext.semester}`);
    if (academicContext.professionalGoal) pieces.push(`Objetivo profesional: ${academicContext.professionalGoal}`);
    if (academicContext.level) pieces.push(`Nivel: ${academicContext.level}`);
    if (academicContext.currentStreak) pieces.push(`Racha de estudio actual: ${academicContext.currentStreak} días`);

    // Subjects summary (names only, limit)
    const subjectNames = (academicContext.subjects || []).slice(0, 8).map((s) => s.name);
    if (subjectNames.length) pieces.push(`Materias relevantes: ${subjectNames.join(', ')}`);

    // Pending tasks short list
    if ((academicContext.pendingTasks || []).length) {
      const tasks = (academicContext.pendingTasks || []).slice(0, 6).map((t) => `${t.title} (due: ${t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : 'N/A'})`);
      pieces.push(`Tareas pendientes: ${tasks.join('; ')}`);
    }

    // Recent notes snippets
    if ((academicContext.recentNotes || []).length) {
      const notes = (academicContext.recentNotes || []).slice(0, 4).map((n) => `${n.title}: ${n.snippet}`);
      pieces.push(`Notas recientes: ${notes.join(' | ')}`);
    }

    // Skills and objectives
    if ((academicContext.skills || []).length) {
      const skills = (academicContext.skills || []).slice(0, 8).map((s) => s.name);
      pieces.push(`Habilidades: ${skills.join(', ')}`);
    }
    if ((academicContext.objectives || []).length) {
      const objs = (academicContext.objectives || []).slice(0, 6).map((o) => o.name);
      pieces.push(`Objetivos: ${objs.join(', ')}`);
    }

    const academicString = pieces.join('\n');

    // Build student profile from memories
    const memoryMap: Record<string, string[]> = {};
    for (const m of memories || []) {
      if (!memoryMap[m.type]) memoryMap[m.type] = [];
      memoryMap[m.type].push(m.value);
    }

    const studentProfilePieces: string[] = [];
    if (academicContext.level) studentProfilePieces.push(`Nivel detectado: ${academicContext.level}`);
    if (academicContext.semester) studentProfilePieces.push(`Semestre: ${academicContext.semester}`);
    if (memoryMap.SUBJECT_PREFERENCE && memoryMap.SUBJECT_PREFERENCE.length) studentProfilePieces.push(`Materias favoritas: ${memoryMap.SUBJECT_PREFERENCE.join(', ')}`);
    if (memoryMap.SUBJECT_DIFFICULTY && memoryMap.SUBJECT_DIFFICULTY.length) studentProfilePieces.push(`Materias difíciles: ${memoryMap.SUBJECT_DIFFICULTY.join(', ')}`);
    if (memoryMap.LEARNING_STYLE && memoryMap.LEARNING_STYLE.length) studentProfilePieces.push(`Estilo de aprendizaje: ${memoryMap.LEARNING_STYLE.join(', ')}`);
    if (memoryMap.RECURRING_MISTAKE && memoryMap.RECURRING_MISTAKE.length) studentProfilePieces.push(`Errores recurrentes: ${memoryMap.RECURRING_MISTAKE.join('; ')}`);
    if (memoryMap.STUDY_GOAL && memoryMap.STUDY_GOAL.length) studentProfilePieces.push(`Objetivos de estudio: ${memoryMap.STUDY_GOAL.join('; ')}`);
    if (memoryMap.STUDENT_LEVEL && memoryMap.STUDENT_LEVEL.length) studentProfilePieces.push(`Nivel declarado: ${memoryMap.STUDENT_LEVEL.join('; ')}`);

    const studentProfileString = studentProfilePieces.join('\n');

    // Build final messages array
    const messages = [] as Array<{ role: string; content: string }>;
    // Global pedagogical system prompt
    messages.push({ role: 'system', content: systemPrompt });
    // Teacher profile (specialization) -- the teacher persona should follow global principles
    if (teacherProfile && teacherProfile.systemPrompt) {
      messages.push({ role: 'system', content: `TeacherProfile:\n${teacherProfile.systemPrompt}` });
    }

    // Instruction template selected by intent detection
    if (promptTemplate && promptTemplate.prompt) {
      messages.push({ role: 'system', content: `InstructionTemplate:\n${promptTemplate.prompt}` });
    }

    // Adaptive strategy from engine
    if (adaptive) {
      const strat: string[] = [];
      const isExamMode = adaptive.mode === 'COACH' || (adaptive.triggers || []).some((trigger: any) => trigger.type === 'EXAM_MODE');
      strat.push(`TeachingMode: ${isExamMode ? 'EXAM_MODE' : adaptive.mode}`);
      if (isExamMode) {
        strat.push('ExamCoachInstructions: Prioriza simulacro, resumen express, flashcards prioritarias, plan intensivo y preguntas tipo examen. Reduce teoría extensa y enfócate en lo evaluable.');
      }
      if (adaptive.predictedWeaknesses && adaptive.predictedWeaknesses.length) strat.push(`PredictedWeaknesses: ${adaptive.predictedWeaknesses.map((w) => w.topic).join(', ')}`);
      if (adaptive.actions && adaptive.actions.socraticPrompts) strat.push(`SocraticPrompts: ${adaptive.actions.socraticPrompts.join(' | ')}`);
      if (adaptive.actions && adaptive.actions.generatedResources?.length) {
        strat.push(`GeneratedResourcesPersisted: ${adaptive.actions.generatedResources.map((resource: any) => resource.type).join(', ')}`);
      } else if (adaptive.actions && adaptive.actions.resources) {
        strat.push(`SuggestedResources: summary+flashcards+quiz`);
      }
      messages.push({ role: 'system', content: `TeachingStrategy:\n${strat.join('\n')}` });
    }

    // Student profile assembled from academic context + memories
    if (studentProfileString) messages.push({ role: 'system', content: `StudentProfile:\n${studentProfileString}` });

    // Student model (persistent) - strengths, weaknesses, subject levels, comprehension speed
    if (studentModel) {
      const modelPieces: string[] = [];
      if (studentModel.learningStyle) modelPieces.push(`LearningStyle: ${studentModel.learningStyle}`);
      if (studentModel.comprehensionSpeed) modelPieces.push(`ComprehensionSpeed: ${studentModel.comprehensionSpeed}`);
      if (studentModel.engagementScore !== undefined) modelPieces.push(`EngagementScore: ${studentModel.engagementScore}`);
      if (studentModel.strengths && studentModel.strengths.length) modelPieces.push(`Strengths: ${studentModel.strengths.join(', ')}`);
      if (studentModel.weaknesses && studentModel.weaknesses.length) modelPieces.push(`Weaknesses: ${studentModel.weaknesses.join(', ')}`);
      if (studentModel.subjectLevels) modelPieces.push(`SubjectLevels: ${Object.entries(studentModel.subjectLevels).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      if (studentModel.confidencePerSubject) modelPieces.push(`ConfidencePerSubject: ${Object.entries(studentModel.confidencePerSubject).map(([k, v]) => `${k}:${(v as number).toFixed(2)}`).join(', ')}`);
      if (studentModel.recurringMistakes && studentModel.recurringMistakes.length) modelPieces.push(`RecurringMistakes: ${studentModel.recurringMistakes.join('; ')}`);
      modelPieces.push(`AdaptationRules:
- BEGINNER: usa explicaciones simples, analogías, pasos pequeños y una pregunta de comprobación.
- INTERMEDIATE: usa explicación técnica moderada, ejercicios guiados y conexiones entre conceptos.
- ADVANCED: usa problemas complejos, casos reales, menos guía y retos de transferencia.
- Si comprehensionSpeed=SLOW, reduce carga cognitiva y confirma comprensión antes de avanzar.
- Si comprehensionSpeed=FAST, compacta lo básico y ofrece retos.
- Si confidencePerSubject es baja o hay recurringMistakes, prioriza corrección de errores antes de teoría nueva.`);
      messages.push({ role: 'system', content: `StudentModel:\n${modelPieces.join('\n')}` });
    }

    if (academicString) messages.push({ role: 'system', content: `AcademicContext:\n${academicString}` });

    // Include relevant memories (compressed)
    if (memories && memories.length) {
      // pick top memories by occurrence of type
      const typeCount: Record<string, number> = {};
      for (const m of memories) typeCount[m.type] = (typeCount[m.type] || 0) + 1;
      const sorted = (memories || []).sort((a, b) => (typeCount[b.type] - typeCount[a.type]));
      const memStrings = sorted.slice(0, 6).map((m) => `${m.type}: ${m.value}`);
      messages.push({ role: 'system', content: `RelevantMemories:\n${memStrings.join('\n')}` });
    }

    // Include detected knowledge gaps if any (compressed)
    if (knowledgeGaps && knowledgeGaps.length) {
      const gaps = knowledgeGaps.slice(0, 5).map((g) => `${g.topic}`);
      messages.push({ role: 'system', content: `KnowledgeGaps:\n${gaps.join('\n')}` });
    }

    // Include recent conversation context (last N messages)
    const convo = (conversationContext || []).slice(-8);
    for (const m of convo) messages.push(m);

    // Finally the user message
    messages.push({ role: 'user', content: userMessage });

    this.logger.log(`Built prompt for user ${userId}: messages=${messages.length}`);
    // Simple context compression by total character budget
    const maxChars = 14000; // approx 1500-2000 tokens depending on content
    let joined = messages.map((m) => m.content).join('\n');
    if (joined.length > maxChars) {
      // aggressive compression: keep system prompts, top 3 memories, top 3 gaps, last 4 messages
      const sys = messages.filter((m) => m.role === 'system').slice(0, 6);
      const last = messages.filter((m) => m.role !== 'system').slice(-4);
      const compressed = [...sys, ...last];
      this.logger.log(`Compressed prompt for user ${userId}: originalChars=${joined.length}`);
      return compressed;
    }

    return messages;
  }
}
