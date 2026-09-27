# Control NGR - Frontend

Angular 20 · Tailwind CSS 4 · face-api.js · diseño con los colores del logo NGR (vino, coral, naranja y dorado).

La marcación de asistencia usa **reconocimiento facial**: `src/app/components/shared/camara-facial` abre la cámara, comprueba que sea una persona real (parpadeo) y calcula el descriptor del rostro con face-api.js (modelos locales en `public/models`, sin CDN). El backend hace la comparación. face-api.js se carga solo al abrir la cámara, para no hacer más pesada la carga inicial.

## Ejecutar en desarrollo

Requiere Node 22 y el backend corriendo en `http://localhost:8080`.

```bash
npm ci
npm start          # http://localhost:4200
```

## Producción (Docker)

El sistema completo (MySQL + backend + este frontend) se levanta desde el repositorio del backend:

```
carpeta/
├── ControlNGR_Backend-v2/    ← docker compose up -d --build
└── ControlNGR_Frontend-v2/
```

Este repositorio aporta la imagen `nginx`, que:

- sirve la aplicación compilada **por HTTPS** (`http://` redirige a `https://`);
- genera al iniciar un certificado con una autoridad local "Control NGR CA" (`docker/05-certificado.sh`) si TI no entrega uno; `ca.crt` se importa una vez en cada PC;
- reenvía `/api` e `/img` al backend (que no se publica fuera de Docker);
- envía la IP real del cliente al backend para validar los segmentos de red;
- agrega cabeceras de seguridad (CSP estricta, `X-Frame-Options`, `nosniff`, `Permissions-Policy` que solo permite la cámara al propio sitio, etc.).

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/app/components` | Pantallas: dashboard, solicitudes, saldos, perfil, horarios, eventos, empleados, organigrama, reportes y `admin/` (panel maestro) |
| `src/app/components/shared` | Modal, confirmación, notificaciones, avatar, logo y `camara-facial` (captura del rostro) |
| `public/models` | Modelos de face-api.js (detector, puntos del rostro y reconocimiento) |
| `src/app/services` | Llamadas a la API (`auth`, `solicitudes`, `saldos`, `admin`, …) |
| `src/app/guards` | Acceso por sesión, cambio obligatorio de contraseña, personal, gestión y admin |
| `src/app/utils` | Roles, formatos de fecha (siempre en hora de Lima) y utilidades |
| `src/styles.css` | Tema de Tailwind y clases de componentes (`btn-*`, `card`, `input`, `badge-*`, …) |
| `docker/` | Configuración de nginx, cabeceras de seguridad y generación del certificado HTTPS |

## Roles

| Rol | Ve |
|---|---|
| `admin` | Panel maestro (saldos, usuarios, red, feriados, departamentos, roles, catálogos, parámetros), empleados, horarios y organigrama |
| `director`, `gerente`, `jefe`, `supervisor`, `gestor` | Todo lo del personal más empleados y reportes, y aprueban solicitudes según las reglas de aprobación |
| Resto del personal | Inicio (marcación), solicitudes, saldos, horarios, eventos y organigrama |
