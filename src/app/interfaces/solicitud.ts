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
  evidencias: Evidencia[];
}

export interface HistorialSolicitud {
  fecha: string;
  estadoAnterior?: string;
  estadoNuevo: string;
  usuario?: string;
  comentario?: string;
}
