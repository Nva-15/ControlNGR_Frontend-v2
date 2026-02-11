export interface Horario {
  id?: number;
  empleadoId: number;
  diaSemana: string;
  horaEntrada: string;
  horaSalida: string;
  horaAlmuerzoInicio?: string;
  horaAlmuerzoFin?: string;
  tipoDia?: string; // normal, descanso, compensado, vacaciones
  turno?: string; // manana, tarde
}

export interface HorarioResponse extends Horario {
  empleadoNombre: string;
  empleadoRol?: string;
}

export interface HorarioDia {
  id?: number;
  horaEntrada?: string;
  horaSalida?: string;
  horaAlmuerzoInicio?: string;
  horaAlmuerzoFin?: string;
  tipoDia?: string;
  turno?: string; // manana, tarde
}

export interface HorarioSemanal {
  empleadoId: number;
  empleadoNombre: string;
  empleadoRol: string;
  empleadoCargo: string;
  horariosSemana: {
    lunes?: HorarioDia;
    martes?: HorarioDia;
    miercoles?: HorarioDia;
    jueves?: HorarioDia;
    viernes?: HorarioDia;
    sabado?: HorarioDia;
    domingo?: HorarioDia;
  };
}

// =====================================================
// NUEVOS TIPOS PARA HORARIOS SEMANALES POR FECHAS
// =====================================================

// Request para crear/generar una semana
export interface HorarioSemanalRequest {
  fechaInicio: string; // ISO date: "2025-01-27"
  fechaFin: string;    // ISO date: "2025-02-02"
  creadoPorId: number;
  copiarDeId?: number; // ID de semana anterior para copiar (opcional)
}

// Detalle de un día específico con fecha
export interface DetalleHorarioDia {
  id?: number;
  fecha: string;           // ISO date: "2025-01-27"
  diaSemana: string;       // "lunes", "martes", etc.
  horaEntrada?: string;    // "08:00"
  horaSalida?: string;     // "17:00"
  horaAlmuerzoInicio?: string;
  horaAlmuerzoFin?: string;
  tipoDia?: string;        // normal, descanso, vacaciones, permiso, compensado
  turno?: string;          // manana, tarde
  origenTipoDia?: string;  // "manual" | "solicitud_aprobada"
  solicitudId?: number;    // ID de solicitud si viene de una aprobada
  esHoy?: boolean;         // true si es el día actual
}

// Horarios de un empleado en una semana específica
export interface EmpleadoHorarioSemanal {
  empleadoId: number;
  empleadoNombre: string;
  empleadoRol: string;
  empleadoCargo: string;
  dias: { [fecha: string]: DetalleHorarioDia }; // Map: fecha ISO -> detalle
}

// Response completo de una semana con todos los empleados
export interface HorarioSemanalResponse {
  id: number;
  nombre: string;          // "Semana del 27/01 al 02/02"
  fechaInicio: string;     // ISO date
  fechaFin: string;        // ISO date
  estado: string;          // "borrador" | "activo" | "historico"
  creadoPor?: string;      // Nombre del creador
  creadoPorId?: number;
  fechaCreacion?: string;  // ISO datetime
  empleados: EmpleadoHorarioSemanal[];
  esSemanaActual?: boolean;
  totalEmpleados?: number;
  totalDiasLaborales?: number;
  totalDescansos?: number;
  totalVacaciones?: number;
}

// Lista resumida de semanas (para selector)
export interface HorarioSemanalResumen {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  esSemanaActual?: boolean;
}
