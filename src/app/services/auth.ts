import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, AuthResponse, TokenVerifyResponse } from '../interfaces/auth';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/auth`;
  }

  constructor() {
    this.initializeAuthState();
  }

  private initializeAuthState() {
    const token = localStorage.getItem('token');
    if (token && this.isTokenExpired(token)) {
      this.logout();
    }
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
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('currentEmpleado', JSON.stringify(response.empleado));
          localStorage.setItem('userRole', response.empleado.rol);
        })
      );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentEmpleado');
    localStorage.removeItem('userRole');
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    return !!token && !this.isTokenExpired(token);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentEmpleado(): any {
    const empleado = localStorage.getItem('currentEmpleado');
    return empleado ? JSON.parse(empleado) : null;
  }

  getUserRole(): string {
    const empleado = this.getCurrentEmpleado();
    if (empleado?.rol) return empleado.rol.toLowerCase();
    return localStorage.getItem('userRole')?.toLowerCase() || '';
  }

  hasRole(role: string): boolean {
    const userRole = this.getUserRole();
    const requestedRole = role.toLowerCase();
    return userRole === requestedRole;
  }

  isAdmin(): boolean {
    return this.getUserRole() === 'admin';
  }

  isSupervisor(): boolean {
    return this.getUserRole() === 'supervisor';
  }

  isTecnico(): boolean {
    return this.getUserRole() === 'tecnico';
  }

  isHD(): boolean {
    return this.getUserRole() === 'hd';
  }

  isNOC(): boolean {
    return this.getUserRole() === 'noc';
  }

  puedeGestionarEmpleados(): boolean {
    const rol = this.getUserRole();
    return rol === 'admin' || rol === 'supervisor';
  }

  puedeEditarEmpleado(empleado: any): boolean {
    const userRole = this.getUserRole();
    const currentUser = this.getCurrentEmpleado();
    const esMiPerfil = currentUser && currentUser.id === empleado.id;

    if (userRole === 'admin') {
      return true;
    }

    if (userRole === 'supervisor') {
      if (esMiPerfil) {
        return true;
      }

      const rolesPermitidos = ['tecnico', 'hd', 'noc'];
      const empleadoRol = empleado.rol?.toLowerCase();
      return rolesPermitidos.includes(empleadoRol || '');
    }

    return false;
  }

  verifyToken(): Observable<TokenVerifyResponse> {
    return this.http.post<TokenVerifyResponse>(`${this.apiUrl}/verify`, {});
  }

  cambiarPassword(username: string, passwordActual: string, passwordNueva: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cambiar-password`, {
      username,
      passwordActual,
      passwordNueva
    });
  }

  getRolDisplayName(): string {
    const rol = this.getUserRole();
    switch(rol) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'tecnico': return 'Tecnico';
      case 'hd': return 'HD';
      case 'noc': return 'NOC';
      default: return 'Usuario';
    }
  }
}
