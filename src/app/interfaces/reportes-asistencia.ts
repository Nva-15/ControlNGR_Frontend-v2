/** Conteos de un período o grupo (dashboard y ficha). */
export interface ConteoAsistencia {
  aTiempo: number;
  tardanzas: number;
  faltas: number;
  permisos?: number;
  programados: number;
  minutosRetraso: number;
  promedioRetraso: number | null;
  salidasAutomaticas: number;
  puntualidad: number | null;
  asistencia: number | null;
  horas?: number | null;
  minutosTrabajados?: number;
  llegadaPromedio: number | null;
  personas?: number;
  /** Días con entrada marcada (con o sin horario). */
  diasMarcados?: number;
  /** Días que marcó sin horario programado ("Asistió"): no cuentan para puntualidad ni faltas. */
  diasSinHorario?: number;
  /** Minutos trabajados por encima de lo programado (desde 15 min por día). */
  minutosExtra?: number;
  /** Horas promedio por día (en minutos), solo días con salida marcada. */
  minutosPorDia?: number | null;
  entradaPromedio?: string | null;
  salidaPromedio?: string | null;
}

export interface MesAsistencia extends ConteoAsistencia { mes: string; }
export interface PuntoSerie extends ConteoAsistencia { clave: string; }
export interface FuncionAsistencia {
  funcion: string; aTiempo: number; tardanzas: number; faltas: number; programados: number;
  minutosRetraso: number; puntualidad: number | null; asistencia: number | null;
}

/** Un colaborador hoy: lo programado, lo marcado y su estado. */
export interface ColaboradorHoy {
  empleadoId: number;
  nombre: string;
  departamentoId: number | null;
  departamento: string;
  rol: string | null;
  estado: string;
  turno: string | null;
  funciones: string[];
  entradaProgramada: string | null;
  salidaProgramada: string | null;
  entrada: string | null;
  salida: string | null;
  minutosDiferencia: number | null;
  salidaAutomatica: boolean;
  enTurno: boolean;
}

export interface ConteoHoy {
  programados: number; aTiempo: number; tardanzas: number; faltas: number; porLlegar: number;
  enTurno: number; ausencias: number; descansos: number; sinHorario: number; puntualidad: number | null;
}

export interface HoyAsistencia {
  kpis: ConteoHoy;
  colaboradores: ColaboradorHoy[];
  porEquipo: (ConteoHoy & { departamentoId: number | null; nombre: string })[];
}
export interface EquipoAsistencia extends ConteoAsistencia { departamentoId: number | null; nombre: string; }
export interface ColaboradorAsistencia extends ConteoAsistencia {
  empleadoId: number;
  nombre: string;
  departamento: string | null;
  ingreso: string | null;
  activo: boolean;
  rol?: string | null;
  /** Puntos de puntualidad de los últimos 30 días frente al resto del período. */
  tendencia: number | null;
}

export interface DashboardAsistencia {
  desde: string;
  hasta: string;
  anteriorDesde: string;
  anteriorHasta: string;
  toleranciaMinutos: number;
  /** Roles que ve quien consulta (null = todos). */
  alcanceRoles: string[] | null;
  kpis: ConteoAsistencia;
  kpisAnterior: ConteoAsistencia;
  /** Solo cuando el período es hoy. */
  hoy?: HoyAsistencia;
  serie: { granularidad: 'dia' | 'semana' | 'mes'; puntos: PuntoSerie[] };
  llegadas: { rango: string; cantidad: number; tarde: boolean }[];
  mapaTardanzas: { dia: number; hora: number; tardanzas: number; entradas: number }[];
  porEquipo: EquipoAsistencia[];
  porFuncion: FuncionAsistencia[];
  colaboradores: ColaboradorAsistencia[];
  /** Semanas en borrador que tocan el período: sus turnos no cuentan hasta publicarlas. */
  semanasBorrador: { id: number; nombre: string | null; fechaInicio: string; fechaFin: string }[];
  actualizado: string | null;
}

export interface FiltroDashboard {
  desde: string;
  hasta: string;
  departamentoId?: number | null;
  rol?: string;
  turno?: string;
  funcion?: string;
  personal?: 'activos' | 'cesados' | 'todos';
}

export type TipoAlerta = 'FALTAS' | 'FALTAS_SEGUIDAS' | 'TARDANZAS' | 'MINUTOS_TARDE' | 'SALIDAS_AUTOMATICAS';

export interface AlertaAsistencia {
  tipo: TipoAlerta;
  periodo: 'MES' | 'SEMANA';
  empleadoId: number;
  nombre: string;
  departamento: string | null;
  valor: number;
  umbral: number;
  detalle: string | null;
  desde: string;
  hasta: string;
  nueva: boolean;
}

export interface ConfigAlerta {
  tipo: TipoAlerta;
  activa: boolean;
  umbral: number;
  periodo: 'MES' | 'SEMANA';
}

export interface DiaFicha {
  fecha: string;
  estado: string;
  turno: string | null;
  funciones: string[];
  entradaProgramada: string | null;
  salidaProgramada: string | null;
  entrada: string | null;
  salida: string | null;
  minutosDiferencia: number | null;
  minutosRetraso: number | null;
  salidaAutomatica: boolean;
  minutosTrabajados?: number | null;
}

export interface FichaAsistencia {
  empleado: { id: number; nombre: string; cargo: string | null; departamento: string | null; ingreso: string | null; activo: boolean; foto: string | null };
  desde: string;
  hasta: string;
  kpis: ConteoAsistencia & { ultimaFalta: string | null; ausencias: Record<string, number> };
  porMes: { mes: string; aTiempo: number; tardanzas: number; faltas: number; puntualidad: number | null }[];
  calendario: { fecha: string; estado: string }[];
  ultimas: DiaFicha[];
  propio?: boolean;
}
