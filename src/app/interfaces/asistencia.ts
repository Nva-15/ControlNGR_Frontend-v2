/** La fecha y hora las pone el servidor. */
  export interface AsistenciaRequest {
    empleadoId?: number;
    tipo: 'entrada' | 'salida';
    observaciones?: string;
  }
  
  export interface AsistenciaResponse {
    id: number;
    empleadoId: number;
    empleadoNombre: string;
    fecha: string;
    horaEntrada: string;
    horaSalida: string;
    estado: string;
    observaciones: string;
    salidaAutomatica: boolean;
    ipEntrada?: string;
    ipSalida?: string;
    /** Si la entrada fue en feriado: nombre del feriado y dias de compensacion abonados. */
    feriado?: string;
    diasCompensacionAbonados?: number;
  }

  export interface ReporteAsistencia {
    empleadoId: number;
    empleadoNombre: string;
    empleadoRol: string;
    empleadoCargo: string;
    fecha: string;
    diaSemana: string;
    horarioEntrada: string | null;
    horaEntradaReal: string | null;
    horarioSalida: string | null;
    horaSalidaReal: string | null;
    estado: string;
    minutosRetraso: number | null;
    tipoDia: string | null;
    turno: string | null;
    observaciones: string | null;
    salidaAutomatica: boolean | null;
  }