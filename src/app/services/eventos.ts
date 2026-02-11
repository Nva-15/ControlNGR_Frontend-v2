import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  Evento,
  RespuestaEvento,
  ComentarioEvento,
  EstadisticasEvento,
  EventoRequest,
  RespuestaEventoRequest
} from '../interfaces/evento';
import { ApiConfigService } from './api-config.service';

@Injectable({
  providedIn: 'root'
})
export class EventosService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);

  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/eventos`;
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // ==================== CRUD EVENTOS ====================

  crearEvento(evento: EventoRequest): Observable<Evento> {
    const headers = this.getHeaders();
    return this.http.post<Evento>(`${this.apiUrl}/crear`, evento, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  actualizarEvento(id: number, evento: EventoRequest): Observable<Evento> {
    const headers = this.getHeaders();
    return this.http.put<Evento>(`${this.apiUrl}/actualizar/${id}`, evento, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  cambiarEstado(id: number, estado: string): Observable<Evento> {
    const headers = this.getHeaders();
    return this.http.put<Evento>(`${this.apiUrl}/estado/${id}`, { estado }, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  eliminarEvento(id: number): Observable<any> {
    const headers = this.getHeaders();
    return this.http.delete<any>(`${this.apiUrl}/eliminar/${id}`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== CONSULTAS ====================

  getEventosActivos(): Observable<Evento[]> {
    const headers = this.getHeaders();
    return this.http.get<Evento[]>(`${this.apiUrl}/activos`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getProximosEventos(): Observable<Evento[]> {
    const headers = this.getHeaders();
    return this.http.get<Evento[]>(`${this.apiUrl}/proximos`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getTodosEventos(): Observable<Evento[]> {
    const headers = this.getHeaders();
    return this.http.get<Evento[]>(`${this.apiUrl}/todos`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getEventoPorId(id: number): Observable<Evento> {
    const headers = this.getHeaders();
    return this.http.get<Evento>(`${this.apiUrl}/${id}`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== RESPUESTAS ====================

  responderEvento(respuesta: RespuestaEventoRequest): Observable<any> {
    const headers = this.getHeaders();
    return this.http.post<any>(`${this.apiUrl}/responder`, respuesta, { headers }).pipe(
      map((response: any) => response),
      catchError(this.handleError)
    );
  }

  getRespuestasEvento(eventoId: number): Observable<RespuestaEvento[]> {
    const headers = this.getHeaders();
    return this.http.get<RespuestaEvento[]>(`${this.apiUrl}/${eventoId}/respuestas`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getMiRespuesta(eventoId: number): Observable<RespuestaEvento | null> {
    const headers = this.getHeaders();
    return this.http.get<any>(`${this.apiUrl}/${eventoId}/mi-respuesta`, { headers }).pipe(
      map((response: any) => {
        if (response.yaRespondio === false) {
          return null;
        }
        return response as RespuestaEvento;
      }),
      catchError(this.handleError)
    );
  }

  // ==================== COMENTARIOS ====================

  agregarComentario(eventoId: number, comentario: string): Observable<any> {
    const headers = this.getHeaders();
    return this.http.post<any>(`${this.apiUrl}/${eventoId}/comentarios`, { comentario }, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  getComentarios(eventoId: number): Observable<ComentarioEvento[]> {
    const headers = this.getHeaders();
    return this.http.get<ComentarioEvento[]>(`${this.apiUrl}/${eventoId}/comentarios`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== ESTADISTICAS ====================

  getEstadisticas(eventoId: number): Observable<EstadisticasEvento> {
    const headers = this.getHeaders();
    return this.http.get<EstadisticasEvento>(`${this.apiUrl}/${eventoId}/estadisticas`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  // ==================== UTILIDADES ====================

  getTipoEventoLabel(tipo: string): string {
    switch (tipo) {
      case 'ENCUESTA': return 'Encuesta';
      case 'SI_NO': return 'Si/No';
      case 'ASISTENCIA': return 'Asistencia';
      case 'INFORMATIVO': return 'Informativo';
      default: return tipo;
    }
  }

  getTipoEventoIcon(tipo: string): string {
    switch (tipo) {
      case 'ENCUESTA': return 'bi-bar-chart';
      case 'SI_NO': return 'bi-hand-thumbs-up';
      case 'ASISTENCIA': return 'bi-calendar-check';
      case 'INFORMATIVO': return 'bi-info-circle';
      default: return 'bi-bell';
    }
  }

  getTipoEventoColor(tipo: string): string {
    switch (tipo) {
      case 'ENCUESTA': return 'primary';
      case 'SI_NO': return 'success';
      case 'ASISTENCIA': return 'warning';
      case 'INFORMATIVO': return 'info';
      default: return 'secondary';
    }
  }

  getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'BORRADOR': return 'Borrador';
      case 'ACTIVO': return 'Activo';
      case 'FINALIZADO': return 'Finalizado';
      case 'CANCELADO': return 'Cancelado';
      default: return estado;
    }
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
