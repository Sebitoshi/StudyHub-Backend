import { AiProviderService } from './ai-provider.service';
import { GeminiRequestError } from './gemini.service';

function setup(options: { enabled?: boolean } = {}) {
  const gemini = {
    isEnabled: jest.fn().mockReturnValue(options.enabled ?? true),
    chat: jest.fn(),
    chatJson: jest.fn(),
    stream: jest.fn(),
  };
  const groq = {
    chat: jest.fn(),
    chatJson: jest.fn(),
    stream: jest.fn(),
  };

  const provider = new AiProviderService(gemini as any, groq as any);
  return { provider, gemini, groq };
}

describe('AiProviderService', () => {
  const previousCooldown = process.env.AI_FALLBACK_COOLDOWN_MS;

  beforeEach(() => {
    // Sin enfriamiento para que cada test sea independiente.
    process.env.AI_FALLBACK_COOLDOWN_MS = '0';
  });

  afterAll(() => {
    if (previousCooldown === undefined)
      delete process.env.AI_FALLBACK_COOLDOWN_MS;
    else process.env.AI_FALLBACK_COOLDOWN_MS = previousCooldown;
  });

  it('usa Gemini como proveedor principal', async () => {
    const { provider, gemini, groq } = setup();
    gemini.chat.mockResolvedValue({
      content: 'respuesta de Gemini',
      model: 'gemini-3.8-flash',
    });

    const result = await provider.chat([{ role: 'user', content: 'Hola' }]);

    expect(result).toEqual({
      content: 'respuesta de Gemini',
      model: 'gemini-3.8-flash',
      provider: 'gemini',
    });
    expect(groq.chat).not.toHaveBeenCalled();
  });

  it('cae a Groq cuando Gemini no responde', async () => {
    const { provider, gemini, groq } = setup();
    gemini.chat.mockRejectedValue(new Error('Gemini 503: sobrecargado'));
    groq.chat.mockResolvedValue({
      content: 'respuesta de Groq',
      model: 'openai/gpt-oss-120b',
    });

    const result = await provider.chat([{ role: 'user', content: 'Hola' }]);

    expect(result.provider).toBe('groq');
    expect(result.content).toBe('respuesta de Groq');
    expect(groq.chat).toHaveBeenCalledTimes(1);
  });

  it('va directo a Groq si Gemini no está configurado', async () => {
    const { provider, gemini, groq } = setup({ enabled: false });
    groq.chat.mockResolvedValue({
      content: 'Groq',
      model: 'openai/gpt-oss-120b',
    });

    const result = await provider.chat([{ role: 'user', content: 'Hola' }]);

    expect(result.provider).toBe('groq');
    expect(gemini.chat).not.toHaveBeenCalled();
    expect(groq.chat).toHaveBeenCalledTimes(1);
  });

  it('no enfría Gemini por un error de contenido de una sola petición', async () => {
    process.env.AI_FALLBACK_COOLDOWN_MS = '60000';
    const { provider, gemini, groq } = setup();
    gemini.chat.mockRejectedValue(
      new GeminiRequestError('Gemini 400: contenido bloqueado', 400),
    );
    groq.chat.mockResolvedValue({ content: 'Groq', model: 'groq-model' });

    await provider.chat([{ role: 'user', content: 'Uno' }]);
    await provider.chat([{ role: 'user', content: 'Dos' }]);

    expect(gemini.chat).toHaveBeenCalledTimes(2);
    expect(groq.chat).toHaveBeenCalledTimes(2);
  });

  it('enfría Gemini tras una caída del proveedor', async () => {
    process.env.AI_FALLBACK_COOLDOWN_MS = '60000';
    const { provider, gemini, groq } = setup();
    gemini.chat.mockRejectedValue(
      new GeminiRequestError('Gemini 503: no disponible', 503),
    );
    groq.chat.mockResolvedValue({ content: 'Groq', model: 'groq-model' });

    await provider.chat([{ role: 'user', content: 'Uno' }]);
    await provider.chat([{ role: 'user', content: 'Dos' }]);

    expect(gemini.chat).toHaveBeenCalledTimes(1);
    expect(groq.chat).toHaveBeenCalledTimes(2);
  });

  it('también protege las respuestas JSON', async () => {
    const { provider, gemini, groq } = setup();
    gemini.chatJson.mockRejectedValue(new Error('JSON inválido'));
    groq.chatJson.mockResolvedValue({
      data: { ok: true },
      model: 'openai/gpt-oss-120b',
    });

    const result = await provider.chatJson([{ role: 'user', content: 'JSON' }]);

    expect(result.data).toEqual({ ok: true });
    expect(result.provider).toBe('groq');
  });

  it('usa Groq para el stream si Gemini falla antes de emitir texto', async () => {
    const { provider, gemini, groq } = setup();
    gemini.stream.mockRejectedValue(new Error('stream caído'));
    groq.stream.mockImplementation(async (_messages, onChunk) => {
      await onChunk('texto de Groq');
      return true;
    });

    const chunks: string[] = [];
    const result = await provider.stream(
      [{ role: 'user', content: 'Hola' }],
      (chunk) => {
        chunks.push(chunk);
      },
    );

    expect(result).toEqual({
      used: true,
      model: 'openai/gpt-oss-120b',
      provider: 'groq',
    });
    expect(chunks).toEqual(['texto de Groq']);
  });

  it('no duplica el stream si Gemini falla después de emitir texto', async () => {
    const { provider, gemini, groq } = setup();
    gemini.stream.mockImplementation(async (_messages, onChunk) => {
      await onChunk('texto parcial');
      throw new Error('corte a mitad del stream');
    });

    await expect(
      provider.stream([{ role: 'user', content: 'Hola' }], () => undefined),
    ).rejects.toThrow('corte a mitad del stream');
    expect(groq.stream).not.toHaveBeenCalled();
  });
});
