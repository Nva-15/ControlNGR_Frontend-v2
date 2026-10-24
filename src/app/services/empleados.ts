import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Pagina } from '../interfaces/admin';
import { parametros } from '../utils/filtros';
import { Observable, map } from 'rxjs';
import { Empleado, EmpleadoResponse } from '../interfaces/empleado';
import { ApiConfigService } from './api-config.service';
import { RolPersonal } from '../interfaces/admin';

@Injectable({
  providedIn: 'root'
})
export class EmpleadosService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/empleados`;
  }

  departamentos(): Observable<{ id: number; nombre: string }[]> {
    return this.http.get<{ id: number; nombre: string }[]>(`${this.apiUrl}/departamentos`);
  }

  /** Roles asignables a empleados (codigo, nombre, nivel). */
  /** Roles del personal con su configuracion de asistencia. */
  roles(): Observable<RolPersonal[]> {
    return this.http.get<RolPersonal[]>(`${this.apiUrl}/roles`);
  }

  /** Roles que trabajan con horario: los unicos que aparecen en Horarios y en el reporte de asistencia. */
  rolesConHorario(): Observable<RolPersonal[]> {
    return this.roles().pipe(map(r => r.filter(x => x.conHorario)));
  }

  getEmpleados(): Observable<EmpleadoResponse[]> {
    return this.http.get<EmpleadoResponse[]>(this.apiUrl);
  }

  /** Empleados por páginas, filtrados en el servidor (estado: activos, inactivos o todos). */
  pagina(filtros: { q?: string; departamentoId?: number | ''; rol?: string; estado?: string; pagina?: number; tamano?: number; exportar?: boolean }):
      Observable<Pagina<EmpleadoResponse>> {
    return this.http.get<Pagina<EmpleadoResponse>>(`${this.apiUrl}/pagina`, { params: parametros(filtros) });
  }

  getEmpleadoById(id: number): Observable<EmpleadoResponse> {
    return this.http.get<EmpleadoResponse>(`${this.apiUrl}/${id}`);
  }

  createEmpleado(empleado: Partial<Empleado>): Observable<EmpleadoResponse> {
    return this.http.post<EmpleadoResponse>(this.apiUrl, empleado);
  }

  updateEmpleado(id: number, empleado: Partial<Empleado>): Observable<EmpleadoResponse> {
    return this.http.put<EmpleadoResponse>(`${this.apiUrl}/${id}`, empleado);
  }

  deleteEmpleado(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  desactivarEmpleado(id: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/desactivar`, {});
  }

  getEmpleadosByRol(rol: string): Observable<EmpleadoResponse[]> {
    return this.http.get<EmpleadoResponse[]>(`${this.apiUrl}/rol/${rol}`);
  }

  getMiPerfil(): Observable<EmpleadoResponse> {
    return this.http.get<EmpleadoResponse>(`${this.apiUrl}/mi-perfil`);
  }

  buscarEmpleados(nombre: string): Observable<EmpleadoResponse[]> {
    return this.http.get<EmpleadoResponse[]>(`${this.apiUrl}/buscar?nombre=${nombre}`);
  }

  actualizarPerfil(id: number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/actualizar-perfil/${id}`, datos);
  }

  cambiarPasswordAdmin(id: number, passwordNueva: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cambiar-password-admin/${id}`, { passwordNueva });
  }

  exportarEmpleados(): Observable<any> {
    return this.http.get(`${this.apiUrl}/exportar`);
  }

  cambiarEstadoUsuario(id: number, estado: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/estado`, { usuarioActivo: estado, activo: estado });
  }

  actualizarEmail(id: number, email: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/actualizar-email/${id}`, { email });
  }
  getCumpleanosSemanales(): Observable<EmpleadoResponse[]> {
    return this.http.get<EmpleadoResponse[]>(`${this.apiUrl}/cumpleanos/semana`);
  }
}