/** Estados del resumen diario de asistencia: etiqueta, ícono y color (los de estado nunca van solos: siempre con ícono y texto). */
export interface EstadoAsistencia { etiqueta: string; icono: string; color: string; }

/** Colores de estado reservados (bien / alerta / crítico) y neutros para días no laborables. */
export const COLOR_A_TIEMPO = '#0ca30c';
export const COLOR_TARDANZA = '#fab219';
export const COLOR_FALTA = '#d03b3b';
export const COLOR_AUSENCIA = '#3987e5';
export const COLOR_NO_LABORABLE = '#d6d3d1';

export const ESTADOS_ASISTENCIA: Record<string, EstadoAsistencia> = {
  a_tiempo: { etiqueta: 'A tiempo', icono: 'bi-check-lg', color: COLOR_A_TIEMPO },
  tardanza: { etiqueta: 'Tardanza', icono: 'bi-clock', color: COLOR_TARDANZA },
  falta: { etiqueta: 'Falta', icono: 'bi-x-lg', color: COLOR_FALTA },
  pendiente: { etiqueta: 'Pendiente', icono: 'bi-hourglass', color: '#f0efec' },
  permiso: { etiqueta: 'Permiso', icono: 'bi-person-check', color: COLOR_AUSENCIA },
  vacaciones: { etiqueta: 'Vacaciones', icono: 'bi-sun', color: COLOR_AUSENCIA },
  descanso_medico: { etiqueta: 'Descanso médico', icono: 'bi-heart-pulse', color: COLOR_AUSENCIA },
  licencia: { etiqueta: 'Licencia', icono: 'bi-file-earmark-text', color: COLOR_AUSENCIA },
  compensado: { etiqueta: 'Compensado', icono: 'bi-calendar-check', color: COLOR_AUSENCIA },
  descanso: { etiqueta: 'Descanso', icono: 'bi-moon-stars', color: COLOR_NO_LABORABLE },
  descanso_feriado: { etiqueta: 'Descanso feriado', icono: 'bi-calendar-heart', color: COLOR_NO_LABORABLE },
  asistio: { etiqueta: 'Asistió (sin horario)', icono: 'bi-check2', color: '#86b6ef' }
};

export function estadoAsistencia(estado: string): EstadoAsistencia {
  return ESTADOS_ASISTENCIA[estado] ?? { etiqueta: estado, icono: 'bi-dot', color: COLOR_NO_LABORABLE };
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** "2026-03" → "Mar 26". */
export function etiquetaMes(mes: string): string {
  const [a, m] = mes.split('-');
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
}

/** 75 → "1 h 15 min"; 40 → "40 min". */
export function minutosTexto(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
}

/** -4 → "4 min antes"; 6 → "6 min tarde". */
export function llegadaTexto(dif: number | null | undefined): string {
  if (dif === null || dif === undefined) return '—';
  if (dif === 0) return 'puntual';
  return dif < 0 ? `${-dif} min antes` : `${dif} min tarde`;
}

/** "2026-10-27" → "27/10/2026". */
export function fechaCorta(iso: string | null | undefined): string {
  return iso ? iso.split('-').reverse().join('/') : '—';
}
