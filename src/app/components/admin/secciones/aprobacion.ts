import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { AprobacionAutomatica } from '../../../interfaces/admin';
import { fechaCorta, horaCorta, mensajeError } from '../../../utils/format';

const CAMPOS: (keyof AprobacionAutomatica)[] =
  ['activo', 'cupoSemanal', 'maximoPorEmpleado', 'minimoEnTurno', 'antelacionHoras', 'alLlenarse', 'promoverEspera'];

/**
 * Aprobación automática de compensaciones por equipo: cupo semanal, máximo por empleado, cobertura mínima
 * y antelación. Lo que no cumple queda en la sala de espera para el supervisor.
 */
@Component({
  selector: 'app-admin-aprobacion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Reglas por equipo</h3>
      </div>
      <div class="grid gap-3 border-b border-stone-100 px-5 py-4 text-sm text-stone-600 md:grid-cols-3">
        <p><span class="badge-green">Aprobada sola</span> La compensación de 1 día que cumple todas las reglas se aprueba al enviarla, por orden de llegada.</p>
        <p><span class="badge-amber">Sala de espera</span> Si no cumple alguna regla queda pendiente: el colaborador ve el motivo y su supervisor decide.</p>
        <p><span class="badge-red">Urgente</span> Las urgencias personales y las solicitudes con poca antelación siempre las revisa el supervisor.</p>
      </div>

      @if (cargando) {
        <div class="flex justify-center py-12"><span class="spinner"></span></div>
      } @else {
        <div class="table-wrap">
          <table class="table [&_td]:px-2 [&_th]:px-2">
            <thead>
              <tr>
                <th>Equipo</th>
                <th class="text-center">Activo</th>
                <th class="text-center" title="Días de compensación por semana para todo el equipo">Cupo equipo</th>
                <th class="text-center" title="Días de compensación por semana para cada empleado">Por empleado</th>
                <th class="text-center" title="Personas que deben quedar en turno cada día">Mín. en turno</th>
                <th class="text-center" title="Horas de anticipación">Antelación h</th>
                <th>Al llenarse</th>
                <th class="text-center" title="Aprobar la primera en espera si se libera un cupo">Promover</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of filas; track r.departamentoId) {
                <tr [attr.data-depto]="r.departamento">
                  <td>
                    <p class="font-medium">{{ r.departamento }}</p>
                    <p class="text-xs text-stone-500">
                      @if (r.actualizadoPor) { {{ r.actualizadoPor }} · {{ fecha(r.actualizadoEn) }} }
                      @else if (!r.configurado) { Sin configurar: flujo manual. Marque Activo para usarla. }
                    </p>
                  </td>
                  <td class="text-center"><input type="checkbox" class="checkbox" data-activo [(ngModel)]="r.activo" /></td>
                  <td class="text-center"><input type="number" min="0" max="50" class="input w-14 px-1 text-center" data-cupo [(ngModel)]="r.cupoSemanal" [disabled]="!r.activo" /></td>
                  <td class="text-center"><input type="number" min="0" max="7" class="input w-14 px-1 text-center" data-maximo [(ngModel)]="r.maximoPorEmpleado" [disabled]="!r.activo" /></td>
                  <td class="text-center"><input type="number" min="0" max="100" class="input w-14 px-1 text-center" data-minimo [(ngModel)]="r.minimoEnTurno" [disabled]="!r.activo" /></td>
                  <td class="text-center"><input type="number" min="0" max="720" class="input w-14 px-1 text-center" data-antelacion [(ngModel)]="r.antelacionHoras" [disabled]="!r.activo" /></td>
                  <td>
                    <select class="select w-36" data-llenarse [(ngModel)]="r.alLlenarse" [disabled]="!r.activo">
                      <option value="ESPERA">En espera</option>
                      <option value="RECHAZO">Rechazar</option>
                    </select>
                  </td>
                  <td class="text-center"><input type="checkbox" class="checkbox" data-promover [(ngModel)]="r.promoverEspera" [disabled]="!r.activo" /></td>
                  <td class="text-right">
                    <button class="btn-secondary btn-sm" data-guardar [disabled]="!cambio(r) || guardando === r.departamentoId" (click)="guardar(r)">Guardar</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9"><div class="empty-state">No hay departamentos activos.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <div class="field-help space-y-1 px-5 pb-4 pt-2">
          <p><b>Cupo equipo:</b> días de compensación que se aprueban solos entre todo el equipo de lunes a domingo.</p>
          <p><b>Mínimo en turno:</b> personas que deben quedar trabajando ese día según el horario publicado (los descansos ya se descuentan).</p>
          <p><b>Por empleado:</b> días de compensación por semana para cada persona (más días van a la sala de espera).</p>
          <p><b>Antelación:</b> con menos horas de anticipación la solicitud se trata como urgencia y la decide el supervisor.</p>
          <p><b>Al llenarse:</b> qué pasa cuando el cupo del equipo está completo: queda en espera para el supervisor o se rechaza sola.</p>
          <p><b>Promover:</b> si se libera un cupo, se aprueba sola la primera en espera que ya cumpla las reglas.</p>
          <p>Los cambios se aplican a las solicitudes nuevas. Las de más de 1 día van a la sala de espera; las de equipos sin configurar y las de otros tipos siguen el flujo manual.</p>
        </div>
      }
    </div>
  `
})
export class AdminAprobacionComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  filas: AprobacionAutomatica[] = [];
  private originales = new Map<number, AprobacionAutomatica>();
  cargando = true;
  guardando: number | null = null;

  ngOnInit() { this.cargar(); }

  cargar() {
    this.admin.aprobacionAutomatica().subscribe({
      next: lista => {
        this.originales = new Map(lista.map(r => [r.departamentoId, { ...r }]));
        this.filas = lista.map(r => ({ ...r }));
        this.cargando = false;
      },
      error: e => { this.cargando = false; this.notification.error(mensajeError(e)); }
    });
  }

  cambio(r: AprobacionAutomatica) {
    const o = this.originales.get(r.departamentoId);
    return !o || CAMPOS.some(c => String(r[c]) !== String(o[c]));
  }

  fecha(iso?: string | null) {
    return iso ? `${fechaCorta(iso)} ${horaCorta(iso.substring(11))}` : '';
  }

  guardar(r: AprobacionAutomatica) {
    this.guardando = r.departamentoId;
    const cambios = Object.fromEntries(CAMPOS.map(c => [c, r[c]])) as Partial<AprobacionAutomatica>;
    this.admin.guardarAprobacionAutomatica(r.departamentoId, cambios).subscribe({
      next: g => {
        this.guardando = null;
        this.originales.set(g.departamentoId, { ...g });
        this.filas = this.filas.map(f => f.departamentoId === g.departamentoId ? { ...g } : f);
        this.notification.success(`Reglas de ${g.departamento} guardadas.`);
      },
      error: e => { this.guardando = null; this.notification.error(mensajeError(e)); }
    });
  }
}
