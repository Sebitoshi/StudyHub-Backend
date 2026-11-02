import { Injectable, Logger } from '@nestjs/common';
import { ChatDepth, CHAT_DEPTH_LABELS } from './chat-depth';

export interface PromptBuildOptions {
  userId: number;
  conversationContext: Array<{ role: string; content: string }>;
  userMessage: string;
  depth: ChatDepth;
  /** Bloque compacto construido por ChatContextService (vacío en modo low). */
  contextText?: string;
  teacherProfile?: {
    code?: string;
    name?: string;
    systemPrompt?: string;
    teachingStyle?: string;
  };
  promptTemplate?: { code?: string; name?: string; prompt?: string };
  /** Estrategia pedagógica resumida en una línea (opcional). */
  teachingMode?: string | null;
  attachmentsContext?: string;
}

/** Mensajes de historial que viajan al modelo. */
const MAX_HISTORY_MESSAGES = 8;
/** Presupuesto de caracteres antes de comprimir el prompt. */
const MAX_PROMPT_CHARS = 12000;

@Injectable()
export class PromptBuilderService {
  private readonly logger = new Logger(PromptBuilderService.name);

  /**
   * Construye los mensajes finales del modelo. El contexto del estudiante ya
   * viene resumido y filtrado por modo: aquí no se vuelve a consultar la base
   * de datos ni se duplican bloques (perfil, memorias, brechas, etc.).
   */
  async buildPrompt(options: PromptBuildOptions) {
    const {
      userId,
      conversationContext,
      userMessage,
      depth,
      contextText,
      teacherProfile,
      promptTemplate,
      teachingMode,
      attachmentsContext,
    } = options;

    const defaultSystem = `Eres Profesor IA: un tutor académico para estudiantes de secundaria y universidad.
Principios:
- Enseña antes que responder: explica el razonamiento paso a paso cuando aporte valor.
- Adapta la profundidad y los ejemplos al nivel del estudiante.
- Si es un ejercicio, guía con pistas y preguntas; no des la solución completa salvo que la pidan.
- Comprueba la comprensión con preguntas breves cuando sea útil.
- Usa solo el contexto disponible. Si falta un dato, dilo; no inventes información del estudiante.
- Estilo claro, estructurado y motivador. Usa Markdown y LaTeX ($...$) cuando corresponda.`;

    const systemPrompt = process.env.AI_SYSTEM_PROMPT || defaultSystem;
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (teacherProfile?.systemPrompt) {
      messages.push({
        role: 'system',
        content: `TeacherProfile (${teacherProfile.name || teacherProfile.code || 'profesor'}):\n${teacherProfile.systemPrompt}`,
      });
    }

    if (promptTemplate?.prompt) {
      messages.push({ role: 'system', content: `InstructionTemplate:\n${promptTemplate.prompt}` });
    }

    if (teachingMode) {
      messages.push({ role: 'system', content: `TeachingMode:\n${teachingMode}` });
    }

    if (contextText) {
      messages.push({
        role: 'system',
        content: `StudentContext (modo ${CHAT_DEPTH_LABELS[depth]}; úsalo solo si aporta a la pregunta):\n${contextText}`,
      });
    }

    if (attachmentsContext) {
      messages.push({
        role: 'system',
        content: `AttachedImageAnalysis:\n${attachmentsContext}`,
      });
    }

    const history = (conversationContext || []).slice(-MAX_HISTORY_MESSAGES);
    for (const message of history) {
      messages.push(message);
    }

    messages.push({ role: 'user', content: userMessage });

    const joined = messages.map((message) => message.content).join('\n');
    if (joined.length <= MAX_PROMPT_CHARS) {
      this.logger.log(`Built prompt for user ${userId} (${depth}): messages=${messages.length}`);
      return messages;
    }

    // Compresión: conserva las instrucciones y los últimos turnos.
    const systemMessages = messages.filter((message) => message.role === 'system');
    const conversation = messages.filter((message) => message.role !== 'system').slice(-6);
    this.logger.log(
      `Compressed prompt for user ${userId} (${depth}): originalChars=${joined.length}`,
    );
    return [...systemMessages, ...conversation];
  }
}
