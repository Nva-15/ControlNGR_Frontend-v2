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
}

export interface MesAsistencia extends ConteoAsistencia { mes: string; }
export interface EquipoAsistencia extends ConteoAsistencia { departamentoId: number | null; nombre: string; }
export interface ColaboradorAsistencia extends ConteoAsistencia {
  empleadoId: number;
  nombre: string;
  departamento: string | null;
  ingreso: string | null;
  activo: boolean;
  /** Puntos de puntualidad de los últimos 30 días frente al resto del período. */
  tendencia: number | null;
}

export interface DashboardAsistencia {
  desde: string;
  hasta: string;
  anteriorDesde: string;
  anteriorHasta: string;
  toleranciaMinutos: number;
  departamentoForzado: number | null;
  kpis: ConteoAsistencia;
  kpisAnterior: ConteoAsistencia;
  porMes: MesAsistencia[];
  llegadas: { rango: string; cantidad: number; tarde: boolean }[];
  mapaTardanzas: { dia: number; hora: number; tardanzas: number; entradas: number }[];
  porEquipo: EquipoAsistencia[];
  colaboradores: ColaboradorAsistencia[];
  actualizado: string | null;
}

export interface FiltroDashboard {
  desde: string;
  hasta: string;
  departamentoId?: number | null;
  rol?: string;
  turno?: string;
  personal?: 'activos' | 'cesados' | 'todos';
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
