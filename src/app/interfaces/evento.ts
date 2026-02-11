export interface Evento {
  id?: number;
  titulo: string;
  descripcion: string;
  tipoEvento: 'ENCUESTA' | 'SI_NO' | 'ASISTENCIA' | 'INFORMATIVO';
  estado: 'BORRADOR' | 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';
  fechaInicio?: string;
  fechaFin?: string;
  rolesVisibles: string[];
  permiteComentarios: boolean;
  requiereRespuesta: boolean;
  creadoPorId?: number;
  creadoPorNombre?: string;
  fechaCreacion?: string;
  opciones?: OpcionEvento[];
  totalRespuestas?: number;
  totalComentarios?: number;
  yaRespondio?: boolean;
}

export interface OpcionEvento {
  id?: number;
  textoOpcion: string;
  orden?: number;
}

export interface RespuestaEvento {
  id?: number;
  eventoId: number;
  empleadoId?: number;
  empleadoNombre?: string;
  empleadoFoto?: string;
  opcionId?: number;
  opcionTexto?: string;
  respuestaSiNo?: boolean;
  confirmacionAsistencia?: 'CONFIRMADO' | 'NO_ASISTIRE' | 'PENDIENTE';
  comentario?: string;
  fechaRespuesta?: string;
}

export interface ComentarioEvento {
  id?: number;
  eventoId: number;
  empleadoId?: number;
  empleadoNombre?: string;
  empleadoFoto?: string;
  comentario: string;
  fechaComentario?: string;
}

export interface EstadisticasEvento {
  eventoId: number;
  tipoEvento: string;
  totalRespuestas: number;
  totalEmpleados: number;
  porcentajeParticipacion: number;
  respuestasSi?: number;
  respuestasNo?: number;
  confirmados?: number;
  noAsistiran?: number;
  pendientes?: number;
  opcionesEstadisticas?: OpcionEstadistica[];
}

export interface OpcionEstadistica {
  opcionId: number;
  textoOpcion: string;
  votos: number;
  porcentaje: number;
}

export interface EventoRequest {
  titulo: string;
  descripcion: string;
  tipoEvento: string;
  fechaInicio?: string;
  fechaFin?: string;
  rolesVisibles: string[];
  permiteComentarios: boolean;
  requiereRespuesta: boolean;
  opciones?: string[];
}

export interface RespuestaEventoRequest {
  eventoId: number;
  opcionId?: number;
  respuestaSiNo?: boolean;
  confirmacionAsistencia?: string;
  comentario?: string;
}
