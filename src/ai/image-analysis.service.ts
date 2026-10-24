import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ChatMessage, GroqService } from './groq.service';

/**
 * Modelo multimodal de Groq (visión + JSON mode). Se puede cambiar sin tocar el
 * código con la variable de entorno `GROQ_VISION_MODEL`.
 */
const DEFAULT_VISION_MODEL = 'qwen/qwen3.8-27b';

/** Límite defensivo: por encima el cuerpo de la petición no llega al backend. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Fase 1: lo que la visión extrae de la imagen. */
export interface ImageContentPhase {
  titulo: string;
  tipoContenido: string;
  tema: string;
  nivelDificultad: string;
  contenidoPrincipal: string;
  textoDetectado: string;
  elementosClave: string[];
  advertencias: string[];
}

/** Fase 2: instrucciones internas construidas a partir del contenido. */
export interface InternalPromptPhase {
  promptInterno: string;
  objetivo: string;
  enfoque: string;
  preguntasGuia: string[];
  estructura: string[];
}

/** Fase 3: explotación del contenido siguiendo el prompt interno. */
export interface ImageDetailPhase {
  resumen: string;
  ideasClave: string[];
  conceptos: Array<{ termino: string; definicion: string }>;
  explicacionPasoAPaso: string[];
  ejemplos: string[];
  posiblesPreguntas: string[];
  vacios: string[];
}

export interface ImagePhaseMeta {
  fase: number;
  modelo: string;
  duracionMs: number;
  tokensUsados: number | null;
}

/** Resultado completo del pipeline de tres fases. */
export interface ImageAnalysisResult {
  filename?: string;
  contenido: ImageContentPhase;
  promptInterno: InternalPromptPhase;
  detalle: ImageDetailPhase;
}

const VISION_SYSTEM_PROMPT = `Eres un extractor visual experto en material académico para StudyHub, una app de estudio para universitarios.

Tu única tarea es leer una imagen (apuntes, pizarra, diapositiva, diagrama, tabla, ejercicio o foto de un libro) y devolver su contenido de la forma más fiel posible.

Reglas estrictas:
- Transcribe TODO el texto visible de forma literal: títulos, numeración, fórmulas, símbolos, etiquetas y notas al margen.
- Describe diagramas, gráficos y tablas con precisión: qué representan, ejes, etiquetas, unidades y relaciones entre elementos.
- No inventes nada que no esté en la imagen. Si algo es ilegible o está cortado, indícalo como "[ilegible]" y añádelo a "advertencias".
- No resumas en exceso: "contenidoPrincipal" debe permitir estudiar el tema sin volver a ver la imagen.
- Responde únicamente con el objeto JSON solicitado.`;

const VISION_JSON_SHAPE = `{
  "titulo": "título breve del contenido (o descripción si no hay título)",
  "tipoContenido": "apunte | pizarra | diapositiva | diagrama | tabla | ejercicio | foto | otro",
  "tema": "tema académico principal",
  "nivelDificultad": "básico | intermedio | avanzado",
  "contenidoPrincipal": "descripción completa y fiel de todo el contenido: texto transcrito, estructura, fórmulas, diagramas y relaciones",
  "textoDetectado": "transcripción literal de todo el texto visible (respeta saltos y numeración)",
  "elementosClave": ["elementos, conceptos o partes importantes de la imagen"],
  "advertencias": ["zonas ilegibles, ambigüedades o limitaciones de la lectura"]
}`;

const PROMPT_SYSTEM_PROMPT = `Eres un planificador instruccional de StudyHub. Recibes el contenido que un modelo de visión extrajo de una imagen.

IMPORTANTE: ya NO tienes la imagen. Trabajas solo con el texto que recibes. No inventes detalles visuales que no aparezcan en él.

Tu tarea es escribir un "prompt interno": un conjunto de instrucciones detalladas y autocontenidas que otra fase usará para exprimir ese contenido (explicarlo, estructurarlo y convertirlo en material de estudio). El prompt interno debe funcionar sin acceso a la imagen ni al contenido original.

Reglas:
- El prompt interno debe indicar el rol, el objetivo, los pasos de análisis, el formato de salida esperado y los criterios de calidad.
- Adáptalo al tipo de contenido recibido (teoría, ejercicio, diagrama, tabla...).
- Propón preguntas guía que obliguen a razonar sobre el contenido, no a repetirlo.
- Responde únicamente con el objeto JSON solicitado.`;

const PROMPT_JSON_SHAPE = `{
  "promptInterno": "instrucciones completas y autocontenidas (120-250 palabras) para analizar y explotar el contenido",
  "objetivo": "qué debe lograr la siguiente fase en una frase",
  "enfoque": "ángulo elegido (explicación, examen, resumen, resolución de ejercicios...)",
  "preguntasGuia": ["4 a 7 preguntas que guíen el análisis"],
  "estructura": ["4 a 8 secciones en las que se debe organizar la respuesta final"]
}`;

const DETAIL_SYSTEM_PROMPT = `Eres un analista académico de StudyHub. Recibes dos cosas: (1) un prompt interno con instrucciones y (2) el contenido que se extrajo de una imagen.

IMPORTANTE: la imagen ya no está disponible. Trabaja SOLO con el contenido textual. No inventes datos, fórmulas ni detalles visuales que no aparezcan en él. Si necesitas algo que falta, anótalo en "vacios".

Sigue el prompt interno al pie de la letra y devuelve material de estudio claro, preciso y autosuficiente.

Reglas:
- Explica los conceptos con lenguaje académico pero accesible.
- El paso a paso debe ser accionable y respetar el orden lógico del contenido.
- Las preguntas deben poder responderse con el contenido (no de cultura general).
- Responde únicamente con el objeto JSON solicitado.`;

const DETAIL_JSON_SHAPE = `{
  "resumen": "resumen completo del contenido en 3-5 frases",
  "ideasClave": ["ideas imprescindibles para entender el tema"],
  "conceptos": [{ "termino": "concepto", "definicion": "definición clara y precisa" }],
  "explicacionPasoAPaso": ["pasos ordenados para entender o resolver el contenido"],
  "ejemplos": ["ejemplos concretos construidos con los datos del contenido"],
  "posiblesPreguntas": ["preguntas de estudio o examen con respuesta deducible del contenido"],
  "vacios": ["información que falta o queda ambigua en el contenido recibido"]
}`;

/**
 * Pipeline de comprensión de imágenes en tres fases:
 *
 *  1. Visión: extrae el contenido principal de la imagen.
 *  2. Prompt interno: convierte ese contenido en instrucciones de análisis.
 *  3. Detalle: explota el prompt + el contenido (sin volver a ver la imagen).
 *
 * Cada fase es independiente y se expone en su propio endpoint, de modo que el
 * cliente puede mostrar los resultados a medida que llegan.
 */
@Injectable()
export class ImageAnalysisService {
  private readonly logger = new Logger(ImageAnalysisService.name);

  constructor(private readonly groq: GroqService) {}

  private get visionModel(): string {
    return process.env.GROQ_VISION_MODEL || DEFAULT_VISION_MODEL;
  }

  /** Fase 1 — visión: contenido principal de la imagen. */
  async extractContent(
    file: Express.Multer.File | undefined,
    options: { idioma?: string; enfoque?: string } = {},
  ): Promise<{ fase: 1; contenido: ImageContentPhase; meta: ImagePhaseMeta }> {
    if (!file) {
      throw new BadRequestException('Falta la imagen.');
    }
    if (!file.size || !file.buffer?.length) {
      throw new BadRequestException('La imagen está vacía.');
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato no soportado. Sube la imagen en JPG, PNG o WebP.',
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException(
        'La imagen supera los 6 MB. Comprímela antes de subirla.',
      );
    }

    const startedAt = Date.now();
    const idioma = (options.idioma || 'es').trim() || 'es';
    const enfoque = (options.enfoque || 'estudio general').trim();
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const instruction = [
      'Analiza la imagen y devuelve SOLO un objeto JSON con esta forma exacta:',
      VISION_JSON_SHAPE,
      '',
      `Idioma de salida: ${idioma}.`,
      `Enfoque pedido por el estudiante: ${enfoque}.`,
      'Recuerda: fidelidad total, sin inventar y transcribiendo todo el texto visible.',
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: VISION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: instruction },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];

    const { data, tokensUsed, model } = await this.runPhase(1, messages, {
      model: this.visionModel,
      maxTokens: 3400,
      temperature: 0.1,
    });

    const contenido = this.normalizeContent(data);

    return {
      fase: 1,
      contenido,
      meta: {
        fase: 1,
        modelo: model || this.visionModel,
        duracionMs: Date.now() - startedAt,
        tokensUsados: tokensUsed ?? null,
      },
    };
  }

  /** Fase 2 — prompt interno construido a partir del contenido de la fase 1. */
  async buildInternalPrompt(
    contenidoRaw: Record<string, any>,
    options: { idioma?: string; enfoque?: string } = {},
  ): Promise<{ fase: 2; promptInterno: InternalPromptPhase; meta: ImagePhaseMeta }> {
    if (!contenidoRaw || typeof contenidoRaw !== 'object') {
      throw new BadRequestException('Falta el contenido de la fase 1.');
    }

    const startedAt = Date.now();
    const idioma = (options.idioma || 'es').trim() || 'es';
    const enfoque = (options.enfoque || 'estudio general').trim();
    const contenido = this.normalizeContent(contenidoRaw);

    if (!contenido.contenidoPrincipal.trim()) {
      throw new BadRequestException(
        'El contenido de la fase 1 está vacío: repite la lectura de la imagen.',
      );
    }

    const instruction = [
      `Idioma de salida: ${idioma}.`,
      `Enfoque deseado: ${enfoque}.`,
      '',
      'CONTENIDO EXTRAÍDO DE LA IMAGEN (fase 1):',
      JSON.stringify(contenido, null, 2),
      '',
      'Devuelve SOLO un objeto JSON con esta forma exacta:',
      PROMPT_JSON_SHAPE,
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: PROMPT_SYSTEM_PROMPT },
      { role: 'user', content: instruction },
    ];

    const { data, tokensUsed, model } = await this.runPhase(2, messages, {
      maxTokens: 2200,
      temperature: 0.3,
    });

    return {
      fase: 2,
      promptInterno: this.normalizeInternalPrompt(data, enfoque),
      meta: {
        fase: 2,
        modelo: model || process.env.GROQ_MODEL || '',
        duracionMs: Date.now() - startedAt,
        tokensUsados: tokensUsed ?? null,
      },
    };
  }

  /** Fase 3 — detalle usando el prompt interno y el contenido (sin la imagen). */
  async buildDetail(
    promptInternoRaw: Record<string, any>,
    contenidoRaw: Record<string, any>,
  ): Promise<{ fase: 3; detalle: ImageDetailPhase; meta: ImagePhaseMeta }> {
    if (!promptInternoRaw || typeof promptInternoRaw !== 'object') {
      throw new BadRequestException('Falta el prompt interno de la fase 2.');
    }
    if (!contenidoRaw || typeof contenidoRaw !== 'object') {
      throw new BadRequestException('Falta el contenido de la fase 1.');
    }

    const startedAt = Date.now();
    const contenido = this.normalizeContent(contenidoRaw);
    const promptInterno = this.normalizeInternalPrompt(promptInternoRaw);

    if (!contenido.contenidoPrincipal.trim()) {
      throw new BadRequestException(
        'El contenido de la fase 1 está vacío: repite la lectura de la imagen.',
      );
    }

    const instruction = [
      'PROMPT INTERNO (fase 2):',
      JSON.stringify(promptInterno, null, 2),
      '',
      'CONTENIDO EXTRAÍDO DE LA IMAGEN (fase 1):',
      JSON.stringify(contenido, null, 2),
      '',
      'Devuelve SOLO un objeto JSON con esta forma exacta:',
      DETAIL_JSON_SHAPE,
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: DETAIL_SYSTEM_PROMPT },
      { role: 'user', content: instruction },
    ];

    const { data, tokensUsed, model } = await this.runPhase(3, messages, {
      maxTokens: 4000,
      temperature: 0.3,
    });

    return {
      fase: 3,
      detalle: this.normalizeDetail(data),
      meta: {
        fase: 3,
        modelo: model || process.env.GROQ_MODEL || '',
        duracionMs: Date.now() - startedAt,
        tokensUsados: tokensUsed ?? null,
      },
    };
  }

  private async runPhase(
    phase: number,
    messages: ChatMessage[],
    options: { model?: string; maxTokens: number; temperature: number },
  ): Promise<{ data: any; tokensUsed?: number; model?: string }> {
    try {
      return await this.groq.chatJson(messages, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Fase ${phase} del análisis de imagen falló: ${message}`);
      throw new HttpException(
        `La fase ${phase} del análisis no pudo completarse. Inténtalo de nuevo en unos segundos.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Normalización defensiva: el modelo puede devolver claves en inglés, valores
  // sueltos o campos ausentes. La UI siempre recibe la misma forma.
  // ---------------------------------------------------------------------------

  normalizeContent(raw: any): ImageContentPhase {
    const contenidoPrincipal = this.text(
      this.pick(raw, 'contenidoPrincipal', 'contenido', 'mainContent', 'content', 'description'),
    );

    return {
      titulo: this.text(this.pick(raw, 'titulo', 'title')) || 'Contenido de la imagen',
      tipoContenido:
        this.text(this.pick(raw, 'tipoContenido', 'tipo', 'type', 'kind')) || 'otro',
      tema: this.text(this.pick(raw, 'tema', 'topic', 'subject')),
      nivelDificultad:
        this.text(this.pick(raw, 'nivelDificultad', 'dificultad', 'difficulty', 'level')) ||
        'intermedio',
      contenidoPrincipal: contenidoPrincipal || 'Sin contenido legible en la imagen.',
      textoDetectado: this.text(
        this.pick(raw, 'textoDetectado', 'texto', 'text', 'transcription', 'ocr'),
      ),
      elementosClave: this.list(
        this.pick(raw, 'elementosClave', 'elementos', 'keyElements', 'keyPoints'),
      ),
      advertencias: this.list(this.pick(raw, 'advertencias', 'warnings', 'notes')),
    };
  }

  normalizeInternalPrompt(
    raw: any,
    fallbackEnfoque = '',
  ): InternalPromptPhase {
    const promptInterno = this.text(
      this.pick(raw, 'promptInterno', 'prompt', 'internalPrompt', 'instructions'),
    );

    return {
      promptInterno:
        promptInterno ||
        'Analiza el contenido, explica sus conceptos y conviértelo en material de estudio.',
      objetivo: this.text(this.pick(raw, 'objetivo', 'objective', 'goal')),
      enfoque: this.text(this.pick(raw, 'enfoque', 'focus', 'approach')) || fallbackEnfoque,
      preguntasGuia: this.list(
        this.pick(raw, 'preguntasGuia', 'preguntas', 'guidingQuestions', 'questions'),
      ),
      estructura: this.list(this.pick(raw, 'estructura', 'structure', 'sections')),
    };
  }

  normalizeDetail(raw: any): ImageDetailPhase {
    return {
      resumen: this.text(this.pick(raw, 'resumen', 'summary')),
      ideasClave: this.list(this.pick(raw, 'ideasClave', 'ideas', 'keyIdeas')),
      conceptos: this.concepts(this.pick(raw, 'conceptos', 'concepts')),
      explicacionPasoAPaso: this.list(
        this.pick(raw, 'explicacionPasoAPaso', 'pasos', 'steps', 'stepByStep'),
      ),
      ejemplos: this.list(this.pick(raw, 'ejemplos', 'examples')),
      posiblesPreguntas: this.list(
        this.pick(raw, 'posiblesPreguntas', 'preguntas', 'questions', 'possibleQuestions'),
      ),
      vacios: this.list(this.pick(raw, 'vacios', 'gaps', 'missing')),
    };
  }

  private pick(source: any, ...keys: string[]): unknown {
    if (!source || typeof source !== 'object') return undefined;
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  private text(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  private list(value: unknown, max = 40): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            return this.text(
              this.pick(item, 'texto', 'text', 'idea', 'item', 'descripcion', 'description'),
            );
          }
          return this.text(item);
        })
        .filter(Boolean)
        .slice(0, max);
    }
    const single = this.text(value);
    return single ? [single] : [];
  }

  private concepts(value: unknown, max = 40): Array<{ termino: string; definicion: string }> {
    if (!Array.isArray(value)) {
      const single = this.text(value);
      return single ? [{ termino: single, definicion: '' }] : [];
    }

    return value
      .map((item) => {
        if (typeof item === 'string') {
          return { termino: item.trim(), definicion: '' };
        }
        if (item && typeof item === 'object') {
          return {
            termino: this.text(this.pick(item, 'termino', 'término', 'term', 'concepto', 'name')),
            definicion: this.text(
              this.pick(item, 'definicion', 'definición', 'definition', 'descripcion', 'description'),
            ),
          };
        }
        return { termino: '', definicion: '' };
      })
      .filter((item) => item.termino || item.definicion)
      .slice(0, max);
  }
}
