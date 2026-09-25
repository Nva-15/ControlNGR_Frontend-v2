import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  HistorialSolicitud, MotivoLicencia, SolicitudRequest, SolicitudResponse, TipoSolicitud
} from '../interfaces/solicitud';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/solicitudes`;
  }

  tipos(): Observable<TipoSolicitud[]> {
    return this.http.get<TipoSolicitud[]>(`${this.apiUrl}/tipos`);
  }

  motivosLicencia(): Observable<MotivoLicencia[]> {
    return this.http.get<MotivoLicencia[]>(`${this.apiUrl}/motivos-licencia`);
  }

  /** Si hay archivo se envia como multipart (parte "solicitud" en JSON + parte "archivo"). */
  crear(solicitud: SolicitudRequest, archivo?: File | null): Observable<SolicitudResponse> {
    if (archivo) {
      const form = new FormData();
      form.append('solicitud', new Blob([JSON.stringify(solicitud)], { type: 'application/json' }));
      form.append('archivo', archivo, archivo.name);
      return this.http.post<SolicitudResponse>(`${this.apiUrl}/crear`, form);
    }
    return this.http.post<SolicitudResponse>(`${this.apiUrl}/crear`, solicitud);
  }

  getMisSolicitudes(empleadoId: number): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/mis-solicitudes/${empleadoId}`);
  }

  /** Roles cuyas solicitudes aprueba el usuario (vacio si no aprueba). */
  rolesACargo(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/roles-a-cargo`);
  }

  /** Pendientes que el usuario puede aprobar segun su rol. */
  getPorAprobar(): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/pendientes-por-aprobar`);
  }

  getTodas(): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/todas`);
  }

  gestionar(id: number, estado: 'aprobado' | 'rechazado', comentarios?: string): Observable<SolicitudResponse> {
    return this.http.put<SolicitudResponse>(`${this.apiUrl}/gestionar/${id}`, { estado, comentarios });
  }

  editar(id: number, datos: { fechaInicio?: string; fechaFin?: string; motivo?: string }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/editar/${id}`, datos);
  }

  eliminar(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/eliminar/${id}`);
  }

  historial(id: number): Observable<HistorialSolicitud[]> {
    return this.http.get<HistorialSolicitud[]>(`${this.apiUrl}/${id}/historial`);
  }

  /** Descarga la evidencia como Blob (requiere el token, por eso no se usa un enlace directo). */
  evidencia(solicitudId: number, evidenciaId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${solicitudId}/evidencias/${evidenciaId}`, { responseType: 'blob' });
  }

  verificarConflictosPorRol(empleadoId: number, rolEmpleado: string, fechaInicio: string, fechaFin: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verificar-conflictos-por-rol`, { empleadoId, rolEmpleado, fechaInicio, fechaFin });
  }

  exportar(tipo: string, empleadoId?: number): Observable<any> {
    let params = new HttpParams();
    if (empleadoId) params = params.set('empleadoId', empleadoId);
    return this.http.get(`${this.apiUrl}/exportar/${tipo}`, { params });
  }
}
