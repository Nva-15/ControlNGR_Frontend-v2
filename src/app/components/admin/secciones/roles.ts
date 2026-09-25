import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { ReglaAprobacion, TipoUsuario } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="grid gap-6 xl:grid-cols-5">
      <section class="card xl:col-span-3">
        <div class="card-header"><h3 class="card-title">Roles</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Rol</th><th>Nivel</th><th class="text-center">Registra solicitudes</th><th class="text-center">Marca asistencia</th><th class="text-center">Activo</th></tr></thead>
            <tbody>
              @for (t of roles; track t.id) {
                <tr>
                  <td>
                    <p class="font-medium">{{ t.nombre }}</p>
                    <p class="font-mono text-xs text-stone-500">{{ t.codigo }}</p>
                  </td>
                  @if (t.esSistema) {
                    <td colspan="4" class="text-xs text-stone-500">Cuenta técnica del panel maestro (no editable)</td>
                  } @else {
                    <td><input type="number" class="input w-20 py-1!" [(ngModel)]="t.nivelJerarquia" (change)="guardarRol(t)" /></td>
                    <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.puedeSolicitar" (change)="guardarRol(t)" /></td>
                    <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.marcaAsistencia" (change)="guardarRol(t)" /></td>
                    <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.activo" (change)="guardarRol(t)" /></td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card xl:col-span-2">
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
                <button class="btn-icon hover:bg-red-50! hover:text-red-600!" title="Quitar" (click)="quitarRegla(r)"><i class="bi bi-x-lg"></i></button>
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
  reglas: ReglaAprobacion[] = [];
  nuevaSolicitante: number | null = null;
  nuevaAprobador: number | null = null;

  ngOnInit() {
    this.admin.tiposUsuario().subscribe(r => this.roles = r);
    this.cargarReglas();
  }

  get rolesPersonal() { return this.roles.filter(r => !r.esSistema); }

  nombre(codigo: string) { return this.roles.find(r => r.codigo === codigo)?.nombre || codigo; }

  cargarReglas() {
    this.admin.reglas().subscribe(r => this.reglas = r.sort((a, b) => a.solicitante.localeCompare(b.solicitante)));
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
