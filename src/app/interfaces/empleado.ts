export interface Empleado {
    id?: number;
    dni: string;
    nombre: string;
    cargo: string;
    nivel: string;
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
  
  export interface EmpleadoResponse {
    email: string;
    id?: number;
    dni: string;
    nombre: string;
    cargo: string;
    nivel: string;
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