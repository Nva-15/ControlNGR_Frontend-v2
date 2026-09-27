/** Codigos de rol del backend (tabla tipos_usuario). */
export const ROLES = {
  ADMIN: 'admin',
  DIRECTOR: 'director',
  GERENTE: 'gerente',
  JEFE: 'jefe',
  SUPERVISOR: 'supervisor',
  GESTOR: 'gestor',
  TECNICO: 'tecnico',
  HD: 'hd',
  NOC: 'noc',
  BO: 'bo',
  ASISTENTE: 'asistente',
} as const;

/** Alta direccion (reemplaza al antiguo rol "admin" en la gestion diaria). */
export const GERENCIA = [ROLES.DIRECTOR, ROLES.GERENTE, ROLES.JEFE];
/** Personal a cargo de los supervisores. */
export const OPERATIVOS = [ROLES.TECNICO, ROLES.HD, ROLES.NOC, ROLES.BO];
/** Roles con personal a cargo: gestionan horarios, eventos y empleados. */
export const GESTION = [...GERENCIA, ROLES.SUPERVISOR, ROLES.GESTOR];
/** Todo el personal (todos menos admin). */
export const PERSONAL = [...GESTION, ...OPERATIVOS, ROLES.ASISTENTE];

export const ROL_LABELS: Record<string, string> = {
  admin: 'Administrador del sistema',
  director: 'Director',
  gerente: 'Gerente',
  jefe: 'Jefe',
  supervisor: 'Supervisor',
  gestor: 'Gestor',
  tecnico: 'Técnico',
  hd: 'Help Desk',
  noc: 'NOC',
  bo: 'Back Office',
  asistente: 'Asistente',
};

export function rolLabel(rol?: string | null): string {
  if (!rol) return 'Sin rol';
  return ROL_LABELS[rol.toLowerCase()] ?? rol;
}

export function esGerencia(rol?: string | null): boolean {
  return !!rol && (GERENCIA as string[]).includes(rol.toLowerCase());
}

export function esGestion(rol?: string | null): boolean {
  return !!rol && (GESTION as string[]).includes(rol.toLowerCase());
}

/** Rango dentro de gerencia: director 3, gerente 2, jefe 1, el resto 0 (igual que el backend). */
export function rango(rol?: string | null): number {
  switch ((rol || '').toLowerCase()) {
    case ROLES.DIRECTOR: return 3;
    case ROLES.GERENTE: return 2;
    case ROLES.JEFE: return 1;
    default: return 0;
  }
}

/** Mismo criterio que el backend (Roles.puedeAdministrar): la gerencia solo administra rangos inferiores. */
export function puedeAdministrar(rolEditor?: string | null, rolObjetivo?: string | null): boolean {
  const editor = (rolEditor || '').toLowerCase();
  const objetivo = (rolObjetivo || '').toLowerCase();
  if (editor === ROLES.ADMIN) return true;
  if (esGerencia(editor)) return objetivo !== ROLES.ADMIN && rango(objetivo) < rango(editor);
  if (editor === ROLES.SUPERVISOR) return (OPERATIVOS as string[]).includes(objetivo);
  if (editor === ROLES.GESTOR) return objetivo === ROLES.ASISTENTE;
  return false;
}

/** Mismo criterio que el backend (Roles.puedeAsignarRol). */
export function puedeAsignarRol(rolEditor?: string | null, rolNuevo?: string | null): boolean {
  if ((rolEditor || '').toLowerCase() === ROLES.ADMIN) return true;
  return esGerencia(rolEditor) && rango(rolNuevo) < rango(rolEditor);
}

/** Clase de insignia por rol. */
export function rolBadge(rol?: string | null): string {
  const r = (rol || '').toLowerCase();
  if (r === ROLES.ADMIN) return 'badge-gray';
  if (esGerencia(r)) return 'badge-vino';
  if (r === ROLES.SUPERVISOR || r === ROLES.GESTOR) return 'badge-oro';
  return 'badge-blue';
}
