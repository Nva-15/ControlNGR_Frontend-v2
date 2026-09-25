import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { DetalleSaldos, MovimientoSaldo, TipoSaldo } from '../interfaces/saldo';

@Injectable({ providedIn: 'root' })
export class SaldosService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get apiUrl() {
    return `${this.apiConfig.apiUrl}/saldos`;
  }

  miSaldo(): Observable<DetalleSaldos> {
    return this.http.get<DetalleSaldos>(`${this.apiUrl}/mi-saldo`);
  }

  misMovimientos(tipo?: TipoSaldo): Observable<MovimientoSaldo[]> {
    const params = tipo ? new HttpParams().set('tipo', tipo) : undefined;
    return this.http.get<MovimientoSaldo[]>(`${this.apiUrl}/mis-movimientos`, { params });
  }

  saldoEmpleado(empleadoId: number): Observable<DetalleSaldos> {
    return this.http.get<DetalleSaldos>(`${this.apiUrl}/empleado/${empleadoId}`);
  }
}
