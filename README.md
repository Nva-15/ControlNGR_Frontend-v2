# Control NGR - Frontend

Angular 20 · Tailwind CSS 4 · diseño con los colores del logo NGR (vino, coral, naranja y dorado).

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

- sirve la aplicación compilada;
- reenvía `/api` e `/img` al backend (que no se publica fuera de Docker);
- envía la IP real del cliente al backend para validar los segmentos de red;
- agrega cabeceras de seguridad (CSP estricta, `X-Frame-Options`, `nosniff`, etc.).

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/app/components` | Pantallas: dashboard, solicitudes, saldos, perfil, horarios, eventos, empleados, organigrama, reportes y `admin/` (panel maestro) |
| `src/app/components/shared` | Modal, confirmación, notificaciones, avatar y logo |
| `src/app/services` | Llamadas a la API (`auth`, `solicitudes`, `saldos`, `admin`, …) |
| `src/app/guards` | Acceso por sesión, cambio obligatorio de contraseña, personal, gestión y admin |
| `src/app/utils` | Roles, formatos de fecha (siempre en hora de Lima) y utilidades |
| `src/styles.css` | Tema de Tailwind y clases de componentes (`btn-*`, `card`, `input`, `badge-*`, …) |
| `docker/` | Configuración de nginx |

## Roles

| Rol | Ve |
|---|---|
| `admin` | Panel maestro (saldos, usuarios, red, feriados, departamentos, roles, catálogos, parámetros), empleados, horarios y organigrama |
| `director`, `gerente`, `jefe`, `supervisor`, `gestor` | Todo lo del personal más empleados y reportes, y aprueban solicitudes según las reglas de aprobación |
| Resto del personal | Inicio (marcación), solicitudes, saldos, horarios, eventos y organigrama |
