import { GeminiService } from './gemini.service';

const ENV_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_VISION_MODEL',
  'GEMINI_FALLBACK_MODELS',
  'GEMINI_VISION_FALLBACK_MODELS',
  'GEMINI_THINKING_LEVEL',
  'GEMINI_THINKING_BUDGET',
  'GEMINI_TIMEOUT_MS',
  'GEMINI_STREAM_TIMEOUT_MS',
  'GEMINI_API_BASE_URL',
] as const;

function fakeResponse(payload: unknown, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

function sseResponse(events: string[]): any {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(event));
        controller.close();
      },
    }),
    headers: new Headers({ 'content-type': 'text/event-stream' }),
  };
}

describe('GeminiService', () => {
  const previous = new Map<string, string | undefined>();
  const nativeFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeAll(() => {
    for (const key of ENV_KEYS) previous.set(key, process.env[key]);
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
    process.env.GEMINI_VISION_MODEL = 'gemini-3.8-flash';
    delete process.env.GEMINI_FALLBACK_MODELS;
    delete process.env.GEMINI_VISION_FALLBACK_MODELS;
    process.env.GEMINI_THINKING_LEVEL = 'low';
    delete process.env.GEMINI_THINKING_BUDGET;
    delete process.env.GEMINI_TIMEOUT_MS;
    delete process.env.GEMINI_STREAM_TIMEOUT_MS;
    delete process.env.GEMINI_API_BASE_URL;
    fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock;
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = nativeFetch;
  });

  it('envía todo el contexto y traduce system, historial e imágenes', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        candidates: [
          {
            content: { parts: [{ text: 'Hola, soy el profesor.' }] },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: { totalTokenCount: 42 },
        modelVersion: 'models/gemini-3.8-flash',
      }),
    );

    const service = new GeminiService();
    const result = await service.chat(
      [
        { role: 'system', content: 'Eres un tutor académico.' },
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: '¿Qué necesitas?' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Mira esta imagen' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,aGVsbG8=' },
            },
          ],
        },
      ],
      {
        temperature: 0.2,
        maxTokens: 900,
        model: 'openai/gpt-oss-120b',
      },
    );

    expect(result.content).toBe('Hola, soy el profesor.');
    expect(result.tokensUsed).toBe(42);
    expect(result.model).toBe('gemini-3.8-flash');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/models/gemini-3.8-flash:generateContent');
    expect(init.headers['x-goog-api-key']).toBe('test-key');

    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe(
      'Eres un tutor académico.',
    );
    expect(body.contents).toHaveLength(3);
    expect(body.contents.map((item: any) => item.role)).toEqual([
      'user',
      'model',
      'user',
    ]);
    expect(body.contents[2].parts[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'aGVsbG8=' },
    });
    expect(body.generationConfig.temperature).toBe(0.2);
    expect(body.generationConfig.maxOutputTokens).toBe(2048);
    expect(body.generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'low',
    });
  });

  it('prueba un modelo gratuito de respaldo cuando el principal está saturado', async () => {
    fetchMock
      .mockResolvedValueOnce(
        fakeResponse(
          {
            error: {
              message:
                'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(
        fakeResponse({
          candidates: [
            {
              content: { parts: [{ text: 'Respuesta del respaldo' }] },
              finishReason: 'STOP',
            },
          ],
          modelVersion: 'models/gemini-2.5-flash',
        }),
      );

    const service = new GeminiService();
    const result = await service.chat([{ role: 'user', content: 'Hola' }]);

    expect(result.content).toBe('Respuesta del respaldo');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(
      '/models/gemini-3.8-flash:generateContent',
    );
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/models/gemini-2.5-flash:generateContent',
    );
  });

  it('no cambia de modelo ante un 400 de contenido', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(
        { error: { message: 'El contenido fue bloqueado por seguridad.' } },
        400,
      ),
    );

    const service = new GeminiService();

    await expect(
      service.chat([{ role: 'user', content: 'Hola' }]),
    ).rejects.toThrow('Gemini 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('usa el respaldo de visión si el modelo visual principal falla', async () => {
    fetchMock
      .mockResolvedValueOnce(
        fakeResponse({ error: { message: 'high demand' } }, 503),
      )
      .mockResolvedValueOnce(
        fakeResponse({
          candidates: [
            { content: { parts: [{ text: 'Veo la imagen.' }] } },
          ],
          modelVersion: 'models/gemini-2.5-flash',
        }),
      );

    const service = new GeminiService();
    const result = await service.chat([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analiza' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' },
          },
        ],
      },
    ]);

    expect(result.content).toBe('Veo la imagen.');
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/models/gemini-2.5-flash:generateContent',
    );
  });

  it('pide JSON y tolera el bloque de código que devuelve el modelo', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        candidates: [
          {
            content: {
              parts: [
                { text: '```json\n{"cards":[{"question":"¿2+2?"}]}\n```' },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      }),
    );

    const service = new GeminiService();
    const result = await service.chatJson([
      { role: 'user', content: 'Genera JSON' },
    ]);

    expect(result.data).toEqual({ cards: [{ question: '¿2+2?' }] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('transmite los trozos SSE en orden', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hola "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"mundo"}]},"finishReason":"STOP"}]}\n\n',
      ]),
    );

    const service = new GeminiService();
    const chunks: string[] = [];
    const result = await service.stream(
      [{ role: 'user', content: 'Saluda' }],
      (chunk) => {
        chunks.push(chunk);
      },
    );

    expect(result).toEqual({ used: true, model: 'gemini-3.8-flash' });
    expect(chunks.join('')).toBe('Hola mundo');
  });

  it('reintenta el stream con un modelo de respaldo si no emitió texto', async () => {
    fetchMock
      .mockResolvedValueOnce(
        fakeResponse({ error: { message: 'high demand' } }, 503),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"Hola desde 2.5"}]}}]}\n\n',
        ]),
      );

    const service = new GeminiService();
    const chunks: string[] = [];
    const result = await service.stream(
      [{ role: 'user', content: 'Saluda' }],
      (chunk) => {
        chunks.push(chunk);
      },
    );

    expect(result).toEqual({ used: true, model: 'gemini-2.5-flash' });
    expect(chunks.join('')).toBe('Hola desde 2.5');
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/models/gemini-2.5-flash:streamGenerateContent',
    );
  });

  it('no llama a la API si falta la clave', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = new GeminiService();

    expect(service.isEnabled()).toBe(false);
    await expect(
      service.chat([{ role: 'user', content: 'Hola' }]),
    ).rejects.toThrow('GEMINI_API_KEY no está configurada');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignora un modelo de Groq y usa el modelo de visión configurado', async () => {
    process.env.GEMINI_VISION_MODEL = 'gemini-3.5-flash-lite';
    fetchMock.mockResolvedValue(
      fakeResponse({
        candidates: [
          {
            content: { parts: [{ text: 'ok' }] },
            finishReason: 'STOP',
          },
        ],
      }),
    );

    const service = new GeminiService();
    await service.chat(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analiza' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/jpeg;base64,aGVsbG8=' },
            },
          ],
        },
      ],
      { model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    );

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/models/gemini-3.5-flash-lite:generateContent',
    );
  });
});
