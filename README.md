# StudyHub Backend

Plataforma integral de gestión académica con inteligencia artificial para estudiantes. Backend construido con **NestJS 11**, **PostgreSQL** (Prisma 7) y **MongoDB**.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** NestJS 11
- **ORM:** Prisma 7 (PostgreSQL)
- **MongoDB:** Chat, memoria, gaps, metas, analytics
- **AI:** Groq SDK (Llama 3.3 70B)
- **Auth:** JWT + Passport + Google OAuth
- **PDF:** Puppeteer, pdf-parse
- **Tasks:** @nestjs/schedule (cron)
- **Docs:** Swagger UI disponible en `/api`

## Estructura del Proyecto

```
src/
├── auth/                # Autenticación JWT + Google OAuth
├── ai/                  # Profesor IA (chat, gaps, metas, adaptive learning)
│   ├── adaptive/        # Motor de aprendizaje adaptativo
│   ├── knowledge-gaps/  # Detección híbrida de gaps de conocimiento
│   ├── learning-goals/  # Metas de aprendizaje (MongoDB)
│   ├── job-matching/    # Matching de empleos con IA
│   └── ...              # Memory, teacher profiles, prompts, analytics
├── profile/             # Perfiles académico y profesional
├── subjects/            # Materias, tareas, horarios, notas
├── dashboard/           # Dashboard agregado
├── gamification/        # XP, niveles, logros, rachas
├── resume/              # CV Builder con generación de PDF
├── resume-analyzer/     # Analizador de CV con IA (PDF/DOCX)
├── jobs/                # Bolsa de empleo, aplicaciones, matching
├── roadmaps/            # Roadmaps de aprendizaje generados por IA
├── study-groups/        # Grupos de estudio con recomendación IA
├── notifications/       # Notificaciones inteligentes con cron jobs
└── academic-risk/       # Motor de riesgo académico
```

---

## API Endpoints — Documentación Completa

Todas las rutas protegidas requieren header: `Authorization: Bearer <JWT>`

---

### Auth (`/auth`)

#### `POST /auth/register`
Registrar un nuevo usuario.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| nombre | string | sí | Nombre del usuario | Juan |
| apellido | string | sí | Apellido del usuario | Pérez |
| email | string | sí | Correo electrónico | juan@example.com |
| password | string | sí | Contraseña (mín. 6 caracteres) | secure123 |
| confirmPassword | string | sí | Confirmación de contraseña | secure123 |

**Responses:** `201` Usuario registrado exitosamente / `400` Datos inválidos o email ya registrado

#### `POST /auth/login`
Iniciar sesión.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| email | string | sí | Correo electrónico | juan@example.com |
| password | string | sí | Contraseña | 123456 |

**Responses:** `200` Inicio de sesión exitoso (devuelve JWT) / `401` Credenciales inválidas

#### `POST /auth/verify-email`
Verificar correo electrónico con código de 6 dígitos.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| email | string | sí | Correo electrónico | juan@example.com |
| code | string | sí | Código de verificación de 6 dígitos | 123456 |

**Responses:** `200` Correo verificado exitosamente / `400` Código inválido o expirado

#### `POST /auth/resend-code`
Reenviar código de verificación al correo.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| email | string | sí | Correo electrónico | juan@example.com |

**Responses:** `200` Código reenviado exitosamente / `404` Usuario no encontrado

#### `GET /auth/google`
Iniciar sesión con Google. Redirige a Google OAuth.

**Responses:** `302` Redirección a Google OAuth

#### `GET /auth/google/callback`
Callback de Google OAuth.

**Responses:** `200` Autenticación con Google exitosa / `401` Autenticación fallida

---

### Profile (`/profile`)

Todas las rutas requieren `Bearer JWT`.

#### Perfil Académico

##### `POST /profile/academic`
Crear perfil académico.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| universidad | string | sí | Nombre de la universidad | Universidad de Buenos Aires |
| carrera | string | sí | Carrera que cursa | Ingeniería en Sistemas |
| facultad | string | sí | Facultad | Facultad de Ingeniería |
| semestreActual | number | sí | Semestre actual | 3 |
| fechaInicio | string (date) | sí | Fecha de inicio de carrera | 2023-03-01 |
| fechaGraduacion | string (date) | sí | Fecha estimada de graduación | 2027-12-15 |
| modalidad | enum | sí | ON_SITE / REMOTE / HYBRID | ON_SITE |
| promedio | number | no | Promedio general | 85 |
| materiasFav | string[] | no | Materias favoritas | ["Álgebra", "Programación"] |
| materiasDificil | string[] | no | Materias difíciles | ["Física", "Química"] |

**Responses:** `201` Perfil académico creado / `400` Datos inválidos

##### `GET /profile/academic`
Obtener perfil académico del usuario autenticado.

**Responses:** `200` Perfil académico / `404` Perfil no encontrado

##### `PUT /profile/academic`
Actualizar perfil académico. Mismos campos que creación, todos opcionales.

**Responses:** `200` Perfil académico actualizado / `404` Perfil no encontrado

##### `DELETE /profile/academic`
Eliminar perfil académico.

**Responses:** `200` Perfil académico eliminado

#### Perfil Profesional

##### `POST /profile/professional`
Crear perfil profesional.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| cargoDeseado | string | sí | Cargo deseado | Desarrollador Backend |
| nivelActual | enum | sí | STUDENT / INTERN / JUNIOR / MID / SENIOR | JUNIOR |
| disponibilidad | enum | sí | FULL_TIME / PART_TIME / FREELANCE / NOT_AVAILABLE | FULL_TIME |
| modalidadDeseada | enum | sí | ON_SITE / REMOTE / HYBRID | REMOTE |

**Responses:** `201` Perfil profesional creado / `400` Datos inválidos

##### `GET /profile/professional`
Obtener perfil profesional.

**Responses:** `200` Perfil profesional / `404` Perfil no encontrado

##### `PUT /profile/professional`
Actualizar perfil profesional.

**Responses:** `200` Perfil profesional actualizado / `404` Perfil no encontrado

##### `DELETE /profile/professional`
Eliminar perfil profesional.

**Responses:** `200` Perfil profesional eliminado

#### Skills del Usuario

##### `GET /profile/skills`
Obtener habilidades del usuario.

**Responses:** `200` Habilidades del usuario

##### `POST /profile/skills`
Agregar habilidad al usuario.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| skillId | number | sí | ID de la habilidad | 1 |
| nivel | enum | no | BASIC / INTERMEDIATE / ADVANCED / EXPERT | INTERMEDIATE |

**Responses:** `201` Habilidad agregada / `400` Datos inválidos

##### `PUT /profile/skills`
Actualizar nivel de habilidad del usuario. Mismos campos que POST.

**Responses:** `200` Nivel de habilidad actualizado / `404` Habilidad no encontrada

##### `DELETE /profile/skills/:skillId`
Eliminar habilidad del usuario.

**Responses:** `200` Habilidad eliminada / `404` Habilidad no encontrada

#### Objectives del Usuario

##### `GET /profile/objectives`
Obtener objetivos del usuario.

**Responses:** `200` Objetivos del usuario

##### `POST /profile/objectives`
Agregar objetivo al usuario.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| objectiveId | number | sí | ID del objetivo | 1 |

**Responses:** `201` Objetivo agregado / `400` Datos inválidos

##### `DELETE /profile/objectives/:objectiveId`
Eliminar objetivo del usuario.

**Responses:** `200` Objetivo eliminado / `404` Objetivo no encontrado

#### Módulos del Usuario

##### `GET /profile/modules`
Obtener módulos del usuario.

**Responses:** `200` Módulos del usuario

##### `POST /profile/modules`
Activar/desactivar un módulo.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| moduleId | number | sí | ID del módulo | 1 |

**Responses:** `200` Estado del módulo actualizado / `404` Módulo no encontrado

##### `POST /profile/modules/defaults`
Activar módulos por defecto.

**Responses:** `200` Módulos por defecto activados

#### Información Personal

##### `GET /profile/personal`
Obtener información personal.

**Responses:** `200` Información personal

##### `PUT /profile/personal`
Actualizar información personal.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| foto | string | no | URL de la foto de perfil | https://example.com/foto.jpg |
| banner | string | no | URL del banner | https://example.com/banner.jpg |
| ciudad | string | no | Ciudad de residencia | Buenos Aires |
| pais | string | no | País de residencia | Argentina |
| fechaNacimiento | string (date) | no | Fecha de nacimiento | 2000-01-15 |
| biografia | string | no | Biografía | Desarrollador full stack... |
| github | string | no | Usuario de GitHub | juanperez |
| linkedin | string | no | Perfil de LinkedIn | https://linkedin.com/in/juanperez |
| portafolio | string | no | URL del portafolio | https://juanperez.dev |
| paginaPersonal | string | no | Página personal | https://juanperez.com |

**Responses:** `200` Información personal actualizada / `400` Datos inválidos

#### Configuración de Notificaciones

##### `GET /profile/notifications`
Obtener configuración de notificaciones.

**Responses:** `200` Configuración de notificaciones

##### `PUT /profile/notifications`
Actualizar configuración de notificaciones.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| emailEnabled | boolean | no | Notificaciones por correo | true |
| pushEnabled | boolean | no | Notificaciones push | false |
| remindersEnabled | boolean | no | Recordatorios | true |

**Responses:** `200` Configuración actualizada / `400` Datos inválidos

#### Configuración de Privacidad

##### `GET /profile/privacy`
Obtener configuración de privacidad.

**Responses:** `200` Configuración de privacidad

##### `PUT /profile/privacy`
Actualizar configuración de privacidad.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| publicProfile | boolean | no | Perfil público | true |
| showSkills | boolean | no | Mostrar habilidades | true |
| showCV | boolean | no | Mostrar CV | false |

**Responses:** `200` Configuración actualizada / `400` Datos inválidos

#### Seguridad / 2FA

##### `POST /profile/security/2fa/generate`
Generar secreto para 2FA.

**Responses:** `200` Secreto 2FA generado (devuelve QR y código manual)

##### `POST /profile/security/2fa/verify`
Verificar y habilitar 2FA.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| token | string | sí | Token de verificación 2FA | 123456 |

**Responses:** `200` 2FA habilitado exitosamente / `400` Token inválido

##### `POST /profile/security/2fa/disable`
Deshabilitar 2FA.

**Responses:** `200` 2FA deshabilitado

##### `GET /profile/security/sessions`
Obtener sesiones activas.

**Responses:** `200` Sesiones activas

##### `DELETE /profile/security/sessions/:id`
Revocar una sesión activa.

**Responses:** `200` Sesión revocada / `404` Sesión no encontrada

##### `GET /profile/security/logs`
Obtener historial de accesos.

**Responses:** `200` Historial de accesos

---

### Skills (`/skills`)
Rutas públicas.

##### `GET /skills`
Obtener todas las habilidades disponibles.

**Responses:** `200` Todas las habilidades disponibles

##### `POST /skills`
Crear una nueva habilidad.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| nombre | string | sí | Nombre de la habilidad | TypeScript |

**Responses:** `201` Habilidad creada / `400` Datos inválidos

---

### Objectives (`/objectives`)
Ruta pública.

##### `GET /objectives`
Obtener todos los objetivos disponibles.

**Responses:** `200` Todos los objetivos disponibles

---

### Modules (`/modules`)
Ruta pública.

##### `GET /modules`
Obtener todos los módulos disponibles.

**Responses:** `200` Todos los módulos disponibles

---

### Subjects (`/subjects`)

Todas las rutas requieren `Bearer JWT`.

#### Materias

##### `POST /subjects`
Crear una materia.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| nombre | string | sí | Nombre de la materia | Cálculo diferencial |
| codigo | string | no | Código de la materia | MAT-101 |
| profesor | string | no | Nombre del profesor | Dra. Laura Gómez |
| salon | string | no | Salón de clase | B-301 |
| creditos | number | no | Número de créditos | 3 |
| color | string | sí | Color hexadecimal | #3B82F6 |
| descripcion | string | no | Descripción | Fundamentos de límites, derivadas y aplicaciones. |

**Responses:** `201` Materia creada / `400` Datos inválidos

##### `GET /subjects`
Obtener todas las materias del usuario.

**Responses:** `200` Lista de materias

##### `GET /subjects/:id`
Obtener una materia con sus horarios, tareas y notas.

**Responses:** `200` Detalle de la materia / `404` Materia no encontrada

##### `PUT /subjects/:id`
Actualizar una materia. Mismos campos que creación, todos opcionales.

**Responses:** `200` Materia actualizada / `404` Materia no encontrada

##### `DELETE /subjects/:id`
Eliminar una materia.

**Responses:** `200` Materia eliminada / `404` Materia no encontrada

#### Horarios

##### `POST /subjects/:id/schedules`
Agregar horario a una materia.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| dayOfWeek | number | sí | Día (0=Dom, 1=Lun…6=Sáb) | 1 |
| startTime | string | sí | Hora inicio (HH:mm) | 08:00 |
| endTime | string | sí | Hora fin (HH:mm) | 10:00 |
| classroom | string | no | Salón de clase | Aula 204 |

**Responses:** `201` Horario creado / `400` Datos inválidos

##### `GET /subjects/:id/schedules`
Obtener horarios de una materia.

**Responses:** `200` Lista de horarios

##### `PUT /subjects/:id/schedules/:scheduleId`
Actualizar un horario.

**Responses:** `200` Horario actualizado / `404` Horario no encontrado

##### `DELETE /subjects/:id/schedules/:scheduleId`
Eliminar un horario.

**Responses:** `200` Horario eliminado / `404` Horario no encontrado

#### Tareas

##### `POST /subjects/:id/tasks`
Crear tarea en una materia.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| title | string | sí | Título de la tarea | Resolver taller de límites |
| description | string | no | Descripción | Completar ejercicios 1 al 10 del capítulo 2. |
| priority | enum | sí | LOW / MEDIUM / HIGH / URGENT | HIGH |
| dueDate | string (ISO) | sí | Fecha límite | 2026-07-01T23:59:00.000Z |

**Responses:** `201` Tarea creada / `400` Datos inválidos

##### `GET /subjects/:id/tasks`
Obtener tareas de una materia.

**Responses:** `200` Lista de tareas

##### `PUT /subjects/:id/tasks/:taskId`
Actualizar una tarea.

**Responses:** `200` Tarea actualizada / `404` Tarea no encontrada

##### `POST /subjects/:id/tasks/:taskId/toggle`
Marcar/desmarcar tarea como completada.

**Responses:** `200` Estado de tarea actualizado

##### `DELETE /subjects/:id/tasks/:taskId`
Eliminar una tarea.

**Responses:** `200` Tarea eliminada / `404` Tarea no encontrada

#### Notas

##### `POST /subjects/:id/notes`
Crear nota en una materia.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| title | string | sí | Título de la nota | Resumen de derivadas |
| content | string | sí | Contenido de la nota | La derivada mide la tasa de cambio instantánea... |
| isPinned | boolean | no | Nota fijada | true |

**Responses:** `201` Nota creada / `400` Datos inválidos

##### `GET /subjects/:id/notes`
Obtener notas de una materia.

**Responses:** `200` Lista de notas

##### `PUT /subjects/:id/notes/:noteId`
Actualizar una nota.

**Responses:** `200` Nota actualizada / `404` Nota no encontrada

##### `POST /subjects/:id/notes/:noteId/pin`
Fijar/desfijar una nota.

**Responses:** `200` Estado de fijado actualizado

##### `DELETE /subjects/:id/notes/:noteId`
Eliminar una nota.

**Responses:** `200` Nota eliminada / `404` Nota no encontrada

---

### Dashboard (`/dashboard`)

##### `GET /dashboard/summary`
Obtener resumen del dashboard: estadísticas, próximas clases del día, tareas pendientes y notas recientes.

**Responses:** `200` Resumen del dashboard

---

### Resume (`/resume`)

> **Cambio de seguridad:** Ahora `POST /resume`, `GET /resume/me` y `PUT /resume/me` requieren JWT.
> El CV propio se gestiona con `/me`. Para compartir, se usa `/public/:slug`.

##### `POST /resume` (JWT)
Crear mi CV. El `userId` se obtiene del token JWT automáticamente.

**Request Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| userId | number | no | Ignorado (se usa el del JWT) |
| titulo | string | no | Título profesional |
| resumen | string | no | Resumen profesional |
| slug | string | no | Slug público (auto-generado si se omite) |
| experiences | array | no | Experiencias laborales |
| educations | array | no | Formación académica |
| projects | array | no | Proyectos destacados |
| certificates | array | no | Certificaciones |
| languages | array | no | Idiomas |

**Response `201`:**
```json
{
  "id": 1,
  "userId": 1,
  "titulo": "Desarrollador Backend Junior",
  "slug": "juan-perez-1712345678",
  "experiences": [],
  "educations": [],
  "projects": [],
  "certificates": [],
  "languages": []
}
```

##### `GET /resume/me` (JWT)
Obtener mi CV.

**Response `200`:**
```json
{
  "id": 1,
  "userId": 1,
  "titulo": "Desarrollador Backend Junior",
  "resumen": "Desarrollador enfocado en APIs...",
  "slug": "juan-perez-1712345678",
  "experiences": [...],
  "educations": [...],
  "projects": [...],
  "certificates": [...],
  "languages": [...]
}
```

##### `PUT /resume/me` (JWT)
Actualizar mi CV. Mismos campos que creación, todos opcionales.

**Response `200`:** Misma estructura que `GET /resume/me`

##### `GET /resume/public/:slug`
Obtener CV público por slug. **No requiere autenticación** — ideal para compartir.

**Response `200`:**
```json
{
  "id": 1,
  "titulo": "Desarrollador Backend Junior",
  "slug": "juan-perez-1712345678",
  "experiences": [...],
  "user": {
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan@example.com"
  }
}
```

##### `GET /resume/:userId/pdf` (JWT)
Descargar CV como PDF. Solo el dueño del CV puede descargarlo.

**Response `200`:** Archivo PDF binario

---

### Experience (`/resume/experience`)

Todas requieren `Bearer JWT`.

##### `POST /resume/experience`
Agregar experiencia laboral.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| resumeId | number | sí | ID del CV | 1 |
| company | string | sí | Nombre de la empresa | Study Hub |
| position | string | sí | Cargo | Desarrollador Backend |
| description | string | no | Descripción | Diseñé APIs REST con NestJS... |
| startDate | string (date) | sí | Fecha de inicio | 2024-02-01 |
| endDate | string (date) | no | Fecha de finalización | 2025-11-30 |
| isCurrent | boolean | no | Empleo actual | false |
| location | string | no | Ubicación | Bogotá, Colombia |
| employmentType | string | no | Tipo de contrato | Tiempo completo |

**Responses:** `201` Experiencia creada / `400` Datos inválidos

##### `GET /resume/experience`
Listar experiencias del CV. Query param: `resumeId`.

**Responses:** `200` Lista de experiencias

##### `GET /resume/experience/:id`
Obtener una experiencia.

**Responses:** `200` Experiencia encontrada / `404` Experiencia no encontrada

##### `PUT /resume/experience/:id`
Actualizar experiencia.

**Responses:** `200` Experiencia actualizada / `404` Experiencia no encontrada

##### `DELETE /resume/experience/:id`
Eliminar experiencia.

**Responses:** `200` Experiencia eliminada / `404` Experiencia no encontrada

---

### Education (`/resume/education`)

Todas requieren `Bearer JWT`.

##### `POST /resume/education`
Agregar formación educativa.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| resumeId | number | sí | ID del CV | 1 |
| institution | string | sí | Institución educativa | Universidad Nacional |
| degree | string | sí | Título o programa | Ingeniería de Sistemas |
| startDate | string (date) | sí | Fecha de inicio | 2022-01-15 |
| endDate | string (date) | no | Fecha de finalización | 2026-12-15 |
| isCurrent | boolean | no | Formación en curso | true |

**Responses:** `201` Formación creada / `400` Datos inválidos

##### `GET /resume/education`
Listar formaciones del CV. Query param: `resumeId`.

**Responses:** `200` Lista de formaciones

##### `GET /resume/education/:id`
Obtener formación educativa.

**Responses:** `200` Formación encontrada / `404` Formación no encontrada

##### `PUT /resume/education/:id`
Actualizar formación.

**Responses:** `200` Formación actualizada / `404` Formación no encontrada

##### `DELETE /resume/education/:id`
Eliminar formación.

**Responses:** `200` Formación eliminada / `404` Formación no encontrada

---

### Projects (`/resume/project`)

Todas requieren `Bearer JWT`.

##### `POST /resume/project`
Agregar proyecto al CV.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| resumeId | number | sí | ID del CV | 1 |
| title | string | sí | Título del proyecto | Study Hub |
| description | string | sí | Descripción | Plataforma para organizar materias... |
| githubUrl | string | no | URL del repositorio | https://github.com/usuario/study-hub |
| liveUrl | string | no | URL del proyecto desplegado | https://study-hub.example.com |
| technologies | string[] | sí | Tecnologías utilizadas | ["NestJS","PostgreSQL","React"] |

**Responses:** `201` Proyecto agregado / `400` Datos inválidos

##### `GET /resume/project`
Listar proyectos del CV. Query param: `resumeId`.

**Responses:** `200` Lista de proyectos

##### `GET /resume/project/:id`
Obtener un proyecto.

**Responses:** `200` Proyecto encontrado / `401` No autorizado / `403` No pertenece al usuario / `404` No encontrado

##### `PUT /resume/project/:id`
Actualizar proyecto.

**Responses:** `200` Proyecto actualizado / `401` No autorizado / `403` No pertenece al usuario / `404` No encontrado

##### `DELETE /resume/project/:id`
Eliminar proyecto.

**Responses:** `200` Proyecto eliminado / `401` No autorizado / `403` No pertenece al usuario / `404` No encontrado

---

### Certificates (`/resume/certificate`)

Todas requieren `Bearer JWT`.

##### `POST /resume/certificate`
Crear certificado.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| resumeId | number | sí | ID del CV | 1 |
| title | string | sí | Nombre del certificado | AWS Cloud Practitioner |
| issuer | string | sí | Entidad emisora | Amazon Web Services |
| issueDate | string (date) | no | Fecha de emisión | 2025-09-15 |
| credentialUrl | string | no | URL de validación | https://www.credly.com/badges/example |

**Responses:** `201` Certificado creado / `400` Datos inválidos

##### `GET /resume/certificate`
Listar certificados. Query param: `resumeId`.

**Responses:** `200` Lista de certificados

##### `GET /resume/certificate/:id`
Obtener certificado.

**Responses:** `200` Certificado encontrado / `404` Certificado no encontrado

##### `PUT /resume/certificate/:id`
Actualizar certificado.

**Responses:** `200` Certificado actualizado / `404` Certificado no encontrado

##### `DELETE /resume/certificate/:id`
Eliminar certificado.

**Responses:** `200` Certificado eliminado / `404` Certificado no encontrado

---

### Languages (`/resume/language`)

Todas requieren `Bearer JWT`.

##### `POST /resume/language`
Agregar idioma al CV.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| resumeId | number | sí | ID del CV | 1 |
| name | string | sí | Nombre del idioma | Inglés |
| level | enum | sí | BASIC / INTERMEDIATE / ADVANCED / NATIVE | INTERMEDIATE |

**Responses:** `201` Idioma agregado / `400` Datos inválidos

##### `GET /resume/language`
Listar idiomas. Query param: `resumeId`.

**Responses:** `200` Lista de idiomas

##### `GET /resume/language/:id`
Obtener un idioma.

**Responses:** `200` Idioma encontrado / `404` Idioma no encontrado

##### `PUT /resume/language/:id`
Actualizar idioma.

**Responses:** `200` Idioma actualizado / `404` Idioma no encontrado

##### `DELETE /resume/language/:id`
Eliminar idioma.

**Responses:** `200` Idioma eliminado / `404` Idioma no encontrado

---

### Jobs (`/jobs`)

Todas requieren `Bearer JWT`.

##### `GET /jobs`
Listar empleos con filtros y paginación.

**Query Params:**
| Parámetro | Tipo | Descripción | Ejemplo |
|-----------|------|-------------|---------|
| page | number | Página (default: 1) | 1 |
| limit | number | Resultados por página (default: 20) | 20 |
| sortBy | string | Campo de ordenación | publishedAt |
| order | string | asc / desc | desc |
| isRemote | boolean | Filtrar por remoto | true |
| contractType | string | Tipo de contrato | Full-Time |
| salaryMin | number | Salario mínimo | 30000 |
| salaryMax | number | Salario máximo | 100000 |
| seniority | enum | STUDENT / INTERN / JUNIOR / MID / SENIOR | JUNIOR |
| skills | string | Skills separados por coma | NestJS,PostgreSQL |
| location | string | Ubicación (búsqueda parcial) | Bogotá |
| company | string | Empresa (búsqueda parcial) | TechCorp |

**Response `200`:**
```json
{
  "jobs": [
    {
      "id": 1,
      "title": "Backend Developer",
      "company": "TechCorp",
      "location": "Bogotá",
      "salaryMin": 30000,
      "salaryMax": 50000,
      "seniority": "JUNIOR",
      "isRemote": true,
      "contractType": "Full-Time",
      "skills": ["NestJS", "PostgreSQL", "TypeScript"],
      "publishedAt": "2026-06-20T00:00:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

##### `GET /jobs/saved`
Obtener empleos guardados del usuario.

**Responses:** `200` Empleos guardados

##### `GET /jobs/applications`
Obtener postulaciones del usuario.

**Responses:** `200` Postulaciones del usuario

##### `GET /jobs/:id`
Obtener detalle de un empleo.

**Responses:** `200` Detalle del empleo / `404` Empleo no encontrado

##### `POST /jobs/:id/save`
Guardar empleo.

**Responses:** `201` Empleo guardado / `404` Empleo no encontrado

##### `DELETE /jobs/:id/save`
Quitar guardado de empleo.

**Responses:** `200` Empleo removido de guardados / `404` Empleo no encontrado

##### `POST /jobs/:id/apply`
Postularse a un empleo.

**Request Body:**
| Campo | Tipo | Requerido |
|-------|------|-----------|
| notes | string | no |

**Responses:** `201` Postulación creada / `400` Ya postulado o datos inválidos / `404` Empleo no encontrado

##### `PATCH /jobs/:id/apply/status`
Actualizar estado de una postulación.

**Request Body:**
| Campo | Tipo | Requerido | Valores |
|-------|------|-----------|---------|
| status | enum | sí | SAVED / APPLIED / INTERVIEW / REJECTED / HIRED |

**Responses:** `200` Estado actualizado / `404` Postulación no encontrada

##### `GET /jobs/:id/match`
Calcular coincidencia de perfil con empleo usando IA.

**Responses:** `200` Resultado del match con IA / `404` Empleo o perfil no encontrado

---

### AI (`/ai`)

Todas requieren `Bearer JWT`.

#### Chat

##### `POST /ai/chat`
Enviar mensaje al asistente IA.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Ejemplo |
|-------|------|-----------|-------------|---------|
| conversationId | number | no | ID de conversación existente | 1 |
| teacherId | string | no | ID del perfil de profesor IA | default-teacher |
| message | string | sí | Mensaje del usuario | Explícame la regla de la cadena con un ejemplo corto. |

**Responses:** `201` Respuesta generada por el asistente IA

##### `POST /ai/chat/stream`
Enviar mensaje y recibir respuesta en streaming (SSE). Mismo body que `/ai/chat`.

**Responses:** `201` Stream SSE iniciado correctamente

#### Dashboard IA

##### `GET /ai/dashboard`
Dashboard de progreso del estudiante con IA.

**Responses:** `200`

#### Recursos Generados

##### `GET /ai/resources`
Listar recursos académicos generados por la IA. Query param: `type` (string, ej: "QUIZ").

**Responses:** `200`

##### `GET /ai/resources/:id`
Obtener un recurso generado con su contenido completo.

**Responses:** `200`

##### `PATCH /ai/resources/:id/complete`
Marcar recurso generado como completado.

**Request Body:**
| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| resultScore | number | Puntuación normalizada (0-1) | 0.85 |
| resultCorrect | number | Respuestas correctas | 8 |
| resultTotal | number | Total de preguntas | 10 |

**Responses:** `200`

##### `DELETE /ai/resources/:id`
Eliminar un recurso generado.

**Responses:** `200`

#### Learning Goals

##### `POST /ai/goals`
Crear meta de aprendizaje.

**Request Body:**
| Campo | Tipo | Requerido | Ejemplo |
|-------|------|-----------|---------|
| title | string | sí | Aprobar Física I |
| description | string | no | Dominar cinemática, dinámica y primer parcial |
| targetDate | string (date) | no | 2026-07-15 |

**Responses:** `201`

##### `GET /ai/goals`
Listar metas de aprendizaje del estudiante.

**Responses:** `200`

##### `PATCH /ai/goals/:id`
Actualizar meta de aprendizaje.

**Request Body:**
| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| title | string | Título | Aprobar Física I con nota mínima 4.0 |
| description | string | Descripción | Enfocarme en ejercicios de dinámica |
| targetDate | string (date) | Fecha objetivo | 2026-08-01 |
| progress | number | Progreso (0-100) | 65 |
| status | enum | active / completed / paused | active |

**Responses:** `200`

##### `DELETE /ai/goals/:id`
Eliminar meta de aprendizaje.

**Responses:** `200`

#### Teacher Profiles

##### `GET /ai/teacher-profiles`
Listar perfiles de profesor IA (sistema + personalizados).

**Responses:** `200`

##### `POST /ai/teacher-profiles`
Crear perfil de profesor IA personalizado.

**Request Body:**
| Campo | Tipo | Requerido | Ejemplo |
|-------|------|-----------|---------|
| code | string | sí | BIOLOGY_TEACHER |
| name | string | sí | Profesor de Biología |
| description | string | no | Explica procesos biológicos con ejemplos visuales |
| subjects | string[] | no | ["biología", "genética"] |
| systemPrompt | string | sí | Eres un profesor de biología: usa analogías... |
| teachingStyle | string | no | visual |
| difficultyLevel | string | no | medium |
| active | boolean | no | true |

**Responses:** `201`

##### `PATCH /ai/teacher-profiles/:id`
Actualizar perfil de profesor IA personalizado.

**Request Body:** Mismos campos que creación, todos opcionales.

**Responses:** `200`

#### Conversaciones

##### `POST /ai/conversations`
Crear conversación vacía para el usuario.

**Responses:** `201` Conversación creada correctamente

##### `GET /ai/conversations`
Listar conversaciones del usuario (paginado).

**Query Params:** `page` (default: 1), `limit` (default: 20), `sortBy` (default: lastMessageAt), `order` (default: desc)

**Response `200`:**
```json
{
  "conversations": [
    {
      "_id": "64f1a2b3c4d5e6f789012345",
      "userId": 1,
      "teacherId": "default-teacher",
      "lastMessageAt": "2026-06-23T12:00:00.000Z",
      "createdAt": "2026-06-20T08:00:00.000Z"
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 20
}
```

##### `GET /ai/conversations/:id`
Obtener conversación y sus mensajes.

**Responses:** `200` / `404`

##### `DELETE /ai/conversations/:id`
Eliminar conversación y sus mensajes.

**Responses:** `200`

##### `GET /ai/conversations/:id/messages`
Obtener mensajes de una conversación.

**Responses:** `200`

#### Knowledge Gaps

##### `GET /ai/knowledge-gaps`
Listar knowledge gaps detectados.

**Responses:** `200`

##### `GET /ai/knowledge-gaps/:subject`
Listar knowledge gaps por materia.

**Responses:** `200`

##### `PATCH /ai/knowledge-gaps/:id`
Actualizar estado de un knowledge gap.

**Request Body:**
| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| status | string | Estado del gap | IN_PROGRESS |
| confidence | number | Nivel de confianza (0-1) | 0.75 |
| evidence | string[] | Evidencias asociadas | ["memory:64f1a2b3c4d5e6f789012345", "messages:token:derivada"] |

**Responses:** `200`

---

### Roadmaps (`/roadmaps`)

Todas requieren `Bearer JWT`.

##### `POST /roadmaps/generate`
Generar roadmap con IA a partir de skills faltantes.

**Request Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| jobId | number | no | ID de la vacante (para missing skills del caché) |
| targetRole | string | no | Rol objetivo (si no se usa jobId) |
| missingSkills | string[] | no | Skills faltantes (si no se usa jobId) |

**Responses:** `201` Roadmap generado exitosamente / `400` Datos inválidos

##### `GET /roadmaps`
Listar roadmaps del usuario.

**Responses:** `200` Lista de roadmaps del usuario

##### `GET /roadmaps/:id`
Obtener detalle de un roadmap con sus pasos.

**Responses:** `200` Detalle del roadmap / `404` Roadmap no encontrado

##### `PATCH /roadmaps/steps/:stepId/complete`
Marcar paso de roadmap como completado.

**Responses:** `200` Paso marcado como completado / `404` Paso no encontrado

---

### Resume Analyzer (`/resume-analyzer`)

Todas requieren `Bearer JWT`.

##### `POST /resume-analyzer/analyze`
Analizar CV desde archivo subido (PDF/DOCX). Multipart form-data con campo `file`.

**Responses:** `201` CV analizado exitosamente / `400` Archivo no subido o formato inválido

##### `POST /resume-analyzer/analyze-profile`
Analizar CV desde el perfil existente del usuario.

**Responses:** `201` Perfil analizado exitosamente / `404` Perfil no encontrado

---

### Study Groups (`/groups`)

Todas requieren `Bearer JWT`.

##### `POST /groups`
Crear grupo de estudio.

**Request Body:**
| Campo | Tipo | Requerido | Descripción | Default |
|-------|------|-----------|-------------|---------|
| name | string | sí | Nombre del grupo | — |
| description | string | no | Descripción | — |
| subjectId | number | no | ID de la materia asociada | — |
| maxMembers | number | no | Máximo de miembros | 20 |
| isPublic | boolean | no | Grupo público | true |

**Responses:** `201` Grupo creado exitosamente / `400` Datos inválidos

##### `GET /groups`
Listar grupos públicos (paginado).

**Query Params:** `page` (default: 1), `limit` (default: 20), `sortBy` (default: createdAt), `order` (default: desc)

**Response `200`:**
```json
{
  "groups": [...],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

##### `GET /groups/my`
Grupos del usuario.

**Responses:** `200` Grupos del usuario

##### `GET /groups/recommended`
Grupos recomendados según perfil académico (usa Knowledge Gaps + Learning Goals + materias).

**Responses:** `200` Grupos recomendados por IA

##### `GET /groups/:id`
Detalle del grupo con miembros y sesiones.

**Responses:** `200` Detalle del grupo / `404` Grupo no encontrado

##### `POST /groups/:id/join`
Unirse al grupo.

**Responses:** `200` Unido al grupo exitosamente / `400` Ya eres miembro o grupo lleno / `404` Grupo no encontrado

##### `POST /groups/:id/leave`
Salirse del grupo.

**Responses:** `200` Saliste del grupo / `400` No eres miembro del grupo / `404` Grupo no encontrado

##### `POST /groups/:id/sessions`
Crear sesión de estudio.

**Request Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| title | string | sí | Título de la sesión |
| description | string | no | Descripción |
| startAt | string (ISO) | sí | Fecha y hora de inicio |
| endAt | string (ISO) | sí | Fecha y hora de fin |

**Responses:** `201` Sesión creada / `404` Grupo no encontrado

##### `GET /groups/:id/sessions`
Listar sesiones del grupo.

**Responses:** `200` Sesiones del grupo / `404` Grupo no encontrado

---

### Notifications (`/notifications`)

Todas requieren `Bearer JWT`.

##### `GET /notifications`
Listar notificaciones del usuario (paginado).

**Query Params:** `page` (default: 1), `limit` (default: 50), `sortBy` (default: createdAt), `order` (default: desc)

**Response `200`:**
```json
{
  "notifications": [
    {
      "id": 1,
      "title": "Tarea próxima a vencer",
      "message": "La tarea 'Resolver taller de límites' vence en 24 horas",
      "type": "TASK_DUE",
      "read": false,
      "createdAt": "2026-06-23T10:00:00.000Z"
    }
  ],
  "total": 8,
  "unreadCount": 3,
  "page": 1,
  "limit": 50
}
```

##### `GET /notifications/unread-count`
Contar notificaciones no leídas.

**Responses:** `200` Conteo de no leídas

##### `PATCH /notifications/:id/read`
Marcar notificación como leída.

**Responses:** `200` Notificación marcada como leída / `404` Notificación no encontrada

##### `PATCH /notifications/read-all`
Marcar todas las notificaciones como leídas.

**Responses:** `200` Todas marcadas como leídas

**Tipos de Notificación (`NotificationType`):**
`TASK_DUE`, `CLASS_REMINDER`, `ROADMAP_REMINDER`, `GROUP_SESSION`, `JOB_MATCH`, `INTERVIEW`, `KNOWLEDGE_GAP`, `EXAM_ALERT`, `STREAK_RISK`

**Cron Jobs:**

| Job | Frecuencia | Disparador |
|-----|-----------|------------|
| TaskReminder | Cada hora | Tareas que vencen en 24h |
| ClassReminder | Cada 30 min | Clase inicia en 30 min |
| RoadmapReminder | Diario (medianoche) | Roadmap sin progreso > 7 días |
| GroupSessionReminder | Cada hora | Sesión grupal en 1 hora |
| StreakReminder | Diario (medianoche) | Racha en riesgo |

---

### Academic Risk (`/risk`)

Todas requieren `Bearer JWT`.

##### `GET /risk`
Último análisis de riesgo académico del usuario.

**Responses:** `200` Último análisis de riesgo / `404` Sin análisis previo

##### `GET /risk/history`
Historial de análisis de riesgo.

**Responses:** `200` Historial de análisis

##### `GET /risk/subjects`
Riesgo por materia.

**Responses:** `200` Riesgo por materia

##### `GET /risk/subjects/:subjectId`
Riesgo de materia específica.

**Responses:** `200` Riesgo de materia específica / `404` Materia no encontrada

##### `POST /risk/recalculate`
Recalcular riesgo académico.

**Responses:** `201` Riesgo recalculado exitosamente

**Fórmula ponderada:**
- Knowledge Gaps: **30%**
- Tareas vencidas: **25%**
- Confianza IA: **20%**
- Progreso en roadmaps: **15%**
- Engagement: **10%**

**Niveles de riesgo:** `LOW` (0-39), `MEDIUM` (40-69), `HIGH` (≥70)

**Intervención automática (score ≥ 80):**
- Crea un Learning Goal de recuperación en MongoDB
- Genera un Study Plan personalizado de 7 días con IA
- Genera Exam Tips con consejos de preparación vía Groq
- Dispara notificación tipo `EXAM_ALERT` con metadata del plan generado

---

## Modelos de Datos

### PostgreSQL (Prisma)

**User** — Usuarios del sistema
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | Int (PK) | ID autogenerado |
| email | String (único) | Correo electrónico |
| password | String | Contraseña hasheada |
| nombre | String | Nombre |
| apellido | String | Apellido |
| emailVerified | Boolean | Email verificado |
| verificationCode | String? | Código de verificación |
| googleId | String? | ID de Google OAuth |
| foto | String? | Foto de perfil |
| banner | String? | Banner de perfil |
| ciudad | String? | Ciudad |
| pais | String? | País |
| fechaNacimiento | DateTime? | Fecha de nacimiento |
| biografia | String? | Biografía |
| github | String? | GitHub |
| linkedin | String? | LinkedIn |
| portafolio | String? | Portafolio |
| paginaPersonal | String? | Página personal |
| twofaSecret | String? | Secreto 2FA |
| twofaEnabled | Boolean | 2FA habilitado |
| createdAt | DateTime | Fecha de creación |
| updatedAt | DateTime | Fecha de actualización |

**ProfileAcademic** — Perfil académico
| Campo | Tipo |
|-------|------|
| id | Int (PK) |
| userId | Int (FK → User) |
| universidad, carrera, facultad, semestreActual, fechaInicio, fechaGraduacion, modalidad, promedio, materiasFav, materiasDificil | Varios |

**ProfileProfessional** — Perfil profesional
| Campo | Tipo |
|-------|------|
| id, userId, cargoDeseado, nivelActual, disponibilidad, modalidadDeseada | Varios |

**Subject** — Materias
| Campo | Tipo |
|-------|------|
| id, userId (FK), nombre, codigo, profesor, salon, creditos, color, descripcion | Varios |

**Schedule** — Horarios
| Campo | Tipo |
|-------|------|
| id, subjectId (FK), dayOfWeek, startTime, endTime, classroom | Varios |

**Task** — Tareas
| Campo | Tipo |
|-------|------|
| id, subjectId (FK), title, description, priority (enum), dueDate, completed | Varios |

**Note** — Notas
| Campo | Tipo |
|-------|------|
| id, subjectId (FK), title, content, isPinned | Varios |

**Resume** — Currículum Vitae
| Campo | Tipo |
|-------|------|
| id, userId (FK), titulo, resumen, slug | Varios |

**Experience, Education, Project, Certificate, Language** — Sub-entidades de Resume, todas con resumeId (FK)

**Job** — Empleos
| Campo | Tipo |
|-------|------|
| id, title, company, description, location, salaryMin, salaryMax, contractType, isRemote, requirements, responsibilities, benefits, category, isActive, postedAt | Varios |

**SavedJob, JobApplication** — Guardados y postulaciones

**Roadmap** — Roadmap con pasos
| Campo | Tipo |
|-------|------|
| id, userId (FK), targetRole, totalSteps, completedSteps, progress | Varios |

**RoadmapStep** — Paso de roadmap
| Campo | Tipo |
|-------|------|
| id, roadmapId (FK), title, description, order, resources, completed | Varios |

**StudyGroup** — Grupo de estudio
| Campo | Tipo |
|-------|------|
| id, creatorId (FK→User), name, description, subjectId (FK→Subject), maxMembers, isPublic | Varios |

**StudyGroupMember** — Miembro del grupo
| Campo | Tipo |
|-------|------|
| id, groupId (FK), userId (FK), role (MEMBER/ADMIN) | Varios |

**StudyGroupSession** — Sesión de estudio
| Campo | Tipo |
|-------|------|
| id, groupId (FK), title, description, startAt, endAt | Varios |

**Notification** — Notificación
| Campo | Tipo |
|-------|------|
| id, userId (FK), title, message, type (NotificationType), read, metadata (Json?) | Varios |

**AcademicRisk** — Riesgo académico
| Campo | Tipo |
|-------|------|
| id, userId (FK), score, level (LOW/MEDIUM/HIGH), reasons (Json), createdAt | Varios |

### MongoDB

- **Conversations** / **Messages** — Chat con IA
- **StudentMemory** — Memoria de largo plazo del estudiante
- **KnowledgeGap** — Gaps de conocimiento detectados
- **LearningGoal** — Metas de aprendizaje
- **Analytics** — Datos de analytics
- **StudentModel** — Modelo del estudiante
- **GeneratedResource** — Recursos generados por IA

---

## Instalación

```bash
pnpm install
```

## Configuración

```env
DATABASE_URL=postgresql://user:password@localhost:5432/studyhub
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net
MONGODB_DB=StudyHub
JWT_SECRET=your-secret
GROQ_API_KEY=your-groq-key
GROQ_MODEL=openai/gpt-oss-120b
```

## Ejecución

```bash
pnpm run start:dev      # Desarrollo con hot-reload
pnpm run build          # Compilar a JavaScript
pnpm run start:prod     # Producción
```

## Swagger UI

Una vez ejecutando el servidor, la documentación interactiva (con ejemplos de respuesta, schemas y try-it-out) está disponible en:

```
http://localhost:3000/api
```

## ¿Por qué StudyHub?

StudyHub no es solo un API más — está diseñado **para estudiantes universitarios** por desarrolladores que entienden la vida académica:

- **Dashboard** que muestra tu progreso, clases del día, tareas pendientes y notas recientes en una sola llamada
- **Profesor IA** que se adapta a tu estilo de aprendizaje, detecta tus gaps de conocimiento y genera recursos personalizados
- **Academic Risk**: predicción temprana de riesgo académico con intervención automática (score >= 80 crea learning goals + study plans)
- **Knowledge Gaps**: detección híbrida (memoria + mensajes) de qué temas no dominas
- **Roadmaps** generados por IA para guiarte paso a paso hacia tu objetivo profesional
- **Grupos de estudio** con recomendación inteligente basada en gaps, metas y materias en común
- **Gamificación**: XP, niveles, rachas y logros para mantenerte motivado
- **CV Builder** con PDF y analizador IA — porque encontrar prácticas/empleo también es parte de la vida universitaria

## Base de Datos

```bash
npx prisma generate    # Generar cliente Prisma
npx prisma db push     # Sincronizar schema con BD (dev)
npx prisma migrate dev # Migración controlada
```
