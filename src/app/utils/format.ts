/** Utilidades de formato y URLs compartidas por las pantallas. */

/** Iniciales para avatares sin foto (no depende de servicios externos). */
export function iniciales(nombre?: string | null): string {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length > 2 ? 2 : 1][0] : '')).toUpperCase();
}

/** URL de la foto de perfil (null si usa la predeterminada). */
export function fotoUrl(baseUrl: string, foto?: string | null): string | null {
  if (!foto || foto === 'img/perfil.png') return null;
  if (foto.startsWith('http')) return foto;
  return `${baseUrl}/${foto.replace(/^\//, '')}`;
}

/** Zona horaria de la empresa: todas las fechas se muestran en hora de Lima. */
export const ZONA = 'America/Lima';

/** Fecha ISO (yyyy-MM-dd) de hoy en Lima, sin importar la zona del equipo. */
export function hoyIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** Indice del dia de la semana en Lima: 0 = lunes ... 6 = domingo. */
export function diaSemanaLima(fecha = new Date()): number {
  const corto = fecha.toLocaleDateString('en-US', { weekday: 'short', timeZone: ZONA });
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(corto);
}

/** "2026-10-05" -> "05/10/2026" sin problemas de zona horaria. */
export function fechaCorta(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.substring(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export function horaCorta(hora?: string | null): string {
  return hora ? hora.substring(0, 5) : '--:--';
}

/** Mensaje de error legible de una respuesta HTTP o un string. */
export function mensajeError(e: any, porDefecto = 'Ocurrió un error inesperado'): string {
  if (!e) return porDefecto;
  if (typeof e === 'string') return e;
  return e.error?.error || e.error?.message || (typeof e.error === 'string' ? e.error : null) || e.message || porDefecto;
}

/** Numero de dias sin decimales innecesarios (2.0 -> "2", 1.5 -> "1.5"). */
export function dias(valor?: number | null): string {
  if (valor === null || valor === undefined) return '0';
  return Number.isInteger(+valor) ? String(+valor) : (+valor).toFixed(1);
}
