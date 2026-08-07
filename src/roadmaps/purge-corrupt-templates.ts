/**
 * Purga de plantillas de roadmap corruptas.
 *
 * Antes del fix de GroqService (JSON truncado), el parseo toleraba un "prefijo
 * válido" del JSON generado: plantillas incompletas (pocos niveles, lecciones
 * faltantes) quedaban guardadas y se reutilizaban para todos los usuarios que
 * pedían el mismo tema.
 *
 * Este script detecta esas plantillas y, con --apply, las elimina. Los roadmaps
 * de usuarios quedan intactos (sourceTemplateId -> null, onDelete: SetNull).
 * La próxima vez que alguien pida esos temas se regenerarán con el código
 * corregido.
 *
 * Uso:
 *   npm run purge:roadmap-templates                  # DRY-RUN: solo lista
 *   npm run purge:roadmap-templates -- --apply       # elimina las corruptas
 *   DATABASE_URL=postgres://... npm run purge:roadmap-templates -- --apply
 *
 * Criterios de corrupción (un template se purga si cumple cualquiera):
 *   - data no es un objeto JSON
 *   - levels no es un array o está vacío
 *   - menos de PURGE_MIN_LEVELS (default 5) niveles, el prompt exige 5-8
 *   - algún nivel sin lessons válidas
 *   - alguna lesson sin "title"
 * Nota: no se valida lesson.practice a propósito: el modelo a veces omite
 * practice pese a las instrucciones y el servicio lo tolera (falsos positivos
 * serían peores que falsos negativos).
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Necesario para Vercel/Supabase (igual que PrismaService)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// El prompt exige entre 5 y 8 niveles progresivos (configurable por env)
const MIN_LEVELS = parseInt(process.env.PURGE_MIN_LEVELS || '5', 10) || 5;

const APPLY = process.argv.includes('--apply');

/** Pide confirmación interactiva SOLO si hay TTY (en CI/automación se omite). */
async function confirmDeletion(count: number): Promise<boolean> {
  if (!process.stdin.isTTY) return true;
  process.stdout.write(
    `¿Eliminar ${count} plantilla(s)? Escribe DELETE para confirmar: `,
  );
  for await (const chunk of process.stdin) {
    const input = String(chunk).trim();
    return input === 'DELETE';
  }
  return false;
}

interface TemplateRow {
  id: number;
  topic: string;
  topicSlug: string;
  totalLevels: number;
  usedCount: number;
  createdAt: Date;
  data: unknown;
}

interface CorruptInfo extends TemplateRow {
  reason: string;
}

interface RoadmapTemplateData {
  title?: unknown;
  description?: unknown;
  levels?: RoadmapLevel[];
}

interface RoadmapLevel {
  title?: unknown;
  lessons?: RoadmapLesson[];
}

interface RoadmapLesson {
  title?: unknown;
}

/** Devuelve el motivo de corrupción o null si la plantilla es válida. */
function classifyTemplate(t: TemplateRow): string | null {
  const data = t.data as RoadmapTemplateData | null;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return 'data no es un objeto JSON válido';
  }

  const reasons: string[] = [];

  if (!Array.isArray(data.levels)) {
    reasons.push('data.levels no es un array');
  } else if (data.levels.length === 0) {
    reasons.push('levels vacío');
  } else {
    if (data.levels.length < MIN_LEVELS) {
      reasons.push(
        `tiene ${data.levels.length} niveles (el prompt exige ${MIN_LEVELS}-8)`,
      );
    }
    const badLevel = data.levels.findIndex(
      (l: RoadmapLevel) =>
        typeof l !== 'object' ||
        l === null ||
        !Array.isArray(l.lessons) ||
        l.lessons.length === 0,
    );
    if (badLevel >= 0) {
      reasons.push(`el nivel ${badLevel + 1} no tiene lessons válidas`);
    } else {
      const badLessonLevel = data.levels.findIndex((l: RoadmapLevel) =>
        l.lessons?.some(
          (ls: RoadmapLesson) =>
            typeof ls !== 'object' || ls === null || !ls.title,
        ),
      );
      if (badLessonLevel >= 0) {
        reasons.push(
          `hay lessons sin "title" en el nivel ${badLessonLevel + 1}`,
        );
      }
    }
  }

  return reasons.length ? reasons.join('; ') : null;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Falta DATABASE_URL en el entorno (.env).');
    process.exit(1);
  }

  let host = '(desconocido)';
  try {
    host = new URL(connectionString).host;
  } catch {
    /* ignorar: solo es informativo */
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log(`🔌 Base de datos: ${host}`);
  console.log(
    APPLY
      ? '⚠️  Modo: ELIMINACIÓN (--apply)'
      : 'ℹ️  Modo: DRY-RUN — no se modifica nada. Usa --apply para eliminar.',
  );

  try {
    const templates = await prisma.roadmapTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
    console.log(`📋 Total de plantillas: ${templates.length}`);

    const corrupt: CorruptInfo[] = [];
    for (const t of templates) {
      const reason = classifyTemplate(t);
      if (reason) {
        corrupt.push({ ...t, reason });
      }
    }

    if (corrupt.length === 0) {
      console.log('✅ No se encontraron plantillas corruptas.');
      return;
    }

    console.log(
      `\n⚠️  ${corrupt.length} plantilla(s) corrupta(s) detectadas:\n`,
    );
    for (const c of corrupt) {
      console.log(
        `  - #${c.id} "${c.topic}" (slug: ${c.topicSlug}) | niveles: ${c.totalLevels} | usos: ${c.usedCount} | creada: ${c.createdAt.toISOString()}`,
      );
      console.log(`      Motivo: ${c.reason}`);
    }

    const totalUses = corrupt.reduce((sum, c) => sum + c.usedCount, 0);
    console.log(`\nUsos acumulados de plantillas corruptas: ${totalUses}`);

    const ids = corrupt.map((c) => c.id);
    const affectedRoadmaps = await prisma.roadmap.count({
      where: { sourceTemplateId: { in: ids } },
    });
    console.log(
      `ℹ️  Roadmaps de usuarios que quedarán desvinculados: ${affectedRoadmaps} (no se eliminan).`,
    );

    if (APPLY) {
      if (!(await confirmDeletion(corrupt.length))) {
        console.log('❌ Confirmación requerida. No se eliminó nada.');
        return;
      }
      const result = await prisma.roadmapTemplate.deleteMany({
        where: { id: { in: ids } },
      });
      console.log(
        `🗑️  ${result.count} plantilla(s) eliminada(s). Los roadmaps de usuarios quedan intactos (desvinculados).`,
      );
      console.log(
        'La próxima vez que un usuario pida esos temas, se regenerarán con el código corregido.',
      );
    } else {
      console.log(
        '\nℹ️  Ejecuta con --apply para eliminarlas: npm run purge:roadmap-templates -- --apply',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Error ejecutando la purga:', err);
  process.exit(1);
});
