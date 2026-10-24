import { BadRequestException, HttpException } from '@nestjs/common';
import { NotesAssistantService } from './notes-assistant.service';

describe('NotesAssistantService', () => {
  const groq = { chat: jest.fn() };
  let service: NotesAssistantService;

  beforeEach(() => {
    groq.chat.mockReset();
    service = new NotesAssistantService(groq as any);
  });

  it('rechaza mejorar o resumir sin contenido suficiente', async () => {
    await expect(service.suggest({ action: 'improve', title: 'Límites', content: 'corto' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(groq.chat).not.toHaveBeenCalled();
  });

  it('rechaza un borrador sin título ni indicación', async () => {
    await expect(service.suggest({ action: 'draft' })).rejects.toBeInstanceOf(BadRequestException);
    expect(groq.chat).not.toHaveBeenCalled();
  });

  it('genera un borrador y desenvuelve el bloque de código', async () => {
    groq.chat.mockResolvedValue({
      content: '```markdown\n## Derivadas\n\nLa derivada mide el cambio.\n```',
      model: 'openai/gpt-oss-120b',
    });

    const result = await service.suggest({
      action: 'draft',
      title: 'Derivadas',
      subjectName: 'Cálculo',
    });

    expect(result.proposal).toBe('## Derivadas\n\nLa derivada mide el cambio.');
    expect(result.action).toBe('draft');
    expect(groq.chat).toHaveBeenCalledTimes(1);

    const [messages, options] = groq.chat.mock.calls[0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('«Derivadas»');
    expect(messages[1].content).toContain('Materia: Cálculo');
    expect(options.maxTokens).toBeGreaterThan(0);
    expect(options.maxTokens).toBeLessThanOrEqual(2400);
  });

  it('para continuar envía el final del apunte y pide solo la continuación', async () => {
    groq.chat.mockResolvedValue({ content: 'Y así termina la demostración.' });
    const content = `INICIO-DEL-APUNTE ${'Relleno '.repeat(3000)}FINAL DEL APUNTE`;

    const result = await service.suggest({ action: 'continue', title: 'Tema', content });

    expect(result.proposal).toBe('Y así termina la demostración.');
    const prompt = groq.chat.mock.calls[0][0][1].content as string;
    expect(prompt).toContain('FINAL DEL APUNTE');
    expect(prompt).not.toContain('INICIO-DEL-APUNTE');
    expect(prompt).toContain('SOLO la continuación');
  });

  it('traduce el límite de peticiones a un 429 amigable', async () => {
    groq.chat.mockRejectedValue({ status: 429, message: 'Rate limit reached for tokens per minute' });

    const error = await service
      .suggest({ action: 'summarize', title: 'Tema', content: 'Contenido suficiente para resumir este apunte.' })
      .catch((err) => err);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
    expect(error.message).toContain('muchas solicitudes');
  });
});
