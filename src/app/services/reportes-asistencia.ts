import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { AlertaAsistencia, DashboardAsistencia, FichaAsistencia, FiltroDashboard } from '../interfaces/reportes-asistencia';

/** Dashboard de asistencia, ficha del colaborador y "Mi récord". */
@Injectable({ providedIn: 'root' })
export class ReportesAsistenciaService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get url() { return `${this.apiConfig.apiUrl}/reportes-asistencia`; }

  dashboard(f: FiltroDashboard): Observable<DashboardAsistencia> {
    let params = new HttpParams().set('desde', f.desde).set('hasta', f.hasta).set('personal', f.personal || 'activos');
    if (f.departamentoId) params = params.set('departamentoId', f.departamentoId);
    if (f.rol) params = params.set('rol', f.rol);
    if (f.turno) params = params.set('turno', f.turno);
    if (f.funcion) params = params.set('funcion', f.funcion);
    return this.http.get<DashboardAsistencia>(`${this.url}/dashboard`, { params });
  }

  /** Sin "desde": desde su fecha de ingreso. */
  ficha(empleadoId: number, desde?: string, hasta?: string): Observable<FichaAsistencia> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<FichaAsistencia>(`${this.url}/ficha/${empleadoId}`, { params });
  }

  /** Alertas del período en curso (las nuevas vienen marcadas). */
  alertas(departamentoId?: number | null): Observable<{ alertas: AlertaAsistencia[]; nuevas: number }> {
    let params = new HttpParams();
    if (departamentoId) params = params.set('departamentoId', departamentoId);
    return this.http.get<{ alertas: AlertaAsistencia[]; nuevas: number }>(`${this.url}/alertas`, { params });
  }

  marcarAlertasVistas(): Observable<void> {
    return this.http.post<void>(`${this.url}/alertas/vistas`, {});
  }

  miRecord(): Observable<FichaAsistencia> {
    return this.http.get<FichaAsistencia>(`${this.url}/mi-record`);
  }
}
