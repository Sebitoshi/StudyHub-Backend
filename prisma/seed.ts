import { PrismaClient, AchievementCategory } from '@prisma/client';

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
      code: 'FIRST_SUBJECT', nombre: 'Primera materia',
      descripcion: 'Crear tu primera materia',
      category: AchievementCategory.SUBJECT, icon: 'book', badgeColor: '#4CAF50', xpReward: 20,
    },
    {
      code: 'FIRST_TASK', nombre: 'Primera tarea',
      descripcion: 'Crear tu primera tarea',
      category: AchievementCategory.TASK, icon: 'task', badgeColor: '#2196F3', xpReward: 20,
    },
    {
      code: 'FIRST_TASK_COMPLETED', nombre: 'Primera tarea completada',
      descripcion: 'Completar tu primera tarea',
      category: AchievementCategory.TASK, icon: 'check_circle', badgeColor: '#4CAF50', xpReward: 30,
    },
    {
      code: 'TEN_TASKS_COMPLETED', nombre: '10 tareas completadas',
      descripcion: 'Completar 10 tareas',
      category: AchievementCategory.TASK, icon: 'star', badgeColor: '#FF9800', xpReward: 50,
    },
    {
      code: 'FIFTY_TASKS_COMPLETED', nombre: '50 tareas completadas',
      descripcion: 'Completar 50 tareas',
      category: AchievementCategory.TASK, icon: 'stars', badgeColor: '#F44336', xpReward: 100,
    },
    {
      code: 'HUNDRED_NOTES', nombre: '100 notas',
      descripcion: 'Crear 100 notas',
      category: AchievementCategory.NOTE, icon: 'note_stack', badgeColor: '#9C27B0', xpReward: 100,
    },
    {
      code: 'STREAK_7', nombre: 'Racha de 7 días',
      descripcion: 'Mantener una racha de 7 días',
      category: AchievementCategory.STREAK, icon: 'local_fire_department', badgeColor: '#FF5722', xpReward: 50,
    },
    {
      code: 'STREAK_30', nombre: 'Racha de 30 días',
      descripcion: 'Mantener una racha de 30 días',
      category: AchievementCategory.STREAK, icon: 'whatshot', badgeColor: '#D32F2F', xpReward: 100,
    },
    {
      code: 'LEVEL_5', nombre: 'Nivel 5',
      descripcion: 'Alcanzar el nivel 5',
      category: AchievementCategory.SUBJECT, icon: 'military_tech', badgeColor: '#FFD700', xpReward: 80,
    },
  ];

  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { code: a.code },
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
