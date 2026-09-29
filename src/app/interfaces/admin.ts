import { SaldoResumen } from './saldo';

export interface Parametro {
  clave: string;
  valor: string;
  tipoDato: 'TEXTO' | 'NUMERO' | 'BOOLEANO' | 'FECHA';
  descripcion?: string;
}

export interface SegmentoRed {
  id?: number;
  nombre: string;
  patron: string;
  descripcion?: string;
  activo: boolean;
}

export interface Feriado {
  id?: number;
  fecha: string;
  descripcion: string;
  tipo: string;
  activo: boolean;
}

export interface Departamento {
  id?: number;
  nombre: string;
  descripcion?: string;
  responsableId?: number | null;
  activo: boolean;
}

export interface TipoUsuario {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  nivelJerarquia: number;
  puedeSolicitar: boolean;
  marcaAsistencia: boolean;
  esSistema: boolean;
  activo: boolean;
}

export interface ReglaAprobacion {
  id: number;
  solicitanteId: number;
  solicitante: string;
  aprobadorId: number;
  aprobador: string;
  activo: boolean;
}

export interface UsuarioAdmin {
  id: number;
  username: string;
  rol: string;
  rolNombre: string;
  activo: boolean;
  debeCambiarPassword: boolean;
  ultimoAcceso?: string;
  empleadoId?: number;
  empleadoNombre?: string;
  departamento?: string;
  empleadoActivo?: boolean;
}

export interface SaldoEmpleado {
  empleadoId: number;
  empleadoNombre: string;
  dni: string;
  rol: string;
  departamento?: string;
  activo: boolean;
  ingreso?: string;
  vacaciones: SaldoResumen;
  compensacion: SaldoResumen;
}

/** Rol del personal con su configuracion de asistencia (GET /api/empleados/roles). */
export interface RolPersonal {
  codigo: string;
  nombre: string;
  nivel: number;
  /** Marca entrada y salida. */
  marcaAsistencia: boolean;
  /** Trabaja con horario: aparece en Horarios y en el reporte de asistencia. Si marca sin horario, es flexible. */
  conHorario: boolean;
}

/** Configuracion de asistencia de un rol en el panel admin. */
export interface RolAsistencia {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  marcaAsistencia: boolean;
  conHorario: boolean;
  /** Empleados activos con este rol. */
  empleados: number;
}

/** Resultado (o vista previa) de copiar los feriados de un año a otro. */
export interface CopiaFeriados {
  origen: number;
  destino: number;
  creados: number;
  items: {
    id: number;
    descripcion: string;
    tipo: string;
    activo: boolean;
    fechaOrigen: string;
    fechaNueva: string | null;
    /** Jueves o Viernes Santo: la fecha se recalcula con la Pascua. */
    movil: boolean;
    estado: 'nuevo' | 'existe' | 'fecha_ocupada' | 'fecha_invalida' | 'copiado' | 'no_seleccionado';
  }[];
}
