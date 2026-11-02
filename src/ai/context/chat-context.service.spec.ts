import { Test, TestingModule } from '@nestjs/testing';
import { ChatContextService } from './chat-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratedResourcesService } from '../generated-resources/generated-resources.service';
import { normalizeChatDepth } from './chat-depth';

describe('ChatContextService', () => {
  let service: ChatContextService;
  let prisma: {
    academicProfile: { findUnique: jest.Mock };
    roadmap: { findMany: jest.Mock };
    subject: { findMany: jest.Mock };
    note: { findMany: jest.Mock };
  };
  let resources: { listCompletedAssessments: jest.Mock };

  beforeEach(async () => {
    prisma = {
      academicProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      roadmap: { findMany: jest.fn().mockResolvedValue([]) },
      subject: { findMany: jest.fn().mockResolvedValue([]) },
      note: { findMany: jest.fn().mockResolvedValue([]) },
    };
    resources = { listCompletedAssessments: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatContextService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeneratedResourcesService, useValue: resources },
      ],
    }).compile();

    service = module.get(ChatContextService);
  });

  it('no consulta nada en modo low', async () => {
    const context = await service.build(1, 'low', 'hola');

    expect(context).toBe('');
    expect(prisma.academicProfile.findUnique).not.toHaveBeenCalled();
    expect(resources.listCompletedAssessments).not.toHaveBeenCalled();
  });

  it('en medium incluye perfil, quizzes/simulacros y rutas, sin apuntes', async () => {
    prisma.academicProfile.findUnique.mockResolvedValue({
      carrera: 'Ingeniería',
      universidad: 'UNAL',
      semestreActual: 5,
    });
    resources.listCompletedAssessments.mockResolvedValue([
      {
        type: 'QUIZ',
        title: 'Quiz de derivadas',
        subject: 'Cálculo',
        completed: true,
        resultCorrect: 4,
        resultTotal: 5,
        trigger: 'QUIZ_TAB',
      },
      {
        type: 'QUIZ',
        title: 'Simulacro parcial',
        subject: 'Cálculo',
        completed: true,
        resultCorrect: 7,
        resultTotal: 10,
        trigger: 'SIMULACRO_TAB',
      },
    ]);
    prisma.roadmap.findMany.mockResolvedValue([
      {
        title: 'Aprender Python',
        topic: 'Python',
        currentLevel: 2,
        totalLevels: 5,
        steps: [{ completed: true }, { completed: false }],
      },
    ]);

    const context = await service.build(1, 'medium', '¿cómo voy?');

    expect(context).toContain('Carrera: Ingeniería');
    expect(context).toContain('Quiz "Quiz de derivadas" (Cálculo): 4/5 (80%)');
    expect(context).toContain('Simulacro "Simulacro parcial" (Cálculo): 7/10 (70%)');
    expect(context).toContain('Ruta "Aprender Python" (Python): 1/2 pasos · nivel 2/5');
    expect(context).not.toContain('Apuntes');
    expect(prisma.note.findMany).not.toHaveBeenCalled();
  });

  it('en max añade solo los apuntes de las materias del profesor elegido', async () => {
    prisma.subject.findMany.mockResolvedValue([
      { id: 1, nombre: 'Cálculo diferencial', profesor: 'Gómez' },
      { id: 2, nombre: 'Historia', profesor: 'Pérez' },
    ]);
    prisma.note.findMany.mockResolvedValue([
      {
        title: 'Regla de la cadena',
        content: 'Se deriva de afuera hacia adentro.',
        updatedAt: new Date('2026-10-20'),
        subjectId: 1,
        subject: { nombre: 'Cálculo diferencial' },
      },
    ]);

    const context = await service.build(1, 'max', 'ayúdame', {
      name: 'Profesor de Matemáticas',
      subjects: ['calculo'],
    });

    expect(prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { subjectId: { in: [1] } } }),
    );
    expect(context).toContain('[Cálculo diferencial] "Regla de la cadena"');
  });

  it('en max no inventa apuntes si el profesor no tiene materias asociadas', async () => {
    prisma.subject.findMany.mockResolvedValue([
      { id: 2, nombre: 'Historia', profesor: 'Pérez' },
    ]);

    const context = await service.build(1, 'max', 'ayúdame', {
      name: 'Profesor de Matemáticas',
      subjects: ['calculo'],
    });

    expect(prisma.note.findMany).not.toHaveBeenCalled();
    expect(context).not.toContain('Apuntes');
  });

  it('en maxpro toma hasta dos apuntes por materia y prioriza los de la pregunta', async () => {
    prisma.subject.findMany.mockResolvedValue([
      { id: 1, nombre: 'Cálculo', profesor: 'Gómez' },
      { id: 2, nombre: 'Física', profesor: 'Ruiz' },
    ]);
    prisma.note.findMany.mockResolvedValue([
      {
        title: 'Límites',
        content: 'Concepto de límite y continuidad.',
        updatedAt: new Date('2026-10-25'),
        subjectId: 1,
        subject: { nombre: 'Cálculo' },
      },
      {
        title: 'Derivadas',
        content: 'Reglas de derivación y regla de la cadena.',
        updatedAt: new Date('2026-10-01'),
        subjectId: 1,
        subject: { nombre: 'Cálculo' },
      },
      {
        title: 'Integrales',
        content: 'Integral definida.',
        updatedAt: new Date('2026-10-20'),
        subjectId: 1,
        subject: { nombre: 'Cálculo' },
      },
      {
        title: 'Cinemática',
        content: 'Movimiento rectilíneo uniforme.',
        updatedAt: new Date('2026-10-22'),
        subjectId: 2,
        subject: { nombre: 'Física' },
      },
    ]);

    const context = await service.build(1, 'maxpro', 'explícame las derivadas');

    expect(context).toContain('"Derivadas"');
    expect(context).toContain('"Cinemática"');
    // Dos por materia como máximo: Integrales (la tercera de Cálculo) no entra.
    expect(context).not.toContain('"Integrales"');
  });
});

describe('normalizeChatDepth', () => {
  it('acepta alias y cae en medium por defecto', () => {
    expect(normalizeChatDepth('low')).toBe('low');
    expect(normalizeChatDepth('Low Flash')).toBe('low');
    expect(normalizeChatDepth('flash')).toBe('low');
    expect(normalizeChatDepth('medium')).toBe('medium');
    expect(normalizeChatDepth('max')).toBe('max');
    expect(normalizeChatDepth('max-pro')).toBe('maxpro');
    expect(normalizeChatDepth('Max Pro')).toBe('maxpro');
    expect(normalizeChatDepth(undefined)).toBe('medium');
    expect(normalizeChatDepth('otro')).toBe('medium');
  });
});
