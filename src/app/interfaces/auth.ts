export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  empleado: {
    id: number;
    dni: string;
    nombre: string;
    cargo: string;
    nivel: string;
    rol: string;
    username: string;
    foto: string;
  };
}

export interface TokenVerifyResponse {
  valid: boolean;
  username?: string;
  rol?: string;
  error?: string;
}