import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const objectives = [
    'Conseguir empleo',
    'Conseguir prácticas',
    'Mejorar mi promedio',
    'Aprender programación',
    'Organizar mis estudios',
    'Crear un mejor CV',
    'Prepararme para entrevistas',
  ];

  for (const nombre of objectives) {
    await prisma.objective.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  const modules = [
    { nombre: 'Dashboard', slug: 'dashboard', activoDefecto: true, icon: 'dashboard' },
    { nombre: 'Perfil', slug: 'profile', activoDefecto: true, icon: 'person' },
    { nombre: 'Horarios', slug: 'schedule', activoDefecto: true, icon: 'calendar' },
    { nombre: 'Tareas', slug: 'tasks', activoDefecto: true, icon: 'task' },
    { nombre: 'Notas', slug: 'notes', activoDefecto: true, icon: 'note' },
    { nombre: 'Profesor IA', slug: 'ai-tutor', activoDefecto: false, icon: 'smart_toy' },
    { nombre: 'Constructor CV', slug: 'cv-builder', activoDefecto: false, icon: 'description' },
    { nombre: 'Empleos', slug: 'jobs', activoDefecto: false, icon: 'work' },
    { nombre: 'Roadmaps', slug: 'roadmaps', activoDefecto: false, icon: 'map' },
    { nombre: 'Grupos de estudio', slug: 'study-groups', activoDefecto: false, icon: 'groups' },
  ];

  for (const m of modules) {
    await prisma.appModule.upsert({
      where: { nombre: m.nombre },
      update: {},
      create: m,
    });
  }

  const achievements = [
    {
      nombre: 'FIRST_SUBJECT',
      descripcion: 'Crear tu primera materia',
      icon: 'book',
      xpReward: 20,
    },
    {
      nombre: 'FIRST_TASK',
      descripcion: 'Crear tu primera tarea',
      icon: 'task',
      xpReward: 20,
    },
    {
      nombre: 'FIRST_TASK_COMPLETED',
      descripcion: 'Completar tu primera tarea',
      icon: 'check_circle',
      xpReward: 30,
    },
    {
      nombre: 'TEN_TASKS_COMPLETED',
      descripcion: 'Completar 10 tareas',
      icon: 'star',
      xpReward: 50,
    },
    {
      nombre: 'FIFTY_TASKS_COMPLETED',
      descripcion: 'Completar 50 tareas',
      icon: 'stars',
      xpReward: 100,
    },
    {
      nombre: 'HUNDRED_NOTES',
      descripcion: 'Crear 100 notas',
      icon: 'note_stack',
      xpReward: 100,
    },
    {
      nombre: 'STREAK_7',
      descripcion: 'Mantener una racha de 7 días',
      icon: 'local_fire_department',
      xpReward: 50,
    },
    {
      nombre: 'STREAK_30',
      descripcion: 'Mantener una racha de 30 días',
      icon: 'whatshot',
      xpReward: 100,
    },
    {
      nombre: 'LEVEL_5',
      descripcion: 'Alcanzar el nivel 5',
      icon: 'military_tech',
      xpReward: 80,
    },
  ];

  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { nombre: a.nombre },
      update: {},
      create: a,
    });
  }

  console.log('Seed completed ✓');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
