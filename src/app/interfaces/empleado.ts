/** Datos para crear/editar un empleado (incluye datos de acceso del usuario). */
export interface Empleado {
  id?: number;
  dni: string;
  nombre: string;
  cargo: string;
  nivel: string;
  departamentoId?: number | null;
  email?: string;
  username?: string;
  password?: string;
  rol: string;
  descripcion?: string;
  hobby?: string;
  cumpleanos?: string;
  ingreso?: string;
  foto?: string;
  activo?: boolean;
  identificador?: string;
  usuarioActivo?: boolean;
}

/** Empleado tal como lo devuelve la API. */
export interface EmpleadoResponse {
  id?: number;
  dni: string;
  nombre: string;
  cargo: string;
  nivel: string;
  email: string;
  username?: string;
  rol: string;
  descripcion?: string;
  hobby?: string;
  cumpleanos?: string;
  ingreso?: string;
  foto?: string;
  activo?: boolean;
  identificador?: string;
  usuarioActivo?: boolean;
  departamentoId?: number | null;
  departamentoNombre?: string | null;
}
