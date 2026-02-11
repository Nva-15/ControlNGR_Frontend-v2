import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Empleado, EmpleadoResponse } from '../interfaces/empleado';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class EmpleadosService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/empleados`;
  }

  getEmpleados(): Observable<EmpleadoResponse[]> {
    return this.http.get<EmpleadoResponse[]>(this.apiUrl);
  }

  getEmpleadoById(id: number): Observable<EmpleadoResponse> {
    return this.http.get<EmpleadoResponse>(`${this.apiUrl}/${id}`);
  }

  createEmpleado(empleado: Empleado): Observable<EmpleadoResponse> {
    return this.http.post<EmpleadoResponse>(this.apiUrl, empleado);
  }

  updateEmpleado(id: number, empleado: Empleado): Observable<EmpleadoResponse> {
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
    return this.http.patch(`${this.apiUrl}/${id}/estado`, { 
      usuarioActivo: estado,
      activo: estado 
    });
  }

  actualizarEmail(id: number, email: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/actualizar-email/${id}`, { email });
  }
  getCumpleanosSemanales(): Observable<EmpleadoResponse[]> {
    return this.http.get<EmpleadoResponse[]>(`${this.apiUrl}/cumpleanos/semana`);
  }
}