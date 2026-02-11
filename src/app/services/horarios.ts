import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Horario,
  HorarioResponse,
  HorarioSemanal,
  HorarioSemanalRequest,
  HorarioSemanalResponse,
  DetalleHorarioDia
} from '../interfaces/horario';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class HorariosService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/horarios`;
  }
  private get apiUrlSemanal() {
    return `${this.apiConfig.apiUrl}/horarios-semanales`;
  }

  getHorarios(): Observable<HorarioResponse[]> {
    return this.http.get<HorarioResponse[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  getVistaConsolidada(rol?: string): Observable<HorarioSemanal[]> {
    let params = new HttpParams();
    if (rol) {
      params = params.set('rol', rol);
    }
    return this.http.get<HorarioSemanal[]>(`${this.apiUrl}/consolidado`, { params }).pipe(
      catchError(this.handleError)
    );
  }

  guardarHorarioDia(empleadoId: number, diaSemana: string, horario: Partial<Horario>): Observable<HorarioResponse> {
    return this.http.put<HorarioResponse>(`${this.apiUrl}/empleado/${empleadoId}/dia/${diaSemana}`, horario).pipe(
      catchError(this.handleError)
    );
  }

  getHorarioById(id: number): Observable<HorarioResponse> {
    return this.http.get<HorarioResponse>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getHorariosPorEmpleado(empleadoId: number): Observable<HorarioResponse[]> {
    return this.http.get<HorarioResponse[]>(`${this.apiUrl}/empleado/${empleadoId}`).pipe(
      catchError(this.handleError)
    );
  }

  crearHorario(horario: Horario): Observable<HorarioResponse> {
    return this.http.post<HorarioResponse>(this.apiUrl, horario).pipe(
      catchError(this.handleError)
    );
  }

  crearHorarioSemana(empleadoId: number, plantilla: Partial<Horario>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/semana/${empleadoId}`, plantilla).pipe(
      catchError(this.handleError)
    );
  }

  actualizarHorario(id: number, horario: Partial<Horario>): Observable<HorarioResponse> {
    return this.http.put<HorarioResponse>(`${this.apiUrl}/${id}`, horario).pipe(
      catchError(this.handleError)
    );
  }

  eliminarHorario(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  eliminarHorariosPorEmpleado(empleadoId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/empleado/${empleadoId}`).pipe(
      catchError(this.handleError)
    );
  }

  getHorarioSemanalEmpleado(empleadoId: number): Observable<HorarioSemanal> {
    return this.http.get<HorarioSemanal>(`${this.apiUrl}/empleado/${empleadoId}/semanal`).pipe(
      catchError(this.handleError)
    );
  }

  getMiHorarioVigente(empleadoId: number): Observable<HorarioSemanal> {
    return this.http.get<HorarioSemanal>(`${this.apiUrlSemanal}/mi-horario/${empleadoId}`).pipe(
      catchError(this.handleError)
    );
  }

  aplicarHorarioMultiplesDias(empleadoId: number, datos: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/empleado/${empleadoId}/dias-multiples`, datos).pipe(
      catchError(this.handleError)
    );
  }

  generarSemana(request: HorarioSemanalRequest): Observable<HorarioSemanalResponse> {
    return this.http.post<HorarioSemanalResponse>(`${this.apiUrlSemanal}/generar`, request).pipe(
      catchError(this.handleError)
    );
  }

  copiarSemana(semanaId: number, nuevaFechaInicio: string): Observable<HorarioSemanalResponse> {
    return this.http.post<HorarioSemanalResponse>(
      `${this.apiUrlSemanal}/${semanaId}/copiar?nuevaFechaInicio=${nuevaFechaInicio}`,
      {}
    ).pipe(
      catchError(this.handleError)
    );
  }

  getSemanasHorarios(): Observable<HorarioSemanalResponse[]> {
    return this.http.get<HorarioSemanalResponse[]>(this.apiUrlSemanal).pipe(
      catchError(this.handleError)
    );
  }

  getSemanaById(id: number): Observable<HorarioSemanalResponse> {
    return this.http.get<HorarioSemanalResponse>(`${this.apiUrlSemanal}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  getSemanaVigente(): Observable<HorarioSemanalResponse> {
    return this.http.get<HorarioSemanalResponse>(`${this.apiUrlSemanal}/vigente`).pipe(
      catchError(this.handleError)
    );
  }

  getSemanaPorFecha(fecha: string): Observable<HorarioSemanalResponse> {
    return this.http.get<HorarioSemanalResponse>(
      `${this.apiUrlSemanal}/por-fecha?fecha=${fecha}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  actualizarDetalleDia(detalleId: number, datos: Partial<DetalleHorarioDia>): Observable<HorarioSemanalResponse> {
    return this.http.put<HorarioSemanalResponse>(
      `${this.apiUrlSemanal}/detalle/${detalleId}`,
      datos
    ).pipe(
      catchError(this.handleError)
    );
  }

  actualizarMultiplesDias(detalleIds: number[], datos: Partial<DetalleHorarioDia>): Observable<HorarioSemanalResponse> {
    return this.http.put<HorarioSemanalResponse>(
      `${this.apiUrlSemanal}/detalle/multiple`,
      { detalleIds, ...datos }
    ).pipe(
      catchError(this.handleError)
    );
  }

  cambiarEstadoSemana(semanaId: number, estado: string): Observable<HorarioSemanalResponse> {
    return this.http.put<HorarioSemanalResponse>(
      `${this.apiUrlSemanal}/${semanaId}/estado`,
      { estado }
    ).pipe(
      catchError(this.handleError)
    );
  }

  eliminarSemana(semanaId: number): Observable<any> {
    return this.http.delete(`${this.apiUrlSemanal}/${semanaId}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Error desconocido';
    if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return throwError(() => errorMessage);
  }
}
