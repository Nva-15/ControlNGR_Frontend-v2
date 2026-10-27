/** Duraciones con las que se calcula la salida y el refrigerio al armar un horario (parámetros del panel admin). */
export interface ConfigTurnos {
  jornadaMananaHoras: number;
  jornadaTardeHoras: number;
  refrigerioDespuesHoras: number;
  refrigerioMinutos: number;
}

export const CONFIG_TURNOS_DEFECTO: ConfigTurnos = {
  jornadaMananaHoras: 9,
  jornadaTardeHoras: 8,
  refrigerioDespuesHoras: 4,
  refrigerioMinutos: 60
};

const DIA = 24 * 60;

/** "08:30" → 510 (minutos desde la medianoche); vacío o inválido → null. */
export function aMinutos(hora: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora || '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 510 → "08:30"; pasa la medianoche (1500 → "01:00"). */
export function deMinutos(minutos: number): string {
  const m = ((Math.round(minutos) % DIA) + DIA) % DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Salida = entrada + jornada del turno (mañana incluye el refrigerio; tarde no tiene). */
export function salidaSugerida(entrada: string, turno: string, cfg: ConfigTurnos): string {
  const e = aMinutos(entrada);
  if (e === null) return '';
  const horas = turno === 'tarde' ? cfg.jornadaTardeHoras : cfg.jornadaMananaHoras;
  return deMinutos(e + horas * 60);
}

/** Refrigerio del turno mañana: empieza N horas después de la entrada. */
export function refrigerioSugerido(entrada: string, cfg: ConfigTurnos): { inicio: string; fin: string } {
  const e = aMinutos(entrada);
  if (e === null) return { inicio: '', fin: '' };
  const inicio = e + cfg.refrigerioDespuesHoras * 60;
  return { inicio: deMinutos(inicio), fin: deMinutos(inicio + cfg.refrigerioMinutos) };
}

/** Minutos entre dos horas; si la salida es menor, el turno pasa la medianoche. */
export function duracionMinutos(desde: string, hasta: string): number | null {
  const a = aMinutos(desde);
  const b = aMinutos(hasta);
  if (a === null || b === null) return null;
  return ((b - a) % DIA + DIA) % DIA;
}

/** 480 → "8 h"; 510 → "8 h 30 min". */
export function formatoHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? (h ? `${h} h ${m} min` : `${m} min`) : `${h} h`;
}

/** "9 h (8 h de trabajo + 1 h de refrigerio)", "8 h de trabajo"; vacío si faltan horas. */
export function textoJornada(entrada: string, salida: string, turno: string, almInicio?: string, almFin?: string): string {
  const total = duracionMinutos(entrada, salida);
  if (!total) return '';
  const refrigerio = turno === 'tarde' ? 0 : (duracionMinutos(almInicio || '', almFin || '') ?? 0);
  if (!refrigerio) return `${formatoHoras(total)} de trabajo`;
  const trabajo = Math.max(total - refrigerio, 0);
  return `${formatoHoras(total)} (${formatoHoras(trabajo)} de trabajo + ${formatoHoras(refrigerio)} de refrigerio)`;
}
