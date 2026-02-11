export interface Solicitud {
    id?: number;
    empleadoId: number;
    tipo: string;
    fechaInicio: string;
    fechaFin: string;
    motivo: string;
    estado?: string;
    aprobadoPor?: number;
    fechaAprobacion?: string;
    fechaSolicitud?: string;
  }
  
  export interface SolicitudResponse extends Solicitud {
    empleadoNombre: string;
    nombreAprobador?: string; 
  }