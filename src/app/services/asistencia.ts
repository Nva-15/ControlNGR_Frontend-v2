import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AsistenciaRequest, AsistenciaResponse, ReporteAsistencia } from '../interfaces/asistencia';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/asistencia`;
  }

  registrarAsistencia(request: AsistenciaRequest): Observable<AsistenciaResponse> {
    return this.http.post<AsistenciaResponse>(`${this.apiUrl}/registrar`, request);
  }

  getAsistencias(): Observable<AsistenciaResponse[]> {
    return this.http.get<AsistenciaResponse[]>(this.apiUrl);
  }

  getAsistenciasPorEmpleado(empleadoId: number): Observable<AsistenciaResponse[]> {
    return this.http.get<AsistenciaResponse[]>(`${this.apiUrl}/empleado/${empleadoId}`);
  }

  getAsistenciasPorFecha(fecha: string): Observable<AsistenciaResponse[]> {
    return this.http.get<AsistenciaResponse[]>(`${this.apiUrl}/fecha/${fecha}`);
  }

  getAsistenciasPorRango(inicio: string, fin: string): Observable<AsistenciaResponse[]> {
    return this.http.get<AsistenciaResponse[]>(`${this.apiUrl}/rango?inicio=${inicio}&fin=${fin}`);
  }

  getReporteMensual(empleadoId: number, year: number, month: number): Observable<AsistenciaResponse[]> {
    return this.http.get<AsistenciaResponse[]>(
      `${this.apiUrl}/reporte/mensual/${empleadoId}?year=${year}&month=${month}`
    );
  }

  getAsistenciaHoy(): Observable<AsistenciaResponse[]> {
    return this.http.get<AsistenciaResponse[]>(`${this.apiUrl}/hoy`);
  }

  verificarSalidasAutomaticas(): Observable<any> {
    return this.http.post(`${this.apiUrl}/verificar-salidas`, {});
  }

  getReporteAsistencia(inicio: string, fin: string): Observable<ReporteAsistencia[]> {
    return this.http.get<ReporteAsistencia[]>(
      `${this.apiUrl}/reporte/rango?inicio=${inicio}&fin=${fin}`
    );
  }
}