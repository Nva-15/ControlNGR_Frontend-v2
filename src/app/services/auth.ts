import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, AuthResponse, TokenVerifyResponse, EmpleadoSesion, UsuarioSesion } from '../interfaces/auth';
import { ApiConfigService } from './api-config.service';
import { ROLES, esGerencia, esGestion, puedeAdministrar, rolLabel } from '../utils/roles';

const TOKEN_KEY = 'token';
const SESION_KEY = 'sesion';

interface SesionGuardada {
  usuario: UsuarioSesion;
  empleado: EmpleadoSesion | null;
}

/**
 * Sesion del usuario. El token y los datos basicos se guardan en localStorage;
 * los permisos reales siempre los valida el backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/auth`;
  }

  private sesion = signal<SesionGuardada | null>(this.leerSesion());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly empleado = computed(() => this.sesion()?.empleado ?? null);
  readonly rol = computed(() => (this.sesion()?.usuario.rol || '').toLowerCase());

  constructor() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && this.isTokenExpired(token)) {
      this.logout();
    }
  }

  private leerSesion(): SesionGuardada | null {
    try {
      const raw = localStorage.getItem(SESION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private guardarSesion(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.token);
    const sesion: SesionGuardada = { usuario: res.usuario, empleado: res.empleado };
    localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
    this.sesion.set(sesion);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => this.guardarSesion(res))
    );
  }

  /** Cambio de contraseña (incluye el obligatorio del primer ingreso). Renueva el token. */
  cambiarPassword(passwordActual: string, passwordNueva: string, confirmarPassword?: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/cambiar-password`, {
      passwordActual,
      passwordNueva,
      confirmarPassword: confirmarPassword ?? passwordNueva
    }).pipe(tap(res => this.guardarSesion(res)));
  }

  verifyToken(): Observable<TokenVerifyResponse> {
    return this.http.post<TokenVerifyResponse>(`${this.apiUrl}/verify`, {});
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESION_KEY);
    // Claves de la version anterior
    localStorage.removeItem('currentEmpleado');
    localStorage.removeItem('userRole');
    sessionStorage.removeItem('notificacionesMostradas');
    this.sesion.set(null);
  }

  /** Actualiza datos del empleado en la sesion (por ejemplo, la foto). */
  actualizarEmpleadoSesion(cambios: Partial<EmpleadoSesion>) {
    const actual = this.sesion();
    if (!actual?.empleado) return;
    const sesion = { ...actual, empleado: { ...actual.empleado, ...cambios } };
    localStorage.setItem(SESION_KEY, JSON.stringify(sesion));
    this.sesion.set(sesion);
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return !!token && !this.isTokenExpired(token) && !!this.sesion();
  }

  debeCambiarPassword(): boolean {
    return !!this.sesion()?.usuario.debeCambiarPassword;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getCurrentEmpleado(): EmpleadoSesion | null {
    return this.empleado();
  }

  getUserRole(): string {
    return this.rol();
  }

  hasRole(role: string): boolean {
    return this.rol() === role.toLowerCase();
  }

  /** Administrador del sistema (panel maestro). */
  isAdmin(): boolean {
    return this.rol() === ROLES.ADMIN;
  }

  /** Director, gerente o jefe. */
  isGerencia(): boolean {
    return esGerencia(this.rol());
  }

  /** Roles con personal a cargo (gerencia, supervisor, gestor). */
  isGestion(): boolean {
    return esGestion(this.rol());
  }

  isSupervisor(): boolean {
    return this.rol() === ROLES.SUPERVISOR;
  }

  /** Crear empleados y cambiar rol/usuario/contraseña. */
  puedeGestionarAcceso(): boolean {
    return this.isAdmin() || this.isGerencia();
  }

  puedeGestionarEmpleados(): boolean {
    return this.isAdmin() || this.isGestion();
  }

  puedeEditarEmpleado(empleado: { id?: number; rol?: string }): boolean {
    const actual = this.empleado();
    if (actual && empleado.id === actual.id) return true;
    return puedeAdministrar(this.rol(), empleado.rol);
  }

  getRolDisplayName(): string {
    return this.usuario()?.rolNombre || rolLabel(this.rol());
  }
}
