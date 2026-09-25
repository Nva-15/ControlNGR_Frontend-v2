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

/** Mismo criterio que el backend (Roles.puedeAdministrar). */
export function puedeAdministrar(rolEditor?: string | null, rolObjetivo?: string | null): boolean {
  const editor = (rolEditor || '').toLowerCase();
  const objetivo = (rolObjetivo || '').toLowerCase();
  if (editor === ROLES.ADMIN || esGerencia(editor)) return true;
  if (editor === ROLES.SUPERVISOR) return (OPERATIVOS as string[]).includes(objetivo);
  if (editor === ROLES.GESTOR) return objetivo === ROLES.ASISTENTE;
  return false;
}

/** Clase de insignia por rol. */
export function rolBadge(rol?: string | null): string {
  const r = (rol || '').toLowerCase();
  if (r === ROLES.ADMIN) return 'badge-gray';
  if (esGerencia(r)) return 'badge-vino';
  if (r === ROLES.SUPERVISOR || r === ROLES.GESTOR) return 'badge-oro';
  return 'badge-blue';
}
