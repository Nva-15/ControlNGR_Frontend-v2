export interface LoginRequest {
  username: string;
  password: string;
}

export interface UsuarioSesion {
  id: number;
  username: string;
  rol: string;
  rolNombre: string;
  esAdmin: boolean;
  debeCambiarPassword: boolean;
}

export interface EmpleadoSesion {
  id: number;
  dni: string;
  nombre: string;
  cargo: string;
  nivel: string;
  rol: string;
  username: string;
  email?: string;
  foto?: string;
  descripcion?: string;
  hobby?: string;
  cumpleanos?: string;
  ingreso?: string;
  departamentoId?: number;
  departamentoNombre?: string;
}

/** Respuesta de /auth/login y /auth/cambiar-password. */
export interface AuthResponse {
  token: string;
  debeCambiarPassword: boolean;
  usuario: UsuarioSesion;
  /** null para el administrador del sistema (no es empleado). */
  empleado: EmpleadoSesion | null;
  success?: boolean;
  message?: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  username?: string;
  rol?: string;
  debeCambiarPassword?: boolean;
  error?: string;
}
