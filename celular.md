# StudyHub Mobile — Endpoints esenciales para IA

> **Backend:** `https://study-hub-backend-sigma.vercel.app`  
> **Swagger:** `https://study-hub-backend-sigma.vercel.app/api`  
> **Guía completa:** [`celulad.md`](./celulad.md)

Pega este archivo como contexto para que una IA construya la app móvil. Contiene
solo el MVP: autenticación, materias, apuntes, IA de estudio, perfil, avatar,
temporizador, agenda y notificaciones. **No inventes endpoints fuera de esta
lista.**

---

## 1. Reglas

- Usa `API_BASE_URL` como única base y un cliente HTTP central.
- Guarda el JWT en SecureStore/Keychain; nunca en AsyncStorage plano.
- Envía `Authorization: Bearer <access_token>` en las rutas **JWT**.
- El token dura **7 días** y no hay refresh token: ante un 401, vuelve al login.
- IDs de Postgres: números. IDs de MongoDB: strings de 24 hex.
- Fechas: ISO 8601 (`2026-11-01T23:59:00.000Z`).
- No implementes push, refresh, 2FA ni WebSockets: no están listos.
- Muestra estados de carga, vacío y error en cada pantalla.

---

## 2. Convenciones

| Tema | Regla |
|---|---|
| JSON | `Content-Type: application/json` |
| Archivos | `multipart/form-data` |
| Auth | `Authorization: Bearer <access_token>` |
| Error | `{ "statusCode": 400, "message": "...", "error": "Bad Request" }` |
| Validación | `message` puede ser un array |
| 401 | Token ausente, inválido o expirado |
| 403 | El recurso no pertenece al usuario |
| 413 | Archivo o trozo demasiado grande |
| 415 | Imagen con formato no soportado |
| 429 | Límite de IA; espera y reintenta |

Las fotos se devuelven como ruta relativa:

```json
{ "foto": "/media/avatars/64f1a2b3c4d5e6f789012345?v=ab12cd34ef" }
```

```ts
const avatarUrl = foto?.startsWith('/') ? `${API_BASE_URL}${foto}` : foto;
```

---

## 3. Autenticación

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| POST | `/auth/register` | No | Crear cuenta |
| POST | `/auth/login` | No | Iniciar sesión |
| POST | `/auth/verify-email` | No | Verificar código de 6 dígitos |
| POST | `/auth/resend-code` | No | Reenviar código |
| POST | `/auth/forgot-password` | No | Solicitar recuperación |
| POST | `/auth/reset-password` | No | Cambiar contraseña |
| POST | `/auth/logout` | JWT | Cerrar sesión |

### Registro

```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@mail.com",
  "password": "123456",
  "confirmPassword": "123456"
}
```

### Login

```json
{ "email": "juan@mail.com", "password": "123456" }
```

Ambos devuelven:

```json
{
  "access_token": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@mail.com",
    "foto": null
  }
}
```

### Verificación y recuperación

```json
// POST /auth/verify-email
{ "email": "juan@mail.com", "code": "123456" }

// POST /auth/resend-code
{ "email": "juan@mail.com" }

// POST /auth/forgot-password
{ "email": "juan@mail.com" }

// POST /auth/reset-password
{ "token": "uuid-del-correo", "password": "nueva123" }
```

El correo de recuperación apunta al frontend web. No inventes un deep link móvil.

---

## 4. Pantallas del MVP

| Pantalla | Endpoints |
|---|---|
| Sesión | `GET /profile/personal` |
| Login / registro | `POST /auth/login`, `POST /auth/register` |
| Verificar correo | `POST /auth/verify-email`, `POST /auth/resend-code` |
| Inicio | `GET /dashboard/summary` |
| Materias | `GET /subjects`, `POST /subjects`, `GET /subjects/:id` |
| Tareas | `POST/GET /subjects/:id/tasks`, `PUT/DELETE /subjects/:id/tasks/:taskId`, `POST /subjects/:id/tasks/:taskId/toggle` |
| Apuntes | `POST/GET /subjects/:id/notes`, `PUT/DELETE /subjects/:id/notes/:noteId`, `POST /subjects/:id/notes/:noteId/pin` |
| Editor + IA | `POST /subjects/:id/notes/assistant`, autosave con `PUT` |
| Flashcards | `POST /ai/flashcards`, `GET /ai/flashcards`, `DELETE /ai/resources/:id` |
| Simulacros | `POST /ai/resources/quiz?origin=SIMULACRO`, `GET /ai/resources?scope=simulacro`, `GET /ai/resources/:id`, `PATCH /ai/resources/:id/complete` |
| Profesor IA | `POST /ai/chat` o `/ai/chat/stream`, `GET /ai/conversations`, `GET /ai/conversations/:id` |
| Perfil | `GET/PUT /profile/personal`, `GET/PUT /profile/academic`, `GET/PUT /profile/professional` |
| Foto de perfil | `POST /media/images/chunk` → `POST /media/images/:uploadId/complete`, `DELETE /media/avatar` |
| Temporizador | `POST /study-timer/session`, `GET /study-timer/stats`, `GET /study-timer/sessions` |
| Agenda | `GET /calendar/events`, `GET /calendar/exams/upcoming`, `POST/PATCH/DELETE /calendar/events` |
| Notificaciones | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |

**Prioridad:** auth y perfil → materias, tareas y apuntes → IA de estudio →
temporizador, agenda y notificaciones.

---

## 5. Dashboard

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/dashboard/summary` | Resumen completo del inicio |
| GET | `/gamification/progress` | Nivel, XP, racha y logros |

`GET /dashboard/summary` ya incluye estadísticas, gamificación, riesgo, clases de
hoy, tareas pendientes, notas recientes, metas y `completionRate`. Úsalo como
fuente principal de la pantalla de inicio.

---

## 6. Materias, horarios, tareas y apuntes

| Método | Ruta | Uso |
|---|---|---|
| POST | `/subjects` | Crear materia |
| GET | `/subjects` | Listar materias con `_count` |
| GET | `/subjects/:id` | Detalle con horarios, tareas y notas |
| PUT | `/subjects/:id` | Editar materia |
| DELETE | `/subjects/:id` | Eliminar materia |
| POST | `/subjects/:id/schedules` | Crear horario |
| GET | `/subjects/:id/schedules` | Listar horarios |
| PUT | `/subjects/:id/schedules/:scheduleId` | Editar horario |
| DELETE | `/subjects/:id/schedules/:scheduleId` | Eliminar horario |
| POST | `/subjects/:id/tasks` | Crear tarea |
| GET | `/subjects/:id/tasks` | Listar tareas |
| PUT | `/subjects/:id/tasks/:taskId` | Editar tarea |
| POST | `/subjects/:id/tasks/:taskId/toggle` | Alternar completada |
| DELETE | `/subjects/:id/tasks/:taskId` | Eliminar tarea |
| POST | `/subjects/:id/notes` | Crear apunte |
| GET | `/subjects/:id/notes` | Listar apuntes |
| PUT | `/subjects/:id/notes/:noteId` | Actualizar apunte |
| POST | `/subjects/:id/notes/:noteId/pin` | Fijar/desfijar |
| DELETE | `/subjects/:id/notes/:noteId` | Eliminar apunte |
| POST | `/subjects/:id/notes/assistant` | Propuesta de IA |

### Materia

```json
{
  "nombre": "Cálculo II",
  "codigo": "MAT201",
  "profesor": "Dr. García",
  "salon": "A-301",
  "creditos": 4,
  "color": "#3b82f6",
  "descripcion": "Derivadas e integrales"
}
```

`nombre` y `color` son obligatorios.

### Horario

```json
{
  "dayOfWeek": 1,
  "startTime": "08:00",
  "endTime": "10:00",
  "classroom": "Aula 204"
}
```

`dayOfWeek`: 0 = domingo, 1 = lunes, …, 6 = sábado.

### Tarea

```json
{
  "title": "Resolver taller de límites",
  "description": "Ejercicios 1 al 10",
  "priority": "HIGH",
  "dueDate": "2026-11-01T23:59:00.000Z"
}
```

Prioridades: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.

### Apunte

```json
{
  "title": "Límites y continuidad",
  "content": "## Idea general\nUna función es continua si...",
  "isPinned": false
}
```

El editor debe guardar con debounce (800–1200 ms) usando `PUT` y mostrar
“Guardando…” / “Guardado”.

### Asistente de apuntes

```http
POST /subjects/:id/notes/assistant
Content-Type: application/json

{
  "action": "improve",
  "title": "Límites y continuidad",
  "content": "## Idea general\nUna función es continua si...",
  "instruction": "Incluye un ejemplo con límites laterales"
}
```

| `action` | Uso | Requisito |
|---|---|---|
| `draft` | Crear desde cero | `title` o `instruction` |
| `continue` | Continuar el texto | `content` ≥ 40 caracteres |
| `improve` | Reescribir y ordenar | `content` ≥ 40 caracteres |
| `summarize` | Resumen con autoevaluación | `content` ≥ 40 caracteres |
| `outline` | Esquema jerárquico | `content` ≥ 40 caracteres |

Respuesta:

```json
{ "proposal": "## ...", "action": "improve", "model": "..." }
```

No se guarda sola. Muestra la propuesta y, si el usuario acepta, haz `PUT` del
apunte. El texto viene en Markdown con LaTeX (`$...$`).

---

## 7. Flashcards y simulacros desde un apunte

El backend acepta el contenido del apunte en `material`.

### Flashcards desde una nota

```http
POST /ai/flashcards

{
  "topic": "Límites y continuidad",
  "subject": "Cálculo II",
  "count": 12,
  "material": "<contenido del apunte en Markdown>"
}
```

Respuesta:

```json
{
  "flashcards": [
    {
      "id": "64f1a2b3c4d5e6f789012345",
      "question": "¿Qué significa que una función sea continua?",
      "answer": "...",
      "hint": "...",
      "topic": "Límites y continuidad",
      "subject": "Cálculo II"
    }
  ]
}
```

| Método | Ruta | Uso |
|---|---|---|
| GET | `/ai/flashcards?limit=100` | Listar tarjetas |
| DELETE | `/ai/resources/:id` | Borrar tarjeta o recurso |

No hay repaso espaciado; el estado “estudiada” es local.

### Simulacro desde una nota

```http
POST /ai/resources/quiz?origin=SIMULACRO

{
  "topic": "Límites y continuidad",
  "difficulty": "INTERMEDIATE",
  "count": 10,
  "material": "<contenido del apunte>"
}
```

Respuesta:

```json
{
  "resource": {
    "id": "64f1a2b3c4d5e6f789012345",
    "title": "Simulacro de límites",
    "type": "QUIZ",
    "trigger": "SIMULACRO_TAB",
    "content": {
      "quiz": [
        {
          "question": "¿Cuál es el límite de ...?",
          "choices": ["...", "...", "...", "..."],
          "answer": "...",
          "explanation": "...",
          "difficulty": "medium"
        }
      ]
    }
  }
}
```

`origin=SIMULACRO` separa el simulacro de un quiz normal. Para un quiz usa
`origin=QUIZ` o llama sin `origin`.

Listar y abrir:

| Llamada | Resultado |
|---|---|
| `GET /ai/resources?scope=simulacro` | Solo simulacros |
| `GET /ai/resources?scope=quiz` | Quizzes y demás recursos |
| `GET /ai/resources?type=QUIZ` | Recursos tipo quiz |
| `GET /ai/resources/:id` | Recurso con `content` completo |

La lista no incluye `content`; pide el detalle antes de iniciar.

Al terminar el simulacro:

```http
PATCH /ai/resources/:id/complete

{ "resultScore": 0.8, "resultCorrect": 8, "resultTotal": 10 }
```

`resultScore` va de 0 a 1. El tiempo lo controla la app; el backend no lo impone.

---

## 8. Profesor IA

| Método | Ruta | Uso |
|---|---|---|
| POST | `/ai/chat` | Mensaje normal |
| POST | `/ai/chat/stream` | Streaming SSE |
| GET | `/ai/conversations?page=1&limit=20` | Listar conversaciones |
| POST | `/ai/conversations` | Crear conversación vacía |
| GET | `/ai/conversations/:id` | Conversación + mensajes |
| DELETE | `/ai/conversations/:id` | Eliminar conversación |

Chat:

```json
{
  "message": "Explícame la regla de la cadena",
  "conversationId": "64f1a2b3c4d5e6f789012345",
  "teacherId": "default-teacher"
}
```

`conversationId` y `teacherId` son opcionales. Respuesta:

```json
{ "conversationId": "64f1a2b3c4d5e6f789012345", "reply": "..." }
```

El campo es `reply`, no `message.content`.

Streaming:

```text
event: message
data: "Las funciones..."

event: done
data: {"conversationId":"64f1a2b3c4d5e6f789012345"}
```

`data` de `message` es un string JSON; haz `JSON.parse` para obtener el texto.
Si el cliente no soporta streaming, usa `POST /ai/chat`.

### Foto de un ejercicio (opcional)

```http
POST /ai/images/content
Content-Type: multipart/form-data

image: <foto, máx. 6 MB>
```

Devuelve `{ fase: 1, contenido, meta }`. Luego:

```http
POST /ai/chat/image

{
  "contenido": { "...": "..." },
  "message": "Explícame el ejercicio 3"
}
```

Respuesta: `{ conversationId, reply, imageAnalysis }`.

---

## 9. Documentos para IA (PDF/DOCX/TXT)

Los documentos se usan para extraer texto y se borran al generar el material.

| Método | Ruta | Uso |
|---|---|---|
| POST | `/ai/uploads/chunk` | Subir un trozo de 3 MB |
| DELETE | `/ai/uploads/:id` | Cancelar subida |
| POST | `/ai/flashcards/file` | Flashcards desde el documento |
| POST | `/ai/resources/quiz/file` | Quiz/simulacro desde el documento |

Subir:

```http
POST /ai/uploads/chunk?index=0&total=3&filename=apuntes.pdf&mimetype=application/pdf
Content-Type: multipart/form-data

file: <trozo>
```

En los siguientes trozos agrega `uploadId`:

```http
POST /ai/uploads/chunk?uploadId=64f1...&index=1&total=3
```

Respuesta:

```json
{
  "uploadId": "64f1a2b3c4d5e6f789012345",
  "received": 1,
  "total": 3,
  "chunkSize": 3145728,
  "complete": false
}
```

No hay endpoint `complete`. Pasa `uploadId` directamente:

```http
POST /ai/flashcards/file?uploadId=64f1...&count=12&topic=Límites
POST /ai/resources/quiz/file?uploadId=64f1...&origin=SIMULACRO&count=10
```

Esas llamadas unen los trozos, extraen el texto, generan el material y borran la
subida. Usa trozos de **3 MB**; máximo 200 trozos. No subas un PDF completo en una
petición: Vercel corta el cuerpo alrededor de 4,5 MB.

---

## 10. Perfil y avatar

| Método | Ruta | Uso |
|---|---|---|
| GET | `/profile/personal` | Usuario completo con `foto` y `progress` |
| PUT | `/profile/personal` | Editar datos personales |
| POST/GET/PUT/DELETE | `/profile/academic` | Perfil académico |
| POST/GET/PUT/DELETE | `/profile/professional` | Perfil profesional |
| GET | `/profile/skills` | Skills del usuario |
| POST/PUT | `/profile/skills` | Agregar/actualizar skill |
| DELETE | `/profile/skills/:skillId` | Quitar skill |
| GET | `/profile/objectives` | Objetivos del usuario |
| POST | `/profile/objectives` | Agregar objetivo |
| DELETE | `/profile/objectives/:objectiveId` | Quitar objetivo |
| GET/PUT | `/profile/notifications` | Preferencias de notificaciones |
| GET/PUT | `/profile/privacy` | Privacidad |

`PUT /profile/personal` acepta `nombre`, `apellido`, `banner`, `ciudad`, `pais`,
`fechaNacimiento`, `biografia`, `github`, `linkedin`, `portafolio`,
`paginaPersonal`.

**No envíes `foto` en `PUT /profile/personal`**: el backend rechaza campos no
permitidos con 400. La foto se cambia solo con el pipeline de medios.

Cuerpos del perfil:

```json
// POST/PUT /profile/academic
{
  "universidad": "UNAL",
  "carrera": "Ingeniería de Sistemas",
  "facultad": "Ingeniería",
  "semestreActual": 6,
  "fechaInicio": "2023-01-15",
  "fechaGraduacion": "2028-12-01",
  "modalidad": "ON_SITE",
  "promedio": 4.2,
  "materiasFav": ["Cálculo"],
  "materiasDificil": ["Física"]
}

// POST/PUT /profile/professional
{
  "cargoDeseado": "Desarrollador Backend",
  "nivelActual": "JUNIOR",
  "disponibilidad": "FULL_TIME",
  "modalidadDeseada": "REMOTE"
}

// POST /profile/skills y PUT /profile/skills
{ "skillId": 1, "nivel": "INTERMEDIATE" }

// POST /profile/objectives
{ "objectiveId": 1 }
```

Notificaciones: `emailEnabled`, `pushEnabled`, `remindersEnabled`. Privacidad:
`publicProfile`, `showSkills`, `showCV`.

### Foto de perfil en MongoDB

La imagen no se guarda como URL: se sube por trozos, se guarda como bytes en
MongoDB y se devuelve una ruta relativa.

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| POST | `/media/images/chunk` | JWT | Subir trozo |
| POST | `/media/images/:uploadId/complete` | JWT | Unir, validar y guardar |
| DELETE | `/media/images/:uploadId` | JWT | Cancelar subida |
| DELETE | `/media/avatar` | JWT | Borrar avatar |
| GET | `/media/avatars/:id?v=hash` | No | Servir imagen |

Flujo:

1. Elegir JPG, PNG o WebP.
2. Recortar a cuadrado y comprimir localmente (320–512 px, WebP/JPEG ~0.82).
3. Partir en trozos de **480 KB** (máximo del backend: 512 KB).
4. `POST /media/images/chunk` sin `uploadId` para el trozo 0.
5. Repetir con `uploadId` para los siguientes.
6. `POST /media/images/:uploadId/complete`.
7. Actualizar `user.foto`.

```http
POST /media/images/chunk?index=0&total=1&kind=avatar
Content-Type: multipart/form-data

file: avatar.part
```

Respuesta:

```json
{
  "uploadId": "64f1a2b3c4d5e6f789012345",
  "received": 1,
  "total": 1,
  "complete": true,
  "chunkBytes": 524288
}
```

Completar:

```http
POST /media/images/64f1a2b3c4d5e6f789012345/complete
```

Respuesta:

```json
{
  "foto": "/media/avatars/64f1a2b3c4d5e6f789012345?v=ab12cd34ef",
  "bytes": 28431,
  "mime": "image/webp",
  "width": 320,
  "height": 320,
  "chunks": 1,
  "deduped": false
}
```

Límites: máximo 8 trozos, imagen final ≤ 2 MB, dimensiones ≤ 2048 × 2048 px. No
fijes el `Content-Type` del FormData; deja que el cliente ponga el boundary. El
campo del archivo es siempre `file`.

Si el usuario cancela, `DELETE /media/images/:uploadId`. El backend también limpia
subidas abandonadas a los 30 minutos.

---

## 11. Temporizador de estudio

| Método | Ruta | Cuerpo / query |
|---|---|---|
| POST | `/study-timer/session` | `subjectId?`, `durationMinutes`, `technique` |
| GET | `/study-timer/stats` | — |
| GET | `/study-timer/sessions` | `period=day\|week\|month\|all`, `page`, `limit` |
| DELETE | `/study-timer/sessions` | — |

```json
{
  "subjectId": 1,
  "durationMinutes": 25,
  "technique": "POMODORO_25_5"
}
```

Respuesta:

```json
{ "success": true, "session": { "...": "..." }, "xpEarned": 10 }
```

Técnicas con XP fijo: `POMODORO_25_5` (10 XP), `POMODORO_50_10` (25 XP),
`DEEP_BLOCK_90` (50 XP).

`GET /study-timer/stats` devuelve solo `{ "totalHours": "3.5" }`. Para un gráfico
por día, calcula desde `GET /study-timer/sessions?period=week`.

---

## 12. Agenda

| Método | Ruta | Uso |
|---|---|---|
| GET | `/calendar/events?start=...&end=...` | Eventos y tareas del rango |
| GET | `/calendar/exams/upcoming` | Próximos exámenes (30 días) |
| POST | `/calendar/events` | Crear evento |
| PATCH | `/calendar/events/:id` | Editar evento |
| DELETE | `/calendar/events/:id` | Eliminar evento |

Crear evento:

```json
{
  "title": "Examen de Cálculo",
  "description": "Capítulos 5-8",
  "startAt": "2026-11-15T08:00:00.000Z",
  "endAt": "2026-11-15T10:00:00.000Z",
  "allDay": false,
  "color": "#ef4444",
  "type": "EXAM",
  "subjectId": 1
}
```

`type`: `EVENT` o `EXAM`. `subjectId` es opcional. `GET /calendar/events` devuelve
`{ events, tasks }`.

La conexión con Google Calendar no está lista para móvil: el callback redirige al
frontend web.

---

## 13. Notificaciones

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/notifications?page=1&limit=50` | `{ notifications, total, unreadCount, page, limit }` |
| GET | `/notifications/unread-count` | **Número** (no objeto) |
| PATCH | `/notifications/:id/read` | Notificación actualizada |
| PATCH | `/notifications/read-all` | Confirmación |

`GET /notifications/unread-count` devuelve, por ejemplo, `3`, no `{ "count": 3 }`.
No hay push remoto ni registro de token de dispositivo.

---

## 14. Grupos (opcional)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/groups?page=1&limit=20` | Grupos públicos |
| GET | `/groups/my` | Mis grupos |
| GET | `/groups/:id` | Detalle |
| POST | `/groups` | Crear grupo |
| POST | `/groups/:id/join` | Unirse (`password` si es privado) |
| POST | `/groups/:id/leave` | Salir |
| GET | `/groups/:id/messages` | Historial de chat |
| POST | `/groups/:id/messages` | Enviar texto (`content`, máximo 2000) |

No uses Socket.IO en producción: Vercel no mantiene WebSockets. Haz polling de
`GET /groups/:id/messages` cada 5–8 segundos mientras la pantalla esté abierta.

---

## 15. Errores y límites

- **GET:** reintenta una vez con backoff corto en red o 5xx.
- **POST/PUT/DELETE:** no reintentes a ciegas; muestra “Reintentar”.
- **429 de IA:** espera 10–30 segundos; no lances generaciones en paralelo.
- **401:** borra el token y vuelve al login.
- **413:** reduce el trozo o comprime más la imagen.
- **415:** pide JPG, PNG o WebP.
- **Timeout:** 15 s para CRUD; 60–120 s para IA.
- Desactiva el botón mientras hay una petición en curso.

---

## 16. Pendientes: no implementar todavía

| Tema | Estado |
|---|---|
| Refresh token | No existe; JWT de 7 días |
| Login con Google en móvil | Callback redirige al frontend web |
| Recuperación con deep link | El correo apunta al frontend web |
| Push remoto | Solo preferencia; sin token ni envío |
| 2FA | Endpoints placeholder; no validan TOTP |
| WebSockets | Vercel no los mantiene; usar polling |
| Banner de perfil | Sigue siendo URL externa |
| Imágenes del chat de grupos | Cloudinary, no MongoDB |
| Offline | Sin sincronización ni cola de escrituras |
| Repaso espaciado | Sin endpoint; estado local |

---

## 17. Referencia rápida

```text
POST   /auth/register
POST   /auth/login
POST   /auth/verify-email
POST   /auth/resend-code
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/logout

GET    /profile/personal
PUT    /profile/personal
GET    /profile/academic
POST   /profile/academic
PUT    /profile/academic
DELETE /profile/academic
GET    /profile/professional
POST   /profile/professional
PUT    /profile/professional
DELETE /profile/professional
GET    /profile/skills
POST   /profile/skills
PUT    /profile/skills
DELETE /profile/skills/:skillId
GET    /profile/objectives
POST   /profile/objectives
DELETE /profile/objectives/:objectiveId
GET    /profile/notifications
PUT    /profile/notifications
GET    /profile/privacy
PUT    /profile/privacy

GET    /dashboard/summary
GET    /gamification/progress

GET    /subjects
POST   /subjects
GET    /subjects/:id
PUT    /subjects/:id
DELETE /subjects/:id
POST   /subjects/:id/schedules
GET    /subjects/:id/schedules
PUT    /subjects/:id/schedules/:scheduleId
DELETE /subjects/:id/schedules/:scheduleId
POST   /subjects/:id/tasks
GET    /subjects/:id/tasks
PUT    /subjects/:id/tasks/:taskId
POST   /subjects/:id/tasks/:taskId/toggle
DELETE /subjects/:id/tasks/:taskId
POST   /subjects/:id/notes
GET    /subjects/:id/notes
PUT    /subjects/:id/notes/:noteId
POST   /subjects/:id/notes/:noteId/pin
DELETE /subjects/:id/notes/:noteId
POST   /subjects/:id/notes/assistant

POST   /ai/chat
POST   /ai/chat/stream
GET    /ai/conversations
POST   /ai/conversations
GET    /ai/conversations/:id
DELETE /ai/conversations/:id
POST   /ai/images/content
POST   /ai/chat/image
POST   /ai/flashcards
GET    /ai/flashcards
POST   /ai/flashcards/file
POST   /ai/resources/quiz
POST   /ai/resources/quiz/file
GET    /ai/resources
GET    /ai/resources/:id
PATCH  /ai/resources/:id/complete
DELETE /ai/resources/:id
POST   /ai/uploads/chunk
DELETE /ai/uploads/:id

POST   /media/images/chunk
POST   /media/images/:uploadId/complete
DELETE /media/images/:uploadId
DELETE /media/avatar
GET    /media/avatars/:id

POST   /study-timer/session
GET    /study-timer/stats
GET    /study-timer/sessions
DELETE /study-timer/sessions

GET    /calendar/events
GET    /calendar/exams/upcoming
POST   /calendar/events
PATCH  /calendar/events/:id
DELETE /calendar/events/:id

GET    /notifications
GET    /notifications/unread-count
PATCH  /notifications/:id/read
PATCH  /notifications/read-all

GET    /groups
GET    /groups/my
GET    /groups/:id
POST   /groups
POST   /groups/:id/join
POST   /groups/:id/leave
GET    /groups/:id/messages
POST   /groups/:id/messages
```
