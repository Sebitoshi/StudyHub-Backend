import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  const builder = new PromptBuilderService();

  it('en low no inyecta contexto del estudiante', async () => {
    const messages = await builder.buildPrompt({
      userId: 2,
      depth: 'low',
      userMessage: 'hola',
      conversationContext: [
        { role: 'user', content: 'antes' },
        { role: 'assistant', content: 'respuesta' },
      ],
    });

    const joined = messages.map((message) => message.content).join('\n');
    expect(joined).not.toContain('StudentContext');
    expect(joined).not.toContain('RelevantMemories');
    expect(joined).not.toContain('KnowledgeGaps');
  });

  it('en medium inyecta solo el contexto compacto', async () => {
    const messages = await builder.buildPrompt({
      userId: 2,
      depth: 'medium',
      userMessage: '¿cómo voy?',
      contextText: 'Perfil académico:\nCarrera: Ingeniería',
      conversationContext: [],
    });

    const joined = messages.map((message) => message.content).join('\n');
    expect(joined).toContain('StudentContext (modo Medium');
    expect(joined).toContain('Carrera: Ingeniería');
    expect(joined).not.toContain('RelevantMemories');
    expect(joined).not.toContain('KnowledgeGaps');
    expect(joined).not.toContain('StudentProfile');
  });

  it('en auto indica que el contexto se detecta automáticamente', async () => {
    const messages = await builder.buildPrompt({
      userId: 2,
      depth: 'auto',
      userMessage: '¿cómo voy?',
      contextText: 'Perfil académico:\nCarrera: Ingeniería',
      conversationContext: [],
    });

    const joined = messages.map((message) => message.content).join('\n');
    expect(joined).toContain('StudentContext (modo Auto');
    expect(joined).toContain('Carrera: Ingeniería');
    expect(joined).not.toContain('RelevantMemories');
  });

  it('limita el historial a los últimos 8 mensajes', async () => {
    const conversationContext = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? 'assistant' : 'user',
      content: `msg-${index}`,
    }));

    const messages = await builder.buildPrompt({
      userId: 2,
      depth: 'low',
      userMessage: 'final',
      conversationContext,
    });

    const contents = messages.map((message) => message.content);
    expect(contents).toContain('msg-11');
    expect(contents).not.toContain('msg-3');
  });
});
