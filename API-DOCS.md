# StudyHub Backend — API Endpoints

> Base URL: `https://study-hub-backend-sigma.vercel.app`

---

## Autenticación

Todas las rutas protegidas requieren un header:
```
Authorization: Bearer <access_token>
```

El token JWT contiene `{ sub: userId, email }`.

---

## Auth — `/auth`

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Registrar usuario |
| POST | `/auth/login` | No | Iniciar sesión |
| POST | `/auth/verify-email` | No | Verificar email con código |
| POST | `/auth/resend-code` | No | Reenviar código de verificación |
| GET | `/auth/google` | No | Redirigir a Google OAuth |
| GET | `/auth/google/callback` | No | Callback de Google OAuth |
| POST | `/auth/forgot-password` | No | Solicitar restablecimiento de contraseña |
| POST | `/auth/reset-password` | No | Restablecer contraseña con token |
| POST | `/auth/logout` | JWT | Cerrar sesión |

### POST `/auth/register`
```json
// Request
{ "nombre": "Juan", "apellido": "Pérez", "email": "juan@mail.com", "password": "123456", "confirmPassword": "123456" }

// Response 201
{
  "access_token": "eyJhbGciOi...",
  "user": { "id": 1, "nombre": "Juan", "apellido": "Pérez", "email": "juan@mail.com" }
}
```

### POST `/auth/login`
```json
// Request
{ "email": "juan@mail.com", "password": "123456" }

// Response 200
{
  "access_token": "eyJhbGciOi...",
  "user": { "id": 1, "nombre": "Juan", "apellido": "Pérez", "email": "juan@mail.com" }
}
```

### GET `/auth/google/callback`
Redirige a: `${FRONTEND_URL}/auth/callback?token=...&user=...`

---

## Materias — `/subjects` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/subjects` | Crear materia |
| GET | `/subjects` | Listar todas las materias |
| GET | `/subjects/:id` | Detalle de materia (con horarios, tareas, notas) |
| PUT | `/subjects/:id` | Actualizar materia |
| DELETE | `/subjects/:id` | Eliminar materia |

### Horarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/subjects/:id/schedules` | Crear horario |
| GET | `/subjects/:id/schedules` | Listar horarios |
| PUT | `/subjects/:id/schedules/:scheduleId` | Actualizar horario |
| DELETE | `/subjects/:id/schedules/:scheduleId` | Eliminar horario |

### Tareas
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/subjects/:id/tasks` | Crear tarea |
| GET | `/subjects/:id/tasks` | Listar tareas |
| PUT | `/subjects/:id/tasks/:taskId` | Actualizar tarea |
| POST | `/subjects/:id/tasks/:taskId/toggle` | Alternar estado (pendiente/completada) |
| DELETE | `/subjects/:id/tasks/:taskId` | Eliminar tarea |

### Notas
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/subjects/:id/notes` | Crear nota |
| GET | `/subjects/:id/notes` | Listar notas |
| PUT | `/subjects/:id/notes/:noteId` | Actualizar nota |
| POST | `/subjects/:id/notes/:noteId/pin` | Alternar pin |
| DELETE | `/subjects/:id/notes/:noteId` | Eliminar nota |

```json
// POST /subjects — Request
{ "nombre": "Cálculo II", "codigo": "MAT201", "profesor": "Dr. García", "salon": "A-301", "creditos": 4, "color": "#3b82f6", "descripcion": "Derivadas e integrales" }

// GET /subjects — Response 200
[
  {
    "id": 1,
    "nombre": "Cálculo II",
    "codigo": "MAT201",
    "profesor": "Dr. García",
    "salon": "A-301",
    "creditos": 4,
    "color": "#3b82f6",
    "_count": { "tasks": 3, "notes": 5, "schedules": 2 }
  }
]
```

---

## Dashboard — `/dashboard` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/dashboard/summary` | Resumen completo del dashboard |

```json
// GET /dashboard/summary — Response 200
{
  "user": { "id": 1, "nombre": "Juan" },
  "stats": { "subjects": 5, "pendingTasks": 12, "completedTasks": 28, "notes": 15 },
  "gamification": { "level": 3, "xp": 1250, "totalXp": 1250, "xpForNextLevel": 2000, "streak": 7, "achievements": 4 },
  "academicRisk": { "score": 35, "level": "BAJO" },
  "upcomingClasses": [
    { "subject": "Cálculo II", "classroom": "A-301", "profesor": "Dr. García", "startTime": "08:00", "endTime": "09:30", "color": "#3b82f6" }
  ],
  "upcomingTasks": [
    { "id": 1, "title": "Tarea de integrales", "subject": "Cálculo II", "subjectColor": "#3b82f6", "subjectId": 1, "dueDate": "2026-08-10T00:00:00Z" }
  ],
  "recentNotes": [
    { "id": 1, "title": "Apuntes clase 5", "content": "...", "subject": "Cálculo II", "subjectColor": "#3b82f6" }
  ],
  "activeGoals": [
    { "title": "Completar 5 tareas esta semana", "progress": 60 }
  ],
  "completionRate": 70
}
```

---

## Gamificación — `/gamification` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/gamification/progress` | Progreso de gamificación del usuario |

```json
// Response 200
{
  "level": 3,
  "xp": 1250,
  "totalXp": 1250,
  "xpForNextLevel": 2000,
  "streak": 7,
  "bestStreak": 12,
  "achievements": [
    { "code": "FIRST_TASK", "nombre": "Primera Tarea", "icon": "🎯", "unlockedAt": "2026-07-01T10:00:00Z" }
  ]
}
```

---

## Perfil — `/profile` (JWT)

### Información personal
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/profile/personal` | Obtener info personal |
| PUT | `/profile/personal` | Actualizar info personal |

### Perfil académico
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/profile/academic` | Crear perfil académico |
| GET | `/profile/academic` | Obtener perfil académico |
| PUT | `/profile/academic` | Actualizar perfil académico |
| DELETE | `/profile/academic` | Eliminar perfil académico |

### Perfil profesional
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/profile/professional` | Crear perfil profesional |
| GET | `/profile/professional` | Obtener perfil profesional |
| PUT | `/profile/professional` | Actualizar perfil profesional |
| DELETE | `/profile/professional` | Eliminar perfil profesional |

### Skills
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/profile/skills` | Obtener skills del usuario |
| POST | `/profile/skills` | Agregar skill |
| PUT | `/profile/skills` | Actualizar nivel de skill |
| DELETE | `/profile/skills/:skillId` | Eliminar skill |

### Objetivos y Módulos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/profile/objectives` | Obtener objetivos |
| POST | `/profile/objectives` | Agregar objetivo |
| DELETE | `/profile/objectives/:objectiveId` | Eliminar objetivo |
| GET | `/profile/modules` | Obtener módulos activos |
| POST | `/profile/modules` | Activar/desactivar módulo |
| POST | `/profile/modules/defaults` | Activar módulos por defecto |

### Configuración
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/profile/notifications` | Config de notificaciones |
| PUT | `/profile/notifications` | Actualizar config de notificaciones |
| GET | `/profile/privacy` | Config de privacidad |
| PUT | `/profile/privacy` | Actualizar config de privacidad |

### Seguridad
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/profile/security/2fa/generate` | Generar secreto 2FA |
| POST | `/profile/security/2fa/verify` | Verificar y activar 2FA |
| POST | `/profile/security/2fa/disable` | Desactivar 2FA |
| GET | `/profile/security/sessions` | Sesiones activas |
| DELETE | `/profile/security/sessions/:id` | Cerrar sesión |
| GET | `/profile/security/logs` | Logs de acceso |

### Catálogos (sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/skills` | Todas las skills disponibles |
| POST | `/skills` | Crear nueva skill |
| GET | `/objectives` | Todos los objetivos disponibles |
| GET | `/modules` | Todos los módulos disponibles |

```json
// POST /profile/academic — Request
{
  "universidad": "UNAL",
  "carrera": "Ingeniería de Sistemas",
  "facultad": "Ingeniería",
  "semestreActual": 6,
  "fechaInicio": "2023-01-15",
  "fechaGraduacion": "2028-12-01",
  "modalidad": "ON_SITE",
  "promedio": 4.2,
  "materiasFav": ["Cálculo", "Algoritmos"],
  "materiasDificil": ["Física"]
}
```

---

## CV / Hoja de Vida — `/resume` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume` | Crear CV |
| GET | `/resume/me` | Obtener mi CV |
| PUT | `/resume/me` | Actualizar CV |
| GET | `/resume/public/:slug` | CV público (sin auth) |
| GET | `/resume/:userId/pdf` | Generar PDF del CV |

### Experiencia — `/resume/experience` (JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume/experience` | Agregar experiencia |
| GET | `/resume/experience` | Listar experiencias |
| GET | `/resume/experience/:id` | Detalle de experiencia |
| PUT | `/resume/experience/:id` | Actualizar experiencia |
| DELETE | `/resume/experience/:id` | Eliminar experiencia |

### Educación — `/resume/education` (JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume/education` | Agregar educación |
| GET | `/resume/education` | Listar educaciones |
| GET | `/resume/education/:id` | Detalle de educación |
| PUT | `/resume/education/:id` | Actualizar educación |
| DELETE | `/resume/education/:id` | Eliminar educación |

### Proyectos — `/resume/project` (JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume/project` | Agregar proyecto |
| GET | `/resume/project` | Listar proyectos |
| GET | `/resume/project/:id` | Detalle de proyecto |
| PUT | `/resume/project/:id` | Actualizar proyecto |
| DELETE | `/resume/project/:id` | Eliminar proyecto |

### Certificados — `/resume/certificate` (JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume/certificate` | Agregar certificado |
| GET | `/resume/certificate` | Listar certificados |
| GET | `/resume/certificate/:id` | Detalle de certificado |
| PUT | `/resume/certificate/:id` | Actualizar certificado |
| DELETE | `/resume/certificate/:id` | Eliminar certificado |

### Idiomas — `/resume/language` (JWT)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume/language` | Agregar idioma |
| GET | `/resume/language` | Listar idiomas |
| GET | `/resume/language/:id` | Detalle de idioma |
| PUT | `/resume/language/:id` | Actualizar idioma |
| DELETE | `/resume/language/:id` | Eliminar idioma |

```json
// GET /resume/me — Response 200
{
  "id": 1,
  "titulo": "Ingeniero de Sistemas",
  "resumen": "Desarrollador full stack con 2 años de experiencia...",
  "slug": "juan-perez",
  "experiences": [
    {
      "id": 1,
      "company": "TechCorp",
      "position": "Frontend Developer",
      "description": "Desarrollo de interfaces con Angular",
      "startDate": "2025-01-01",
      "endDate": null,
      "isCurrent": true
    }
  ],
  "educations": [...],
  "projects": [...],
  "certificates": [...],
  "languages": [...]
}
```

---

## Profesor IA — `/ai` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/ai/chat` | Enviar mensaje al profesor IA |
| POST | `/ai/chat/stream` | Enviar mensaje con streaming SSE |
| GET | `/ai/dashboard` | Dashboard de IA del estudiante |
| GET | `/ai/resources` | Recursos generados por IA |
| GET | `/ai/resources/:id` | Detalle de recurso |
| PATCH | `/ai/resources/:id/complete` | Marcar recurso como completado |
| DELETE | `/ai/resources/:id` | Eliminar recurso |
| POST | `/ai/goals` | Crear meta de aprendizaje |
| GET | `/ai/goals` | Listar metas |
| PATCH | `/ai/goals/:id` | Actualizar meta |
| DELETE | `/ai/goals/:id` | Eliminar meta |
| GET | `/ai/teacher-profiles` | Perfiles de profesores IA |
| POST | `/ai/teacher-profiles` | Crear perfil de profesor IA |
| PATCH | `/ai/teacher-profiles/:id` | Actualizar perfil |
| POST | `/ai/conversations` | Crear conversación |
| GET | `/ai/conversations` | Listar conversaciones |
| GET | `/ai/conversations/:id` | Detalle de conversación + mensajes |
| DELETE | `/ai/conversations/:id` | Eliminar conversación |
| GET | `/ai/knowledge-gaps` | Identificar gaps de conocimiento |
| GET | `/ai/knowledge-gaps/:subject` | Gaps por materia |
| PATCH | `/ai/knowledge-gaps/:id` | Actualizar gap |

```json
// POST /ai/chat — Request
{ "conversationId": "abc123", "message": "Explícame las integrales por partes" }

// Response 201
{
  "conversationId": "abc123",
  "message": {
    "role": "assistant",
    "content": "Las integrales por partes son una técnica que se deriva de la regla del producto..."
  }
}
```

---

## Empleos — `/jobs` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/jobs` | Buscar empleos (con filtros) |
| GET | `/jobs/saved` | Empleos guardados |
| GET | `/jobs/applications` | Mis postulaciones |
| GET | `/jobs/:id` | Detalle de empleo |
| POST | `/jobs/:id/save` | Guardar empleo |
| DELETE | `/jobs/:id/save` | Quitar empleo guardado |
| POST | `/jobs/:id/apply` | Postularse |
| DELETE | `/jobs/:id/apply` | Retirar postulación |
| PATCH | `/jobs/:id/apply/status` | Actualizar estado de postulación |
| GET | `/jobs/:id/match` | Score de match con el empleo |
| POST | `/jobs/discover` | Descubrir nuevos empleos |
| POST | `/jobs/sync` | Sincronizar empleos |

```json
// GET /jobs?page=1&limit=10&isRemote=true&seniority=JUNIOR
// Response 200
{
  "jobs": [
    {
      "id": 1,
      "title": "Frontend Developer",
      "company": "TechCorp",
      "location": "Bogotá",
      "modality": "REMOTE",
      "seniority": "JUNIOR",
      "salaryMin": 2000000,
      "salaryMax": 4000000,
      "skills": ["Angular", "TypeScript", "React"]
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 10
}
```

---

## Roadmaps — `/roadmaps` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/roadmaps/generate` | Generar roadmap con IA |
| GET | `/roadmaps` | Listar roadmaps |
| GET | `/roadmaps/:id` | Detalle de roadmap + pasos |
| PATCH | `/roadmaps/steps/:stepId/complete` | Marcar paso como completado |
| DELETE | `/roadmaps/:id` | Eliminar roadmap |

```json
// POST /roadmaps/generate — Request
{ "jobId": 1, "targetRole": "Frontend Developer", "missingSkills": ["React", "GraphQL"] }

// Response 201
{
  "id": 1,
  "title": "Frontend Developer",
  "description": "Roadmap para convertirte en Frontend Developer",
  "steps": [
    { "id": 1, "title": "Aprende React", "skill": "React", "completed": false, "order": 1 },
    { "id": 2, "title": "Domina GraphQL", "skill": "GraphQL", "completed": false, "order": 2 }
  ]
}
```

---

## Análisis de CV — `/resume-analyzer` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/resume-analyzer/analyze` | Analizar CV subido (PDF/DOCX) |
| POST | `/resume-analyzer/analyze-profile` | Analizar CV basado en perfil |

```json
// POST /resume-analyzer/analyze — multipart/form-data { file: CV.pdf }
// Response 201
{
  "score": 75,
  "atsScore": 80,
  "strengths": ["Experiencia clara", "Buen formato"],
  "weaknesses": ["Faltan métricas"],
  "missingSkills": ["Docker", "CI/CD"],
  "recommendedRoles": ["Frontend Developer", "Full Stack Developer"],
  "recommendations": ["Agrega porcentajes de impacto"]
}
```

---

## Grupos de Estudio — `/groups` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/groups` | Crear grupo |
| GET | `/groups` | Listar grupos públicos |
| GET | `/groups/my` | Mis grupos |
| GET | `/groups/recommended` | Grupos recomendados por IA |
| GET | `/groups/:id` | Detalle del grupo |
| POST | `/groups/:id/join` | Unirse al grupo |
| POST | `/groups/:id/leave` | Salir del grupo |
| POST | `/groups/:id/sessions` | Crear sesión de estudio |
| GET | `/groups/:id/sessions` | Listar sesiones |
| GET | `/groups/:id/messages` | Historial de chat |
| POST | `/groups/:id/messages/image` | Enviar imagen en el chat |

```json
// POST /groups — Request
{ "name": "Grupo de Cálculo", "description": "Estudiamos juntos los viernes", "subjectId": 1, "maxMembers": 10, "isPublic": true }

// POST /groups/:id/join — Request
{ "password": "calculo2026" }  // solo si el grupo tiene contraseña
```

---

## Notificaciones — `/notifications` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/notifications` | Listar notificaciones |
| GET | `/notifications/unread-count` | Conteo de no leídas |
| PATCH | `/notifications/:id/read` | Marcar como leída |
| PATCH | `/notifications/read-all` | Marcar todas como leídas |

```json
// GET /notifications — Response 200
[
  {
    "id": 1,
    "title": "Tarea próxima a vencer",
    "message": "La tarea de Cálculo vence mañana",
    "type": "TASK_DUE",
    "read": false,
    "createdAt": "2026-08-01T10:00:00Z"
  }
]
```

---

## Riesgo Académico — `/risk` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/risk` | Último análisis de riesgo |
| GET | `/risk/history` | Historial de análisis |
| GET | `/risk/subjects` | Riesgo por materia |
| GET | `/risk/subjects/:subjectId` | Riesgo de materia específica |
| POST | `/risk/recalculate` | Recalcular riesgo |

```json
// GET /risk — Response 200
{
  "id": 1,
  "score": 35,
  "level": "BAJO",
  "reasons": {
    "knowledgeGaps": ["Álgebra Lineal", "Probabilidad"],
    "overdueTasks": 2,
    "confidenceIA": 70,
    "roadmaps": 1,
    "engagement": 85
  },
  "createdAt": "2026-08-01T10:00:00Z"
}
```

---

## Temporizador de Estudio — `/study-timer` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/study-timer/session` | Registrar sesión de estudio |
| GET | `/study-timer/stats` | Estadísticas semanales |

```json
// POST /study-timer/session — Request
{ "subjectId": 1, "durationMinutes": 25, "technique": "POMODORO_25_5" }

// Response 201
{ "xpEarned": 25, "totalXp": 1275 }

// GET /study-timer/stats — Response 200
{
  "weeklyHours": [
    { "day": "Lun", "minutes": 120 },
    { "day": "Mar", "minutes": 90 }
  ],
  "totalMinutes": 540
}
```

---

## Agenda / Calendario — `/calendar` (JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/calendar/events` | Obtener eventos en rango de fechas |
| GET | `/calendar/exams/upcoming` | Próximos exámenes (30 días) |
| POST | `/calendar/events` | Crear evento |
| PATCH | `/calendar/events/:id` | Editar evento |
| DELETE | `/calendar/events/:id` | Eliminar evento |
| GET | `/calendar/google/connect` | URL de conexión con Google Calendar |
| GET | `/calendar/google/callback` | Callback de Google Calendar OAuth |
| POST | `/calendar/google/sync` | Sincronizar desde Google Calendar |
| DELETE | `/calendar/google/disconnect` | Desconectar Google Calendar |
| GET | `/calendar/google/status` | Estado de conexión con Google Calendar |

```json
// GET /calendar/events?start=2026-08-01T00:00:00Z&end=2026-08-31T23:59:59Z
// Response 200
{
  "events": [
    {
      "id": 1,
      "title": "Examen de Cálculo",
      "description": "Capítulos 5-8",
      "startAt": "2026-08-15T08:00:00Z",
      "endAt": "2026-08-15T10:00:00Z",
      "allDay": false,
      "color": "#ef4444",
      "type": "EXAM",
      "subject": { "id": 1, "nombre": "Cálculo II", "color": "#3b82f6" }
    }
  ],
  "tasks": [
    {
      "id": "task-5",
      "title": "Tarea de integrales",
      "startAt": "2026-08-10T00:00:00Z",
      "type": "TASK",
      "subject": { "id": 1, "nombre": "Cálculo II", "color": "#3b82f6" }
    }
  ]
}

// POST /calendar/events — Request
{
  "title": "Examen de Cálculo",
  "description": "Capítulos 5-8",
  "startAt": "2026-08-15T08:00:00.000Z",
  "endAt": "2026-08-15T10:00:00.000Z",
  "allDay": false,
  "color": "#ef4444",
  "type": "EXAM",
  "subjectId": 1
}

// GET /calendar/exams/upcoming — Response 200
[
  {
    "id": 1,
    "title": "Examen de Cálculo",
    "startAt": "2026-08-15T08:00:00Z",
    "type": "EXAM",
    "subject": { "id": 1, "nombre": "Cálculo II", "color": "#3b82f6" }
  }
]

// GET /calendar/google/status — Response 200
{ "connected": true }

// GET /calendar/google/connect — Response 200
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

---

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth |
| `GOOGLE_CALLBACK_URL` | URL de callback para login con Google |
| `GOOGLE_CALENDAR_REDIRECT_URI` | URL de callback para Google Calendar |
| `BACKEND_URL` | URL base del backend |
| `FRONTEND_URL` | URL del frontend |
| `SMTP_HOST` | Host del servidor SMTP |
| `SMTP_PORT` | Puerto SMTP |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `SMTP_FROM` | Email remitente |
| `MONGODB_URI` | URI de MongoDB (para IA) |
| `MONGODB_DB` | Nombre de la BD de MongoDB |
| `GROQ_API_KEY` | API Key de Groq (para IA) |
| `GROQ_MODEL` | Modelo de Groq |
| `CLOUDINARY_CLOUD_NAME` | Cloud name de Cloudinary |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary |
| `PORT` | Puerto del servidor (default: 3000) |
