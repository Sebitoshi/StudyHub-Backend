import { GroqService } from './groq.service';

describe('GroqService', () => {
  const previous = new Map<string, string | undefined>();
  const envKeys = [
    'GROQ_API_KEY',
    'GROQ_MODEL',
    'GROQ_FALLBACK_MODELS',
    'GROQ_CHAT_MAX_TOKENS',
  ] as const;

  beforeAll(() => {
    for (const key of envKeys) previous.set(key, process.env[key]);
  });

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key';
    process.env.GROQ_MODEL = 'qwen/qwen3.8-27b';
    delete process.env.GROQ_FALLBACK_MODELS;
    delete process.env.GROQ_CHAT_MAX_TOKENS;
  });

  afterAll(() => {
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('cambia a un modelo gratuito de respaldo si el principal agota su OTPM', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(
          new Error(
            '429 Request too large on output tokens per minute (OTPM): Limit 1000',
          ),
          { status: 429 },
        ),
      )
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Respuesta de respaldo' } }],
        usage: { total_tokens: 12 },
      });

    const service = new GroqService();
    (service as any).client = { chat: { completions: { create } } };

    const result = await service.chat([{ role: 'user', content: 'Hola' }]);

    expect(result.content).toBe('Respuesta de respaldo');
    expect(result.model).toBe('openai/gpt-oss-120b');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toMatchObject({
      model: 'qwen/qwen3.8-27b',
      max_tokens: 900,
    });
    expect(create.mock.calls[1][0]).toMatchObject({
      model: 'openai/gpt-oss-120b',
      max_tokens: 900,
    });
  });

  it('respeta un modelo explícito (por ejemplo, uno de visión) sin cambiarlo', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'Veo la imagen' } }],
    });

    const service = new GroqService();
    (service as any).client = { chat: { completions: { create } } };

    const result = await service.chat(
      [{ role: 'user', content: 'Analiza' }],
      { model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    );

    expect(result.model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe(
      'meta-llama/llama-4-scout-17b-16e-instruct',
    );
  });
});
