import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { ReglaAprobacion, RolAsistencia, TipoUsuario } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="space-y-6">
      <section class="card">
        <div class="card-header"><h3 class="card-title">Roles</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th>Rol</th><th class="text-center">Empleados</th><th>Nivel</th><th class="text-center">Registra solicitudes</th>
              <th class="text-center">Marca asistencia</th><th class="text-center" title="Recibe horario y aparece en el reporte de asistencia con tardanzas">Con horario</th>
              <th class="text-center">Activo</th>
            </tr></thead>
            <tbody>
              @for (t of roles; track t.id) {
                <tr [attr.data-rol]="t.codigo">
                  <td><p class="font-medium">{{ t.nombre }}</p></td>
                  @if (t.esSistema) {
                    <td colspan="6" class="text-xs text-stone-500">Cuenta técnica del panel maestro (no editable)</td>
                  } @else {
                    <td class="text-center tabular-nums">{{ asistencia(t)?.empleados ?? '—' }}</td>
                    <td><input type="number" class="input w-20 py-1!" [(ngModel)]="t.nivelJerarquia" (change)="guardarRol(t)" /></td>
                    <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.puedeSolicitar" (change)="guardarRol(t)" /></td>
                    @if (asistencia(t); as a) {
                      <td class="text-center">
                        <input type="checkbox" class="checkbox" data-marca [checked]="a.marcaAsistencia" [disabled]="guardando === a.id"
                               (change)="cambiarAsistencia(a, { marcaAsistencia: !a.marcaAsistencia })" />
                      </td>
                      <td class="text-center">
                        @if (a.marcaAsistencia) {
                          <input type="checkbox" class="checkbox" data-horario [checked]="a.conHorario" [disabled]="guardando === a.id"
                                 (change)="cambiarAsistencia(a, { conHorario: !a.conHorario })" />
                        } @else { <span class="text-stone-400" title="No marca asistencia">—</span> }
                      </td>
                    } @else { <td></td><td></td> }
                    <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.activo" (change)="guardarRol(t)" /></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="field-help px-5 pb-4 pt-2">
          <b>Con horario</b>: recibe horario y aparece en el reporte con tardanzas. Sin marcar, el rol tiene <b>horario flexible</b>: marca cualquier día, sin tardanzas,
          y no aparece en Horarios ni en el reporte. Los cambios se aplican de inmediato; los horarios ya creados de un rol que pasa a flexible se conservan.
          La tolerancia y los demás tiempos están en <a routerLink="/admin/asistencia" class="font-medium text-vino-700 hover:underline">Reglas de marcación</a>.
        </p>
      </section>

      <section class="card">
        <div class="card-header"><h3 class="card-title">¿Quién aprueba a quién?</h3></div>
        <div class="card-body space-y-4">
          <div class="flex flex-wrap items-end gap-2">
            <div class="min-w-32 flex-1">
              <label class="label">Solicitudes de</label>
              <select class="select" [(ngModel)]="nuevaSolicitante">
                <option [ngValue]="null" disabled>Rol…</option>
                @for (t of rolesPersonal; track t.id) { <option [ngValue]="t.id">{{ t.nombre }}</option> }
              </select>
            </div>
            <div class="min-w-32 flex-1">
              <label class="label">Las aprueba</label>
              <select class="select" [(ngModel)]="nuevaAprobador">
                <option [ngValue]="null" disabled>Rol…</option>
                @for (t of rolesPersonal; track t.id) { <option [ngValue]="t.id">{{ t.nombre }}</option> }
              </select>
            </div>
            <button class="btn-primary" [disabled]="!nuevaSolicitante || !nuevaAprobador" (click)="agregarRegla()"><i class="bi bi-plus-lg"></i></button>
          </div>
          <ul class="divide-y divide-stone-100 rounded-lg border border-stone-200">
            @for (r of reglas; track r.id) {
              <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span class="flex-1"><span class="font-medium">{{ nombre(r.solicitante) }}</span>
                  <i class="bi bi-arrow-right mx-2 text-stone-400"></i>
                  <span class="font-medium text-vino-700">{{ nombre(r.aprobador) }}</span></span>
                <button class="btn-icon accion-eliminar" title="Quitar" (click)="quitarRegla(r)"><i class="bi bi-x-lg"></i></button>
              </li>
            }
          </ul>
          <p class="field-help">Un rol puede tener varios aprobadores. Nadie puede aprobar sus propias solicitudes.</p>
        </div>
      </section>
    </div>
  `
})
export class AdminRolesComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  roles: TipoUsuario[] = [];
  private rolesAsistencia = new Map<number, RolAsistencia>();
  guardando: number | null = null;
  reglas: ReglaAprobacion[] = [];
  nuevaSolicitante: number | null = null;
  nuevaAprobador: number | null = null;

  ngOnInit() {
    this.admin.tiposUsuario().subscribe(r => this.roles = r);
    this.cargarAsistencia();
    this.cargarReglas();
  }

  get rolesPersonal() { return this.roles.filter(r => !r.esSistema); }

  nombre(codigo: string) { return this.roles.find(r => r.codigo === codigo)?.nombre || codigo; }

  cargarReglas() {
    this.admin.reglas().subscribe(r => this.reglas = r.sort((a, b) => a.solicitante.localeCompare(b.solicitante)));
  }

  private cargarAsistencia() {
    this.admin.rolesAsistencia().subscribe(r => this.rolesAsistencia = new Map(r.map(x => [x.id, x])));
  }

  /** Marca asistencia y horario del rol (antes en Asistencia y horarios). */
  asistencia(t: TipoUsuario) { return this.rolesAsistencia.get(t.id); }

  cambiarAsistencia(r: RolAsistencia, cambios: { marcaAsistencia?: boolean; conHorario?: boolean }) {
    this.guardando = r.id;
    this.admin.configurarRolAsistencia(r.id, cambios).subscribe({
      next: roles => {
        this.rolesAsistencia = new Map(roles.map(x => [x.id, x]));
        this.guardando = null;
        const n = this.rolesAsistencia.get(r.id)!;
        const estado = !n.marcaAsistencia ? 'no marca asistencia' : n.conHorario ? 'marca con horario y aparece en el reporte' : 'marca con horario flexible';
        this.notification.success(`${n.nombre}: ${estado}.`);
      },
      error: e => { this.guardando = null; this.notification.error(mensajeError(e)); this.cargarAsistencia(); }
    });
  }

  guardarRol(t: TipoUsuario) {
    this.admin.actualizarTipoUsuario(t).subscribe({
      next: () => this.notification.success(`Rol "${t.nombre}" actualizado.`),
      error: e => this.notification.error(mensajeError(e))
    });
  }

  agregarRegla() {
    this.admin.crearRegla(this.nuevaSolicitante!, this.nuevaAprobador!).subscribe({
      next: () => { this.notification.success('Regla agregada.'); this.nuevaSolicitante = this.nuevaAprobador = null; this.cargarReglas(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  async quitarRegla(r: ReglaAprobacion) {
    const ok = await this.notification.confirm({
      title: 'Quitar regla', message: `${this.nombre(r.aprobador)} dejará de aprobar solicitudes de ${this.nombre(r.solicitante)}.`,
      confirmText: 'Quitar', type: 'danger'
    });
    if (!ok) return;
    this.admin.eliminarRegla(r.id).subscribe({
      next: () => { this.notification.success('Regla eliminada.'); this.cargarReglas(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
