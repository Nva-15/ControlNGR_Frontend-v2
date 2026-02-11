import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SolicitudResponse } from '../interfaces/solicitud';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class SolicitudesService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/solicitudes`;
  }

  crearSolicitud(solicitud: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/crear`, solicitud).pipe(
      map((response: any) => {
        if (response.solicitud) {
          return {
            ...response
          };
        }
        return response;
      }),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error.error?.error || 'Error al crear solicitud');
      })
    );
  }

  getMisSolicitudes(empleadoId: number): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/mis-solicitudes/${empleadoId}`);
  }

  getPendientes(): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/pendientes`);
  }

  getTodas(): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/todas`);
  }

  getHistorial(): Observable<SolicitudResponse[]> {
    return this.http.get<SolicitudResponse[]>(`${this.apiUrl}/historial`);
  }

  getSolicitudById(id: number): Observable<SolicitudResponse> {
    return this.http.get<SolicitudResponse>(`${this.apiUrl}/${id}`);
  }

  gestionarSolicitud(id: number, estado: string, usuarioId: number, comentarios?: string): Observable<SolicitudResponse> {
    const payload: any = { estado, usuarioId };
    if (comentarios) {
      payload.comentarios = comentarios;
    }
    return this.http.put<SolicitudResponse>(`${this.apiUrl}/gestionar/${id}`, payload);
  }

  editarSolicitud(id: number, datos: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/editar/${id}`, datos).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          return throwError(() => 'No tiene permisos para editar esta solicitud');
        }
        if (error.status === 401) {
          return throwError(() => 'No autorizado. Por favor inicie sesión nuevamente');
        }
        return throwError(() => error.error?.error || 'Error al editar solicitud');
      })
    );
  }

  verificarConflictosPorRol(empleadoId: number, rolEmpleado: string, fechaInicio: string, fechaFin: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verificar-conflictos-por-rol`, {
      empleadoId,
      rolEmpleado,
      fechaInicio,
      fechaFin
    }).pipe(
      map((response: any) => response),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error.error?.error || 'Error al verificar conflictos');
      })
    );
  }
  
  verificarConflictos(empleadoId: number, fechaInicio: string, fechaFin: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verificar-conflictos`, {
      empleadoId,
      fechaInicio,
      fechaFin
    }).pipe(
      map((response: any) => response),
      catchError((error: HttpErrorResponse) => {
        return throwError(() => error.error?.error || 'Error al verificar conflictos');
      })
    );
  }

  exportarSolicitudes(tipo: string, empleadoId?: number, formato: string = 'json'): Observable<any> {
    let params = new HttpParams().set('formato', formato);
    if (empleadoId) {
      params = params.set('empleadoId', empleadoId.toString());
    }
    return this.http.get(`${this.apiUrl}/exportar/${tipo}`, { params });
  }

  eliminarSolicitud(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/eliminar/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403) {
          return throwError(() => error.error?.error || 'No tiene permisos para eliminar esta solicitud');
        }
        if (error.status === 401) {
          return throwError(() => 'No autorizado. Por favor inicie sesión nuevamente');
        }
        return throwError(() => error.error?.error || 'Error al eliminar solicitud');
      })
    );
  }
}