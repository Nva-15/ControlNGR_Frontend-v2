export type EstadoSolicitud = 'pendiente' | 'aprobado' | 'rechazado';

export interface TipoSolicitud {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  /** VACACIONES, COMPENSACION o NINGUNO */
  descuentaDe: string;
  requiereEvidencia: boolean;
  requiereMotivoLicencia: boolean;
  tipoDiaHorario: string;
  activo: boolean;
}

export interface MotivoLicencia {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}

export interface Evidencia {
  id: number;
  nombre: string;
  contentType: string;
  tamanoBytes: number;
  fechaSubida: string;
}

export interface SolicitudRequest {
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
  motivoLicenciaId?: number | null;
  /** Solo compensación: va siempre al supervisor */
  urgente?: boolean;
  motivoUrgencia?: string;
}

export interface SolicitudResponse {
  id: number;
  empleadoId: number;
  empleadoNombre: string;
  empleadoRol?: string;
  tipo: string;
  tipoNombre: string;
  descuentaDe: string;
  diasSolicitados: number;
  motivoLicenciaId?: number;
  motivoLicencia?: string;
  fechaSolicitud: string;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
  estado: EstadoSolicitud;
  aprobadoPor?: string;
  fechaAprobacion?: string;
  comentarioGestion?: string;
  urgente?: boolean;
  motivoUrgencia?: string;
  /** Por qué no se aprobó sola (sala de espera); solo mientras está pendiente */
  motivoEspera?: string;
  posicionEspera?: number;
  aprobacionAutomatica?: boolean;
  evidencias: Evidencia[];
}

/** Cupos de compensación del equipo en la semana de una fecha. */
export interface CuposCompensacion {
  activo: boolean;
  equipo?: string;
  semanaInicio?: string;
  semanaFin?: string;
  cupoSemanal?: number;
  usadosEquipo?: number;
  maximoPorEmpleado?: number;
  usadosEmpleado?: number;
  antelacionHoras?: number;
}

export interface HistorialSolicitud {
  fecha: string;
  estadoAnterior?: string;
  estadoNuevo: string;
  usuario?: string;
  comentario?: string;
}
