# StudyHub Mobile — Qué endpoints debe usar la app de celular

> **Backend de producción:** `https://study-hub-backend-sigma.vercel.app`  
> **Swagger interactivo:** `https://study-hub-backend-sigma.vercel.app/api`  
> **Última revisión:** 25 de octubre de 2026

Este documento es la guía de integración para la app móvil. No es una copia
completa de la API: prioriza lo que la app debe consumir, en qué pantalla va cada
llamada y qué decisiones hay que tomar en el cliente.

La app móvil **no necesita endpoints nuevos**: el backend ya expone autenticación,
materias, apuntes, asistente de IA, flashcards, simulacros, temporizador, agenda,
grupos, notificaciones y el pipeline de imágenes de perfil. Lo que falta es
exclusivamente del lado móvil (deep links, push, caché offline).

---

## 1. Configuración de la app

### Variable de entorno

```env
# Una sola URL para toda la app.
API_BASE_URL=https://study-hub-backend-sigma.vercel.app
```

En Expo se puede exponer como `EXPO_PUBLIC_API_URL`; en React Native puro, con
react-native-config o el mecanismo que ya use el proyecto. **No escribas la URL
del backend dispersa en las pantallas**: usa un único cliente HTTP.

### Backend local

| Entorno | URL |
|---|---|
| Emulador Android | `http://10.0.2.2:3000` |
| Simulador iOS | `http://localhost:3000` |
| Teléfono físico en la misma red | `http://IP_DE_TU_PC:3000` |

Para producción usa siempre HTTPS. El backend permite CORS `*`, pero una app
nativa no está sujeta a CORS: el problema real es la URL y la red.

### Rutas de archivos

Las fotos nuevas se devuelven como ruta relativa:

```json
{ "foto": "/media/avatars/64f1a2b3c4d5e6f789012345?v=ab12cd34ef" }
```

El cliente debe resolverla así:

```ts
const imageUrl = foto?.startsWith('/') ? `${API_BASE_URL}${foto}` : foto;
```

Guarda `foto` tal como llega (ruta relativa) para no atar los datos a un dominio.
Si `foto` ya es una URL absoluta (cuentas antiguas), úsala tal cual: el backend
mantiene compatibilidad con ese formato.

---

## 2. Contrato general de la API

| Tema | Regla |
|---|---|
| Formato | JSON UTF-8, excepto subidas `multipart/form-data` |
| Autenticación | `Authorization: Bearer <access_token>` |
| Token | JWT con `sub` (id numérico) y `email`; expira en **7 días** |
| Refresh token | **No existe**; al recibir 401 hay que volver al login |
| IDs de Postgres | Números (`1`, `42`) |
| IDs de MongoDB | Strings hexadecimales de 24 caracteres (`64f1...`) |
| Fechas | ISO 8601 (`2026-10-25T14:30:00.000Z`) |
| Zona horaria | Enviar y mostrar fechas en la zona del dispositivo; el backend guarda UTC |
| Paginación | `page` (desde 1) y `limit`; revisar el máximo de cada módulo |
| Errores | `{ statusCode, message, error }`; `message` puede ser un array en validaciones |
| Swagger | `/api` (solo para desarrollo y pruebas manuales) |

### Manejo de errores recomendado

| Código | Qué hacer en la app |
|---|---|
| 400 | Mostrar el mensaje de validación; no reintentar automáticamente |
| 401 | Borrar token y volver a login |
| 403 | El recurso no pertenece al usuario; volver atrás |
| 404 | El recurso se eliminó o no existe; refrescar la lista |
| 409 | Conflicto (por ejemplo, correo ya registrado o perfil académico duplicado) |
| 413 | El trozo o archivo es demasiado grande; reducir calidad o tamaño |
| 415 | Formato no soportado; pedir otra imagen/documento |
| 429 | Demasiadas solicitudes o límite de IA; esperar y reintentar con backoff |
| 500 | Error interno; reintentar una vez y reportar |
| 503 | Servicio temporalmente caído (IA, base de datos); reintentar con backoff |

Para los `POST` de IA no hagas reintentos automáticos agresivos: cada intento
consume cuota y puede tardar. Muestra un botón de “Reintentar”.

---

## 3. Autenticación

### 3.1 Registro e inicio de sesión

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| POST | `/auth/register` | No | Crear cuenta |
| POST | `/auth/login` | No | Iniciar sesión |
| POST | `/auth/verify-email` | No | Verificar correo con código de 6 dígitos |
| POST | `/auth/resend-code` | No | Reenviar código |
| POST | `/auth/forgot-password` | No | Solicitar enlace de recuperación |
| POST | `/auth/reset-password` | No | Cambiar contraseña con token |
| POST | `/auth/logout` | JWT | Cerrar sesión (el JWT es stateless) |
| GET | `/auth/google` | No | Iniciar OAuth con Google (navegador) |
| GET | `/auth/google/callback` | No | Callback de Google (redirige al frontend web) |

**Registro**

```json
{
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@mail.com",
  "password": "123456",
  "confirmPassword": "123456"
}
```

**Login**

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

Guarda el token en **SecureStore/Keychain**, nunca en AsyncStorage plano ni en
logs. El objeto `user` es solo una caché: al abrir la app con token, refresca con
`GET /profile/personal`.

**Verificación de correo**

```json
{ "email": "juan@mail.com", "code": "123456" }
```

**Recuperación de contraseña**

```json
{ "email": "juan@mail.com" }
```

El correo genera un enlace a `FRONTEND_URL/reset-password?token=...` (web). Para
que la app móvil lo abra directamente hace falta un deep link acordado con el
backend; hasta entonces, la app puede pedir el token manualmente o abrir el
enlace web. Este es un pendiente de integración, no un endpoint faltante.

### 3.2 Google

`GET /auth/google` inicia el flujo en un navegador. El callback termina en:

```text
{FRONTEND_URL}/auth/callback?token=...&user=...
```

Es decir, **hoy regresa al frontend web**, no a un esquema móvil. Si la app va a
tener “Continuar con Google”, hay que acordar un deep link (`studyhub://auth/callback`)
y ajustar el callback del backend. No inventes un callback distinto desde el
cliente.

### 3.3 Logout

`POST /auth/logout` devuelve un mensaje, pero el JWT sigue siendo válido hasta su
expiración. El logout real en la app es:

1. Borrar el token de SecureStore.
2. Limpiar el estado del usuario.
3. Navegar al login.

No prometas “cerrar sesión en todos los dispositivos” si no se implementó
revocación de tokens.

---

## 4. Mapa de pantallas → endpoints

Esta es la lista que debería estar en el README o en el backlog de la app.

| Pantalla | Llamadas principales |
|---|---|
| Splash / sesión | `GET /profile/personal` si hay token |
| Login | `POST /auth/login` |
| Registro | `POST /auth/register` → `POST /auth/verify-email` |
| Verificar correo | `POST /auth/verify-email`, `POST /auth/resend-code` |
| Recuperar contraseña | `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Inicio / dashboard | `GET /dashboard/summary`, `GET /gamification/progress`, `GET /notifications/unread-count` |
| Ranking | `GET /dashboard/leaderboard` |
| Materias | `GET /subjects`, `POST /subjects` |
| Detalle de materia | `GET /subjects/:id` (incluye horarios, tareas y notas) |
| Horarios | `GET/POST /subjects/:id/schedules`, `PUT/DELETE /subjects/:id/schedules/:scheduleId` |
| Tareas | `GET/POST /subjects/:id/tasks`, `PUT/DELETE /subjects/:id/tasks/:taskId`, `POST /subjects/:id/tasks/:taskId/toggle` |
| Apuntes | `GET/POST /subjects/:id/notes`, `PUT/DELETE /subjects/:id/notes/:noteId`, `POST /subjects/:id/notes/:noteId/pin` |
| Editor de apuntes con IA | `POST /subjects/:id/notes/assistant` y autosave con `PUT /subjects/:id/notes/:noteId` |
| Flashcards | `POST /ai/flashcards`, `GET /ai/flashcards`, `DELETE /ai/resources/:id` |
| Simulacros | `POST /ai/resources/quiz?origin=SIMULACRO`, `GET /ai/resources?scope=simulacro`, `GET /ai/resources/:id`, `PATCH /ai/resources/:id/complete` |
| Profesor IA (chat) | `POST /ai/chat` o `POST /ai/chat/stream`, `GET /ai/conversations`, `GET /ai/conversations/:id` |
| Profesor IA (foto de ejercicio) | `POST /ai/images/content` → fases opcionales → `POST /ai/chat/image` |
| Temporizador | `POST /study-timer/session`, `GET /study-timer/stats`, `GET /study-timer/sessions` |
| Agenda | `GET /calendar/events`, `GET /calendar/exams/upcoming`, `POST/PATCH/DELETE /calendar/events` |
| Grupos | `GET /groups`, `GET /groups/my`, `GET /groups/recommended`, `POST /groups`, `POST /groups/:id/join`, `POST /groups/:id/leave` |
| Chat de grupo | `GET/POST /groups/:id/messages`, `POST /groups/:id/messages/image` + polling |
| Perfil | `GET /profile/personal`, `GET /profile/academic`, `GET /profile/professional`, `GET /profile/skills`, `GET /profile/objectives` |
| Editar perfil | `PUT /profile/personal` (sin `foto`), `PUT /profile/academic`, `PUT /profile/professional` |
| Foto de perfil | `POST /media/images/chunk` → `POST /media/images/:uploadId/complete`, `DELETE /media/avatar` |
| Notificaciones | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Ajustes de notificaciones | `GET/PUT /profile/notifications`, `GET/PUT /profile/privacy` |
| Riesgo académico | `GET /risk`, `GET /risk/subjects`, `POST /risk/recalculate` |
| Módulos opcionales | `/resume`, `/jobs`, `/roadmaps`, `/sandbox`, `/resume-analyzer` |

### Prioridad de implementación

1. **P0:** auth, sesión, dashboard, materias, tareas, apuntes, perfil y avatar.
2. **P1:** asistente de apuntes, flashcards, simulacros, Profesor IA y temporizador.
3. **P2:** agenda, grupos, chat, notificaciones y riesgo.
4. **P3:** CV, empleos, roadmaps, sandbox y analizador de CV.

---

## 5. Referencia por módulo

### 5.1 Dashboard, gamificación y riesgo

| Método | Ruta | Qué devuelve |
|---|---|---|
| GET | `/dashboard/summary` | Todo el inicio en una llamada: usuario, estadísticas, gamificación, riesgo, clases de hoy, tareas, notas recientes, metas y porcentaje de completado |
| GET | `/dashboard/leaderboard` | Ranking por racha y horas de estudio, más la posición del usuario |
| GET | `/gamification/progress` | Nivel, XP, racha, mejor racha y logros |
| GET | `/risk` | Último análisis de riesgo (puede devolver `null` si aún no existe) |
| GET | `/risk/history` | Historial de análisis |
| GET | `/risk/subjects` | Riesgo por materia |
| GET | `/risk/subjects/:subjectId` | Riesgo de una materia |
| POST | `/risk/recalculate` | Recalcular el riesgo |

`GET /dashboard/summary` es la llamada más rentable para la pantalla de inicio:
evita pedir materias, tareas y notas por separado.

---

### 5.2 Materias, horarios, tareas y apuntes

Todas las rutas requieren JWT y solo devuelven datos del usuario autenticado.

#### Materias

| Método | Ruta | Cuerpo / notas |
|---|---|---|
| POST | `/subjects` | `nombre`, `color` (obligatorios); `codigo`, `profesor`, `salon`, `creditos`, `descripcion` |
| GET | `/subjects` | Lista con `_count` de tareas, notas y horarios |
| GET | `/subjects/:id` | Detalle con `schedules`, `tasks` y `notes` |
| PUT | `/subjects/:id` | Parcial |
| DELETE | `/subjects/:id` | Elimina en cascada según Prisma |

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

`color` es obligatorio en la creación. En la app conviene ofrecer una paleta y
guardar el hex tal cual.

#### Horarios

```json
{
  "dayOfWeek": 1,
  "startTime": "08:00",
  "endTime": "10:00",
  "classroom": "Aula 204"
}
```

`dayOfWeek`: 0 = domingo, 1 = lunes, …, 6 = sábado.

#### Tareas

```json
{
  "title": "Resolver taller de límites",
  "description": "Ejercicios 1 al 10",
  "priority": "HIGH",
  "dueDate": "2026-11-01T23:59:00.000Z"
}
```

Prioridades: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. El toggle
`POST /subjects/:id/tasks/:taskId/toggle` alterna pendiente/completada y es el
endpoint que debe usar el checkbox de la lista.

#### Apuntes

| Método | Ruta | Cuerpo |
|---|---|---|
| POST | `/subjects/:id/notes` | `title`, `content`, `isPinned?` |
| GET | `/subjects/:id/notes` | Ordenadas por fijadas y luego por `updatedAt` |
| PUT | `/subjects/:id/notes/:noteId` | `title?`, `content?`, `isPinned?` |
| POST | `/subjects/:id/notes/:noteId/pin` | Sin cuerpo; alterna el pin |
| DELETE | `/subjects/:id/notes/:noteId` | — |
| POST | `/subjects/:id/notes/assistant` | Acción de IA, no guarda nada |

El editor móvil debería guardar con debounce (por ejemplo 800–1200 ms) usando
`PUT` y mostrar un estado “Guardando… / Guardado”. Evita guardar en cada tecla.

#### Asistente de apuntes (IA)

**Endpoint:** `POST /subjects/:id/notes/assistant`

```json
{
  "action": "improve",
  "title": "Límites y continuidad",
  "content": "## Idea general\nUna función es continua si...",
  "instruction": "Incluye un ejemplo con límites laterales"
}
```

Acciones disponibles:

| `action` | Qué hace | Requisito |
|---|---|---|
| `draft` | Crea un apunte desde cero | `title` o `instruction` |
| `continue` | Continúa el texto donde termina | `content` de al menos 40 caracteres |
| `improve` | Reescribe y ordena el apunte | `content` de al menos 40 caracteres |
| `summarize` | Resumen con preguntas de autoevaluación | `content` de al menos 40 caracteres |
| `outline` | Esquema jerárquico | `content` de al menos 40 caracteres |

Respuesta:

```json
{
  "proposal": "## ...",
  "action": "improve",
  "model": "..."
}
```

La propuesta **no se guarda automáticamente**. El flujo correcto en la app es:
mostrar vista previa → botones “Aplicar” / “Descartar” → si aplica, `PUT` del
apunte. `proposal` viene en Markdown (con LaTeX `$...$`); usa el mismo renderizador
que el chat.

La IA puede devolver `429` si se supera el límite de Groq. Muestra un mensaje
claro y permite reintentar.

---

### 5.3 De un apunte a flashcards y simulacros

No hace falta un endpoint nuevo: los generadores aceptan el **texto del apunte**
en el campo `material`. Esto es lo que debe usar el botón “Generar material de
estudio” dentro de una nota.

#### Flashcards desde una nota

```http
POST /ai/flashcards
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Límites y continuidad",
  "subject": "Cálculo II",
  "count": 12,
  "material": "<contenido completo del apunte en Markdown>"
}
```

Respuesta:

```json
{
  "flashcards": [
    {
      "id": "64f1a2b3c4d5e6f789012345",
      "question": "¿Qué significa que una función sea continua en un punto?",
      "answer": "...",
      "hint": "...",
      "topic": "Límites y continuidad",
      "subject": "Cálculo II"
    }
  ]
}
```

Cada tarjeta se guarda como un recurso independiente. Para el mazo completo usa
`GET /ai/flashcards?limit=100`; para borrar una tarjeta,
`DELETE /ai/resources/:id`.

#### Simulacro desde una nota

```http
POST /ai/resources/quiz?origin=SIMULACRO
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "Límites y continuidad",
  "difficulty": "INTERMEDIATE",
  "count": 10,
  "material": "<contenido completo del apunte>"
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

`origin=SIMULACRO` es lo que separa el simulacro de un quiz normal. Para crear un
quiz normal usa `origin=QUIZ` o el endpoint `/ai/resources/quiz` sin `origin`.

**Importante:** el backend no impone el tiempo del simulacro. El temporizador lo
controla la app; al terminar, envía el resultado con:

```http
PATCH /ai/resources/:id/complete
Content-Type: application/json

{ "resultScore": 0.8, "resultCorrect": 8, "resultTotal": 10 }
```

`resultScore` va entre 0 y 1. Este endpoint también actualiza las brechas de
conocimiento del estudiante.

#### Listar y separar

| Llamada | Resultado |
|---|---|
| `GET /ai/resources?scope=simulacro` | Solo simulacros |
| `GET /ai/resources?scope=quiz` | Quizzes y demás recursos, sin simulacros |
| `GET /ai/resources?type=QUIZ` | Recursos de tipo quiz |
| `GET /ai/resources?type=FLASHCARDS` | Recursos de tipo flashcard |
| `GET /ai/resources/:id` | Recurso con `content` completo |

La lista no incluye `content`; pide el detalle antes de iniciar un quiz o
simulacro.

#### Reglas de UI para el material generado

- Las preguntas usan Markdown y LaTeX; renderízalas, no muestres `$...$` crudo.
- Reparte las opciones en el orden que llegan; la respuesta correcta no siempre
  es la primera.
- No reveles `answer` antes de que el usuario responda.
- Guarda el progreso local de la sesión; el backend solo guarda el resultado
  final al completar.
- El campo `hint` de una flashcard es opcional (`null`).

---

### 5.4 Profesor IA

#### Chat normal

```http
POST /ai/chat
{ "message": "Explícame la regla de la cadena", "conversationId": "64f1...", "teacherId": "default-teacher" }
```

`conversationId` y `teacherId` son opcionales. La respuesta real es:

```json
{ "conversationId": "64f1...", "reply": "..." }
```

No busques `message.content` en esta respuesta: el campo se llama `reply`.

#### Streaming (SSE)

```http
POST /ai/chat/stream
Accept: text/event-stream
```

Eventos:

```text
event: message
data: "Las funciones..."

event: done
data: {"conversationId":"64f1..."}
```

El `data` de cada `message` es un **string JSON** (un trozo de texto); hay que
hacer `JSON.parse` para obtener el texto. `done` cierra la respuesta. Si el
cliente móvil no soporta streaming, usa `POST /ai/chat` como fallback.

#### Conversaciones

| Método | Ruta | Uso |
|---|---|---|
| POST | `/ai/conversations` | Crear conversación vacía |
| GET | `/ai/conversations?page=1&limit=20` | Listar conversaciones |
| GET | `/ai/conversations/:id` | Conversación + mensajes |
| GET | `/ai/conversations/:id/messages` | Solo mensajes |
| DELETE | `/ai/conversations/:id` | Eliminar conversación y mensajes |

Los IDs de conversación son ObjectId de MongoDB (string de 24 hex).

#### Flashcards, quizzes y archivos

| Método | Ruta | Notas |
|---|---|---|
| POST | `/ai/flashcards` | `topic?`, `subject?`, `count` 3–20, `material?` |
| GET | `/ai/flashcards?limit=100` | Tarjetas guardadas |
| POST | `/ai/flashcards/file` | `multipart/form-data` con `file`; query `count`, `topic`, `uploadId?` |
| POST | `/ai/resources/quiz` | Query `origin=QUIZ\|SIMULACRO`; body `topic?`, `difficulty?`, `count` 3–15, `material?` |
| POST | `/ai/resources/quiz/file` | `multipart` con `file`; query `origin` (por defecto `SIMULACRO`), `count`, `difficulty`, `uploadId?` |
| GET | `/ai/resources` | Query `type`, `scope` |
| GET | `/ai/resources/:id` | Detalle con contenido |
| PATCH | `/ai/resources/:id/complete` | Resultado del quiz/simulacro |
| DELETE | `/ai/resources/:id` | Borrar recurso |

Para documentos grandes, usa el pipeline de subida por trozos que se explica en
la sección 6.2 y pasa el `uploadId` al endpoint `/file` correspondiente. No subas
un PDF de 20 MB en una sola petición: Vercel corta el cuerpo alrededor de 4,5 MB.

#### Imágenes de ejercicios o apuntes

El backend analiza la imagen en tres fases para que la app pueda mostrar
resultados progresivos:

1. `POST /ai/images/content` — `multipart/form-data`, campo `image` (máximo 6 MB),
   query opcional `idioma` y `enfoque`. Devuelve `{ fase: 1, contenido, meta }`.
2. `POST /ai/images/internal-prompt` — body `{ contenido, idioma?, enfoque? }`.
   Devuelve `{ fase: 2, promptInterno, meta }`.
3. `POST /ai/images/detail` — body `{ contenido, promptInterno, profundidad? }`.
   Devuelve `{ fase: 3, detalle, meta }`.

Luego se conversa con el resultado:

```http
POST /ai/chat/image
{
  "contenido": { "...": "..." },
  "promptInterno": { "...": "..." },
  "detalle": { "...": "..." },
  "nivel": "max",
  "message": "Explícame el ejercicio 3"
}
```

La respuesta es `{ conversationId, reply, imageAnalysis }`. Para la versión
rápida basta con la fase 1; las fases 2 y 3 son opcionales y más lentas. Si la
app solo quiere “explicar esta foto”, puede llamar a la fase 1 y luego a
`/ai/chat/image` sin fases adicionales.

#### Metas, brechas y dashboard de IA

| Método | Ruta |
|---|---|
| GET | `/ai/dashboard` |
| POST/GET | `/ai/goals` |
| PATCH/DELETE | `/ai/goals/:id` |
| GET | `/ai/knowledge-gaps` |
| GET | `/ai/knowledge-gaps/:subject` |
| PATCH | `/ai/knowledge-gaps/:id` |
| POST | `/ai/explain-answer` |

`POST /ai/explain-answer` recibe `question`, `choices`, `correctAnswer`,
`topic?` e `isCorrect?`, y devuelve una explicación. Es el botón “¿Por qué?” de
un quiz.

---

### 5.5 Perfil

Todas las rutas requieren JWT.

#### Datos personales

| Método | Ruta | Notas |
|---|---|---|
| GET | `/profile/personal` | Usuario completo (sin password ni secreto 2FA), con `foto` y `progress` |
| PUT | `/profile/personal` | `nombre`, `apellido`, `banner`, `ciudad`, `pais`, `fechaNacimiento`, `biografia`, `github`, `linkedin`, `portafolio`, `paginaPersonal` |

**No envíes `foto` en el `PUT /profile/personal`.** El DTO no lo acepta y el
`ValidationPipe` global tiene `forbidNonWhitelisted: true`, así que la petición
fallaría con 400. La foto se cambia únicamente con el pipeline de medios.

`banner` todavía es una URL externa; si se quiere que también se guarde en
MongoDB, falta migrar ese campo al pipeline de imágenes.

#### Perfil académico y profesional

| Método | Ruta |
|---|---|
| POST/GET/PUT/DELETE | `/profile/academic` |
| POST/GET/PUT/DELETE | `/profile/professional` |

Académico: `universidad`, `carrera`, `facultad`, `semestreActual`, `fechaInicio`,
`fechaGraduacion`, `modalidad`, `promedio?`, `materiasFav?`, `materiasDificil?`.

Profesional: `cargoDeseado`, `nivelActual`, `disponibilidad`, `modalidadDeseada`.

#### Skills y objetivos

| Método | Ruta | Cuerpo |
|---|---|---|
| GET | `/profile/skills` | — |
| POST | `/profile/skills` | `{ "skillId": 1, "nivel": "INTERMEDIATE" }` |
| PUT | `/profile/skills` | `{ "skillId": 1, "nivel": "ADVANCED" }` |
| DELETE | `/profile/skills/:skillId` | — |
| GET | `/profile/objectives` | — |
| POST | `/profile/objectives` | `{ "objectiveId": 1 }` |
| DELETE | `/profile/objectives/:objectiveId` | — |

Catálogos públicos (sin JWT): `GET /skills`, `GET /objectives`.
`POST /skills` crea una habilidad nueva en el catálogo.

#### Configuración y seguridad

| Método | Ruta | Uso |
|---|---|---|
| GET/PUT | `/profile/notifications` | `emailEnabled`, `pushEnabled`, `remindersEnabled` |
| GET/PUT | `/profile/privacy` | `publicProfile`, `showSkills`, `showCV` |
| GET | `/profile/security/sessions` | Sesiones registradas |
| DELETE | `/profile/security/sessions/:id` | Revocar una sesión |
| GET | `/profile/security/logs` | Últimos accesos |
| POST | `/profile/security/2fa/generate` | **Placeholder actual** |
| POST | `/profile/security/2fa/verify` | **Placeholder actual** |
| POST | `/profile/security/2fa/disable` | Desactiva el flag |

No implementes todavía la pantalla de 2FA: en el backend actual
`generate` devuelve un secreto de ejemplo y no lo guarda, y `verify` no valida
TOTP. Es un pendiente del backend, no de la app.

---

### 5.6 Foto de perfil guardada en MongoDB

Esta es la parte importante: **la imagen no se guarda como URL en Postgres**.
El backend recibe trozos binarios, los guarda en MongoDB, valida los bytes
reales y deja en `user.foto` solo una ruta relativa a la API.

#### Flujo completo

1. El usuario elige una imagen (JPG, PNG o WebP).
2. La app la recorta/redimensiona y comprime localmente. Recomendado: cuadrado,
   320–512 px, WebP/JPEG de calidad ~0.82. Para un avatar no necesitas subir 5 MB.
3. La app parte el archivo en trozos de **480 KB** (el máximo del backend es
   512 KB). El último trozo puede ser más pequeño.
4. Primer trozo: `POST /media/images/chunk` **sin** `uploadId`.
5. Trozos siguientes: mismo endpoint con el `uploadId` devuelto.
6. `POST /media/images/:uploadId/complete` para unir, validar y guardar.
7. Actualiza el estado local con `foto`; la imagen se sirve desde
   `GET /media/avatars/:id?v=hash`.
8. Para quitar la foto: `DELETE /media/avatar`.

#### Subir un trozo

```http
POST /media/images/chunk?index=0&total=1&kind=avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: avatar.part
```

En los siguientes trozos agrega `uploadId` a la query:

```http
POST /media/images/chunk?uploadId=64f1...&index=1&total=1&kind=avatar
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

**No fijes manualmente `Content-Type` en el FormData**; deja que el cliente
ponga el boundary. El campo del archivo se llama siempre `file`.

#### Completar

```http
POST /media/images/64f1a2b3c4d5e6f789012345/complete
Authorization: Bearer <token>
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

`deduped: true` significa que la imagen ya era la misma (hash idéntico) y no se
reescribió nada. La app puede actualizar la foto igual.

#### Reglas y límites del backend

| Regla | Valor |
|---|---|
| Tamaño máximo por trozo | 512 KB (la app usa 480 KB) |
| Trozos máximos | 8 |
| Tamaño máximo de la imagen final | 2 MB |
| Dimensiones máximas | 2048 × 2048 px |
| Formatos | JPG, PNG, WebP (se detectan por los bytes, no por la extensión) |
| Tipo soportado | `avatar` (por ahora el único) |
| Subidas abandonadas | Se limpian a los 30 minutos |
| Almacenamiento | MongoDB: sesiones, trozos y bytes finales |
| Servido | `GET /media/avatars/:id` público, con ETag y caché inmutable por versión |

La imagen final se guarda como bytes (BSON Binary), no en base64, para no gastar
un 33 % extra. El hash permite deduplicar y construir una URL que cambia cuando
cambia la foto; así se puede cachear para siempre sin ver una imagen vieja.

#### Cancelar y eliminar

```http
DELETE /media/images/:uploadId
DELETE /media/avatar
```

El primero descarta los trozos de una subida en curso. El segundo borra la
imagen guardada y deja `foto: null`.

#### Cómo mostrarla

```ts
const avatarUrl = user.foto
  ? `${API_BASE_URL}${user.foto}`
  : null;
```

Usa la caché de imágenes del framework (`expo-image`, `FastImage`, etc.) y
resuelve las rutas relativas. No guardes la URL absoluta en la base local: si
cambia el dominio, se rompe. La URL incluye `?v=hash`, por lo que al cambiar la
foto cambia la URL y la caché se invalida sola.

#### Resumen del contrato

| Método | Ruta | Auth | Función |
|---|---|---|---|
| POST | `/media/images/chunk` | JWT | Subir un trozo |
| POST | `/media/images/:uploadId/complete` | JWT | Unir, validar y guardar |
| DELETE | `/media/images/:uploadId` | JWT | Cancelar subida |
| DELETE | `/media/avatar` | JWT | Borrar avatar |
| GET | `/media/avatars/:id?v=hash` | No | Servir imagen |

---

### 5.7 Temporizador de estudio

| Método | Ruta | Cuerpo / query |
|---|---|---|
| POST | `/study-timer/session` | `subjectId?`, `durationMinutes`, `technique` |
| GET | `/study-timer/stats` | — |
| GET | `/study-timer/sessions` | `period=day\|week\|month\|all`, `page`, `limit` (máx. 50) |
| DELETE | `/study-timer/sessions` | — |

Técnicas con XP fijo: `POMODORO_25_5` (10 XP), `POMODORO_50_10` (25 XP),
`DEEP_BLOCK_90` (50 XP). Otras técnicas calculan XP por duración.

La respuesta de `POST /session` es:

```json
{ "success": true, "session": { "...": "..." }, "xpEarned": 10 }
```

`GET /study-timer/stats` devuelve solo `{ "totalHours": "3.5" }` (horas de la
semana actual). Si la app quiere un gráfico por día, calcula los días a partir de
`GET /study-timer/sessions?period=week`.

---

### 5.8 Agenda y calendario

| Método | Ruta | Notas |
|---|---|---|
| GET | `/calendar/events?start=...&end=...` | Si omites fechas, usa el mes actual; devuelve `{ events, tasks }` |
| GET | `/calendar/exams/upcoming` | Próximos 30 días |
| POST | `/calendar/events` | Crear evento |
| PATCH | `/calendar/events/:id` | Editar |
| DELETE | `/calendar/events/:id` | Eliminar |
| GET | `/calendar/google/connect` | Devuelve `{ url }` para abrir el consentimiento |
| GET | `/calendar/google/callback` | Callback público; redirige al frontend web |
| POST | `/calendar/google/sync` | Importar desde Google |
| DELETE | `/calendar/google/disconnect` | Desconectar |
| GET | `/calendar/google/status` | `{ connected: boolean }` |

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

`type`: `EVENT` o `EXAM`. `subjectId` es opcional.

El callback de Google redirige a `FRONTEND_URL/agenda?google=connected`; para
volver a la app móvil hace falta un deep link, igual que con el login de Google.
Mientras tanto, la app puede abrir el navegador y, al volver, consultar
`GET /calendar/google/status`.

---

### 5.9 Grupos de estudio y chat

#### Grupos

| Método | Ruta | Notas |
|---|---|---|
| POST | `/groups` | Crear grupo |
| GET | `/groups?page=1&limit=20` | Grupos públicos |
| GET | `/groups/my` | Mis grupos |
| GET | `/groups/recommended` | Recomendados según perfil |
| GET | `/groups/:id` | Detalle |
| POST | `/groups/:id/join` | `{ password }` si es privado |
| POST | `/groups/:id/leave` | Salir |
| POST | `/groups/:id/sessions` | Crear sesión de estudio |
| GET | `/groups/:id/sessions` | Listar sesiones |
| GET | `/groups/:id/messages` | Historial de chat |
| POST | `/groups/:id/messages` | `{ content }`, máximo 2000 caracteres |
| POST | `/groups/:id/messages/image` | `multipart/form-data`, campo `file` |

Crear grupo:

```json
{
  "name": "Grupo de Cálculo",
  "description": "Estudiamos los viernes",
  "subjectId": 1,
  "maxMembers": 10,
  "isPublic": true
}
```

Sesión:

```json
{
  "title": "Repaso de integrales",
  "description": "Capítulos 5 y 6",
  "startAt": "2026-11-01T18:00:00.000Z",
  "endAt": "2026-11-01T20:00:00.000Z"
}
```

#### Tiempo real: leer esto antes de elegir Socket.IO

El backend tiene Socket.IO (`/notifications` y `/group-chat`), pero **Vercel
(producción) no mantiene WebSockets**. Para la app móvil en producción, el plan
robusto es:

- Chat abierto: polling de `GET /groups/:id/messages` cada 5–8 segundos.
- Notificaciones: polling de `GET /notifications/unread-count` cada 30–60
  segundos y de la lista al abrir la pantalla.
- Socket.IO como mejora opcional en un entorno que soporte WebSockets
  (servidor persistente), no como dependencia del MVP.

Eventos si se usa Socket.IO:

```ts
socket.emit('join-room', { groupId });
socket.on('message-received', (message) => { /* ... */ });
socket.emit('send-message', { groupId, content });
```

Namespace de notificaciones: `notification:created`.

**Excepción de almacenamiento:** la imagen del chat de grupo todavía se sube a
Cloudinary y el mensaje guarda `imageUrl`. Si el requisito es que **todas** las
imágenes estén en MongoDB, ese endpoint hay que migrarlo al pipeline de medios;
hoy solo el avatar cumple esa regla.

---

### 5.10 Notificaciones

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/notifications?page=1&limit=50&sortBy=createdAt&order=desc` | `{ notifications, total, unreadCount, page, limit }` |
| GET | `/notifications/unread-count` | **Número** (no objeto) |
| PATCH | `/notifications/:id/read` | Notificación actualizada |
| PATCH | `/notifications/read-all` | Confirmación |

La configuración de notificaciones se cambia en `/profile/notifications`.
`pushEnabled` existe como preferencia, pero **no hay endpoint para registrar un
token de push ni envío de push**: para la app móvil hay que agregarlo en el
backend o usar notificaciones locales/recordatorios del sistema. No prometas push
remoto todavía.

---

### 5.11 Módulos opcionales

No son necesarios para el MVP, pero están disponibles:

| Módulo | Rutas base | Uso móvil |
|---|---|---|
| CV | `/resume`, `/resume/experience`, `/resume/education`, `/resume/project`, `/resume/certificate`, `/resume/language` | Ver/editar CV y PDF |
| Empleos | `/jobs`, `/jobs/saved`, `/jobs/applications`, `/jobs/:id`, `/jobs/:id/save`, `/jobs/:id/apply` | Buscar y postularse |
| Roadmaps | `/roadmaps`, `/roadmaps/generate`, `/roadmaps/:id`, `/roadmaps/steps/:stepId/complete` | Planes de estudio tipo Duolingo |
| Sandbox | `/sandbox/exercises`, `/sandbox/attempts`, `/sandbox/stats` | Ejercicios de código |
| Analizador de CV | `/resume-analyzer/analyze`, `/resume-analyzer/analyze-profile` | Subir PDF/DOCX y obtener score |

---

## 6. Subidas por trozos

### 6.1 Avatar

```text
Seleccionar imagen
  → recortar/comprimir localmente
  → dividir en trozos de 480 KB
  → POST /media/images/chunk (index 0, sin uploadId)
  → guardar uploadId
  → POST /media/images/chunk?uploadId=... (index 1..n)
  → POST /media/images/:uploadId/complete
  → actualizar user.foto
```

Pseudo-código para el cliente (ejemplo conceptual; en React Native puro adapta
el archivo a la API de tu stack, por ejemplo `expo-file-system`):

```ts
const CHUNK = 480 * 1024;
const total = Math.ceil(blob.size / CHUNK);
let uploadId: string | null = null;

for (let index = 0; index < total; index++) {
  const form = new FormData();
  form.append('file', blob.slice(index * CHUNK, (index + 1) * CHUNK), `avatar-${index}.part`);

  const params = new URLSearchParams({
    index: String(index),
    total: String(total),
    kind: 'avatar',
  });
  if (uploadId) params.set('uploadId', uploadId);

  const res = await fetch(`${API_BASE_URL}/media/images/chunk?${params}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error('No se pudo subir la foto');
  uploadId = (await res.json()).uploadId;
}

const complete = await fetch(
  `${API_BASE_URL}/media/images/${uploadId}/complete`,
  { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
);
const { foto } = await complete.json();
```

Si el usuario cancela o la app se cierra, conserva el `uploadId` en memoria (o
en almacenamiento temporal) y llama a `DELETE /media/images/:uploadId`; el backend
también limpia sesiones abandonadas a los 30 minutos.

Progreso recomendado en la UI:

- 0–5 %: optimizando imagen.
- 5–90 %: subiendo trozos (`(index + 1) / total`).
- 90–100 %: guardando y validando.

Muestra errores claros: formato no soportado, imagen muy grande, conexión
interrumpida. No reintentes el `complete` si el backend ya devolvió una foto;
primero refresca `GET /profile/personal`.

### 6.2 Documentos para IA (PDF/DOCX/TXT)

Los documentos no se guardan como imagen: se guardan temporalmente para extraer
texto y se borran al generar el material.

1. Divide el archivo en trozos de **3 MB**.
2. `POST /ai/uploads/chunk?index=0&total=N&filename=...&mimetype=...` con campo
   `file`.
3. Guarda `uploadId` y repite con `index=1..N-1`.
4. **No hay endpoint `complete` de documentos.** Pasa `uploadId` a:
   - `POST /ai/flashcards/file?uploadId=...&count=12`
   - `POST /ai/resources/quiz/file?uploadId=...&origin=SIMULACRO&count=10`
5. Esas llamadas unen los trozos, extraen el texto, generan el material y borran
   la subida. Si fallan, puedes cancelar con `DELETE /ai/uploads/:id`.

Límites: 3 MB recomendado por trozo, hasta 200 trozos, y las subidas abandonadas
se limpian a la hora. Para un archivo pequeño también puedes usar directamente
`multipart/form-data` con el campo `file` en el endpoint `/file`, pero para
producción móvil prefiere siempre trozos.

---

## 7. Qué guardar en la app

| Dato | Dónde | Por qué |
|---|---|---|
| `access_token` | SecureStore / Keychain | Es una credencial; no va en AsyncStorage |
| `user` | Estado en memoria + caché ligera | Se refresca con `/profile/personal` |
| `foto` | Copia del string relativo | La URL se resuelve con `API_BASE_URL` |
| `uploadId` de avatar | Estado temporal | Permite cancelar/reanudar |
| `uploadId` de documento | Estado temporal | Se pasa al generador de IA |
| Progreso de simulacro | Estado local | El backend solo guarda el resultado final |
| Última sincronización | Estado local | Para polling y caché de listas |

No guardes el token en la base de datos local de la app ni en logs. Si usas un
cliente HTTP con interceptores, centraliza el 401 y el refresh de la sesión en un
solo lugar.

---

## 8. Errores, reintentos y experiencia de usuario

- **GET:** reintento automático una vez con backoff corto (500 ms) en errores de
  red o 5xx.
- **POST/PUT/DELETE:** no reintentes a ciegas; muestra “Reintentar”. Los trozos
  de imagen sí son idempotentes por `index` (reemplazan el mismo trozo), pero
  una generación de IA repetida consume cuota.
- **429 de IA:** espera 10–30 segundos y ofrece reintentar; no dispares varias
  generaciones en paralelo.
- **Timeout:** 15 s para CRUD normal, 60–120 s para generación de IA y análisis
  de imagen. El streaming evita esperar una respuesta completa.
- **Formularios:** desactiva el botón mientras hay una petición en curso; evita
  dobles registros y dobles apuntes.
- **Listas vacías:** muestra un estado vacío con acción (“Crea tu primera
  materia”, “Genera tus primeras flashcards”).
- **Modo offline:** no hay sincronización offline en el backend. Puedes cachear
  lecturas, pero las escrituras deben requerir conexión y avisar si fallan.

---

## 9. Checklist de integración móvil

- [ ] `API_BASE_URL` configurada por entorno.
- [ ] Cliente HTTP central con `Authorization` y manejo global de 401.
- [ ] Token en SecureStore/Keychain.
- [ ] Registro, login, verificación de correo y recuperación de contraseña.
- [ ] `GET /profile/personal` al restaurar sesión.
- [ ] Dashboard con `GET /dashboard/summary`.
- [ ] CRUD de materias, tareas, horarios y apuntes.
- [ ] Editor de apuntes con autosave y vista previa Markdown/LaTeX.
- [ ] Asistente de apuntes con vista previa antes de aplicar.
- [ ] Generación de flashcards y simulacros desde una nota usando `material`.
- [ ] Subida de avatar por trozos, con progreso, cancelación y borrado.
- [ ] Resolución de `foto` relativa a `API_BASE_URL`.
- [ ] Temporizador y registro de sesiones.
- [ ] Agenda y próximos exámenes.
- [ ] Grupos y chat con polling (sin depender de WebSockets en Vercel).
- [ ] Notificaciones y contador de no leídas.
- [ ] Pantalla de perfil con datos académicos, profesional, skills y objetivos.
- [ ] Manejo de 429, 413, 415 y errores de red.
- [ ] Pruebas en dispositivo físico con HTTPS.

---

## 10. Pendientes conocidos (no los inventes en la app)

| Tema | Estado actual |
|---|---|
| Refresh token | No existe; el JWT dura 7 días y luego hay que volver a iniciar sesión |
| Login con Google en móvil | El callback redirige al frontend web; falta deep link |
| Recuperación de contraseña en móvil | El correo apunta al frontend web; falta deep link |
| Push remoto | Solo hay preferencia `pushEnabled`; no hay registro de token ni envío |
| 2FA | Endpoints placeholder; no generan ni validan TOTP realmente |
| WebSockets en producción | Vercel no los mantiene; usar polling |
| Banner de perfil | Sigue siendo una URL externa; no pasa por MongoDB |
| Imágenes del chat de grupos | Cloudinary + `imageUrl`; no están en MongoDB |
| Offline | Sin sincronización ni cola de escrituras |
| `GET /profile/modules` | Aparece en documentación antigua, pero no existe en el backend actual |
| `GET /study-timer/stats` | Devuelve solo `totalHours`; la documentación antigua muestra un arreglo semanal que ya no existe |

---

## 11. Orden recomendado para construir la app

1. **Semana 1:** proyecto, variables de entorno, cliente HTTP, login/registro,
   almacenamiento seguro y restauración de sesión.
2. **Semana 2:** dashboard, materias, tareas y apuntes con autosave.
3. **Semana 3:** asistente de apuntes, generación de flashcards/simulacros y
   subida de avatar por trozos.
4. **Semana 4:** Profesor IA, temporizador, agenda y notificaciones.
5. **Semana 5:** grupos, chat con polling, riesgo académico y pulido.
6. **Después:** módulos de CV/empleos/roadmaps/sandbox y las integraciones
   pendientes (Google, push, 2FA).

---

## 12. Referencias

- Swagger: `https://study-hub-backend-sigma.vercel.app/api`
- Documentación general del backend: [`API-DOCS.md`](./API-DOCS.md)
- README del backend: [`README.md`](./README.md)

Si vas a agregar una pantalla nueva, revisa primero esta guía y reutiliza los
endpoints existentes. Si de verdad falta un endpoint, documéntalo aquí antes de
improvisar una URL en el cliente.
