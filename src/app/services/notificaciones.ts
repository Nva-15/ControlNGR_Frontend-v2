import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { NotificacionResumen } from '../interfaces/notificacion';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);

  private resumenSubject = new BehaviorSubject<NotificacionResumen | null>(null);
  resumen$ = this.resumenSubject.asObservable();

  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/notificaciones`;
  }

  cargarResumen(): Observable<NotificacionResumen> {
    return this.http.get<NotificacionResumen>(`${this.apiUrl}/resumen`).pipe(
      tap(resumen => this.resumenSubject.next(resumen)),
      catchError(() => {
        this.resumenSubject.next(null);
        return of(null as any);
      })
    );
  }

  getResumenActual(): NotificacionResumen | null {
    return this.resumenSubject.getValue();
  }

  limpiarSolicitudes() {
    const actual = this.resumenSubject.getValue();
    if (actual) {
      this.resumenSubject.next({
        ...actual,
        solicitudesPendientes: 0,
        solicitudesAprobadas: 0,
        solicitudesRechazadas: 0
      });
    }
  }

  limpiar() {
    this.resumenSubject.next(null);
  }
}
