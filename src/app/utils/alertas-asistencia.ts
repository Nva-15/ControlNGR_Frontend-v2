import { AlertaAsistencia, TipoAlerta } from '../interfaces/reportes-asistencia';
import { minutosTexto } from './estados-asistencia';

/** Cómo se presenta y configura cada alerta de asistencia. */
export const ALERTAS_ASISTENCIA: Record<TipoAlerta, { titulo: string; ayuda: string; unidad: string; icono: string; clase: string; conPeriodo: boolean }> = {
  FALTAS_SEGUIDAS: { titulo: 'Faltas seguidas', ayuda: 'Días laborales consecutivos sin marcar en el mes (los descansos y vacaciones no cortan la racha). Permite actuar rápido ante un posible abandono o problema.', unidad: 'días seguidos', icono: 'bi-exclamation-octagon', clase: 'text-red-700', conPeriodo: false },
  FALTAS: { titulo: 'Faltas', ayuda: 'Días laborales sin marcar en el período.', unidad: 'faltas o más', icono: 'bi-x-octagon', clase: 'text-red-700', conPeriodo: true },
  TARDANZAS: { titulo: 'Tardanzas', ayuda: 'Entradas después de la tolerancia en el período.', unidad: 'tardanzas o más', icono: 'bi-clock', clase: 'text-amber-700', conPeriodo: true },
  MINUTOS_TARDE: { titulo: 'Tiempo de tardanza', ayuda: 'Minutos de tardanza acumulados en el período: detecta pocas tardanzas pero largas.', unidad: 'min o más', icono: 'bi-hourglass-split', clase: 'text-amber-700', conPeriodo: true },
  SALIDAS_AUTOMATICAS: { titulo: 'Salidas automáticas', ayuda: 'Veces que no marcó su salida y el sistema la registró solo.', unidad: 'o más', icono: 'bi-box-arrow-right', clase: 'text-sky-700', conPeriodo: true }
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function periodoTexto(a: AlertaAsistencia): string {
  return a.periodo === 'SEMANA' ? 'esta semana' : `en ${MESES[Number(a.desde.substring(5, 7)) - 1]}`;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** "4 tardanzas en octubre (prom. 18 min)". */
export function mensajeAlerta(a: AlertaAsistencia): string {
  const det = a.detalle ? ` (${a.detalle})` : '';
  switch (a.tipo) {
    case 'FALTAS_SEGUIDAS': {
      const hasta = a.detalle?.replace('hasta el ', '') ?? '';
      return `${a.valor} faltas seguidas${hasta ? ' hasta el ' + hasta.split('-').reverse().join('/') : ''}`;
    }
    case 'FALTAS': return `${plural(a.valor, 'falta', 'faltas')} ${periodoTexto(a)}`;
    case 'TARDANZAS': return `${plural(a.valor, 'tardanza', 'tardanzas')} ${periodoTexto(a)}${det}`;
    case 'MINUTOS_TARDE': return `${minutosTexto(a.valor)} de tardanza acumulada ${periodoTexto(a)}${det}`;
    case 'SALIDAS_AUTOMATICAS': return `${plural(a.valor, 'salida automática', 'salidas automáticas')} ${periodoTexto(a)}`;
  }
}
