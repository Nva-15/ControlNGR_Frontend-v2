import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  Departamento, Feriado, Parametro, ReglaAprobacion, SaldoEmpleado, SegmentoRed, TipoUsuario, UsuarioAdmin
} from '../interfaces/admin';
import { MotivoLicencia, TipoSolicitud } from '../interfaces/solicitud';
import { FeriadoLaborado, MovimientoSaldo, TipoSaldo } from '../interfaces/saldo';

/** Endpoints del panel maestro (/api/admin/**, solo rol admin). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private apiConfig = inject(ApiConfigService);
  private get url() {
    return `${this.apiConfig.apiUrl}/admin`;
  }

  // Parametros
  parametros(): Observable<Parametro[]> { return this.http.get<Parametro[]>(`${this.url}/parametros`); }
  actualizarParametro(clave: string, valor: string): Observable<Parametro> {
    return this.http.put<Parametro>(`${this.url}/parametros/${clave}`, { valor });
  }

  /** IP con la que el servidor ve a este equipo. */
  miIp(): Observable<{ ip: string; dentroDeRed: boolean }> {
    return this.http.get<{ ip: string; dentroDeRed: boolean }>(`${this.url}/mi-ip`);
  }

  // Segmentos de red
  segmentos(): Observable<SegmentoRed[]> { return this.http.get<SegmentoRed[]>(`${this.url}/segmentos-red`); }
  guardarSegmento(s: SegmentoRed): Observable<SegmentoRed> {
    return s.id ? this.http.put<SegmentoRed>(`${this.url}/segmentos-red/${s.id}`, s)
                : this.http.post<SegmentoRed>(`${this.url}/segmentos-red`, s);
  }
  eliminarSegmento(id: number): Observable<any> { return this.http.delete(`${this.url}/segmentos-red/${id}`); }

  // Feriados
  feriados(anio?: number): Observable<Feriado[]> {
    const params = anio ? new HttpParams().set('anio', anio) : undefined;
    return this.http.get<Feriado[]>(`${this.url}/feriados`, { params });
  }
  guardarFeriado(f: Feriado): Observable<Feriado> {
    return f.id ? this.http.put<Feriado>(`${this.url}/feriados/${f.id}`, f)
                : this.http.post<Feriado>(`${this.url}/feriados`, f);
  }
  eliminarFeriado(id: number): Observable<any> { return this.http.delete(`${this.url}/feriados/${id}`); }

  // Departamentos
  departamentos(): Observable<Departamento[]> { return this.http.get<Departamento[]>(`${this.url}/departamentos`); }
  guardarDepartamento(d: Departamento): Observable<Departamento> {
    return d.id ? this.http.put<Departamento>(`${this.url}/departamentos/${d.id}`, d)
                : this.http.post<Departamento>(`${this.url}/departamentos`, d);
  }

  // Roles y reglas de aprobacion
  tiposUsuario(): Observable<TipoUsuario[]> { return this.http.get<TipoUsuario[]>(`${this.url}/tipos-usuario`); }
  actualizarTipoUsuario(t: TipoUsuario): Observable<TipoUsuario> {
    return this.http.put<TipoUsuario>(`${this.url}/tipos-usuario/${t.id}`, t);
  }
  reglas(): Observable<ReglaAprobacion[]> { return this.http.get<ReglaAprobacion[]>(`${this.url}/reglas-aprobacion`); }
  crearRegla(solicitanteId: number, aprobadorId: number): Observable<ReglaAprobacion[]> {
    return this.http.post<ReglaAprobacion[]>(`${this.url}/reglas-aprobacion`, { solicitanteId, aprobadorId });
  }
  eliminarRegla(id: number): Observable<any> { return this.http.delete(`${this.url}/reglas-aprobacion/${id}`); }

  // Catalogos de solicitudes
  tiposSolicitud(): Observable<TipoSolicitud[]> { return this.http.get<TipoSolicitud[]>(`${this.url}/tipos-solicitud`); }
  actualizarTipoSolicitud(t: TipoSolicitud): Observable<TipoSolicitud> {
    return this.http.put<TipoSolicitud>(`${this.url}/tipos-solicitud/${t.id}`, t);
  }
  motivosLicencia(): Observable<MotivoLicencia[]> { return this.http.get<MotivoLicencia[]>(`${this.url}/motivos-licencia`); }
  guardarMotivo(m: Partial<MotivoLicencia>): Observable<MotivoLicencia> {
    return m.id ? this.http.put<MotivoLicencia>(`${this.url}/motivos-licencia/${m.id}`, m)
                : this.http.post<MotivoLicencia>(`${this.url}/motivos-licencia`, m);
  }

  // Usuarios
  usuarios(): Observable<UsuarioAdmin[]> { return this.http.get<UsuarioAdmin[]>(`${this.url}/usuarios`); }
  cambiarRol(id: number, rol: string): Observable<any> { return this.http.put(`${this.url}/usuarios/${id}/rol`, { rol }); }
  cambiarEstadoUsuario(id: number, activo: boolean): Observable<any> {
    return this.http.patch(`${this.url}/usuarios/${id}/estado`, { activo });
  }
  restablecerPassword(id: number, passwordNueva: string): Observable<any> {
    return this.http.post(`${this.url}/usuarios/${id}/restablecer-password`, { passwordNueva });
  }

  // Saldos
  saldos(): Observable<SaldoEmpleado[]> { return this.http.get<SaldoEmpleado[]>(`${this.url}/saldos`); }
  movimientos(empleadoId: number, tipo?: TipoSaldo): Observable<MovimientoSaldo[]> {
    const params = tipo ? new HttpParams().set('tipo', tipo) : undefined;
    return this.http.get<MovimientoSaldo[]>(`${this.url}/saldos/${empleadoId}/movimientos`, { params });
  }
  cargaInicial(empleadoId: number, vacaciones: number | null, compensacion: number | null, observacion?: string): Observable<any> {
    return this.http.post(`${this.url}/saldos/carga-inicial`, { empleadoId, vacaciones, compensacion, observacion });
  }
  ajustarSaldo(empleadoId: number, tipoSaldo: TipoSaldo, dias: number, observacion: string): Observable<any> {
    return this.http.post(`${this.url}/saldos/ajuste`, { empleadoId, tipoSaldo, dias, observacion });
  }

  // Feriados laborados y vacaciones
  feriadosLaborados(empleadoId?: number): Observable<FeriadoLaborado[]> {
    const params = empleadoId ? new HttpParams().set('empleadoId', empleadoId) : undefined;
    return this.http.get<FeriadoLaborado[]>(`${this.url}/feriados-laborados`, { params });
  }
  revertirFeriadoLaborado(id: number, motivo: string): Observable<FeriadoLaborado> {
    return this.http.post<FeriadoLaborado>(`${this.url}/feriados-laborados/${id}/revertir`, { motivo });
  }
  procesarVacaciones(): Observable<{ periodosAbonados: number }> {
    return this.http.post<{ periodosAbonados: number }>(`${this.url}/vacaciones/procesar`, {});
  }
}
