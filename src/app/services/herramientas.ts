import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import { Herramienta, HerramientaRequest, ListaHerramientas } from '../interfaces/herramienta';

/** Endpoints de "+ Herramientas" (/api/herramientas). */
@Injectable({ providedIn: 'root' })
export class HerramientasService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get url() {
    return `${this.apiConfig.apiUrl}/herramientas`;
  }

  listar(): Observable<ListaHerramientas> { return this.http.get<ListaHerramientas>(this.url); }
  crear(h: HerramientaRequest): Observable<Herramienta> { return this.http.post<Herramienta>(this.url, h); }
  actualizar(id: number, h: HerramientaRequest): Observable<Herramienta> { return this.http.put<Herramienta>(`${this.url}/${id}`, h); }
  eliminar(id: number): Observable<unknown> { return this.http.delete(`${this.url}/${id}`); }
}
