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
  activo: boolean;
  ingreso?: string;
  vacaciones: SaldoResumen;
  compensacion: SaldoResumen;
}
