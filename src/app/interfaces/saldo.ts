export type TipoSaldo = 'VACACIONES' | 'COMPENSACION';

export interface SaldoResumen {
  tipo: TipoSaldo;
  saldo: number;
  /** Dias comprometidos en solicitudes pendientes. */
  pendiente: number;
  /** Saldo menos pendientes: lo que puede solicitar. */
  disponible: number;
}

export interface MovimientoSaldo {
  id: number;
  empleadoId: number;
  tipoSaldo: TipoSaldo;
  tipoMovimiento: 'ABONO' | 'CARGO' | 'REVERSION' | 'AJUSTE' | 'CARGA_INICIAL';
  dias: number;
  saldoResultante: number;
  origen: 'FERIADO_LABORADO' | 'PERIODO_VACACIONAL' | 'SOLICITUD' | 'PANEL_ADMIN';
  observacion?: string;
  solicitudId?: number;
  feriadoLaboradoId?: number;
  periodoVacacionalId?: number;
  registradoPor: string;
  fecha: string;
}

export interface FeriadoLaborado {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  fecha: string;
  feriado: string;
  diasOtorgados: number;
  estado: 'ABONADO' | 'REVERTIDO';
  observacion?: string;
}

export interface PeriodoVacacional {
  id: number;
  periodoInicio: string;
  periodoFin: string;
  fechaAdquisicion: string;
  diasGanados: number;
}

export interface DetalleSaldos {
  empleadoId: number;
  empleadoNombre: string;
  saldos: { vacaciones: SaldoResumen; compensacion: SaldoResumen };
  movimientos: MovimientoSaldo[];
  feriadosLaborados: FeriadoLaborado[];
  periodosVacacionales: PeriodoVacacional[];
}
