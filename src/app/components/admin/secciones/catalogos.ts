import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { MotivoLicencia, TipoSolicitud } from '../../../interfaces/solicitud';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-catalogos',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="grid gap-6 xl:grid-cols-5">
      <section class="card xl:col-span-3">
        <div class="card-header"><h3 class="card-title">Tipos de solicitud</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nombre</th><th>Descuenta de</th><th class="text-center">Exige evidencia</th><th class="text-center">Activo</th><th></th></tr></thead>
            <tbody>
              @for (t of tipos; track t.id) {
                <tr>
                  <td>
                    <input class="input py-1!" [(ngModel)]="t.nombre" />
                    <p class="mt-1 font-mono text-xs text-stone-500">{{ t.codigo }}</p>
                  </td>
                  <td>
                    <span [class]="t.descuentaDe === 'NINGUNO' ? 'badge-gray' : 'badge-oro'">
                      {{ t.descuentaDe === 'VACACIONES' ? 'Vacaciones' : t.descuentaDe === 'COMPENSACION' ? 'Compensación' : 'No descuenta' }}
                    </span>
                  </td>
                  <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.requiereEvidencia" /></td>
                  <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.activo" /></td>
                  <td class="text-right"><button class="btn-secondary btn-sm" (click)="guardarTipo(t)">Guardar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card xl:col-span-2">
        <div class="card-header"><h3 class="card-title">Motivos de licencia</h3></div>
        <div class="card-body space-y-4">
          <div class="flex gap-2">
            <input class="input" [(ngModel)]="nuevoMotivo" placeholder="Nuevo motivo" (keyup.enter)="agregarMotivo()" />
            <button class="btn-primary" [disabled]="!nuevoMotivo.trim()" (click)="agregarMotivo()"><i class="bi bi-plus-lg"></i></button>
          </div>
          <ul class="divide-y divide-stone-100 rounded-lg border border-stone-200">
            @for (m of motivos; track m.id) {
              <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span class="flex-1" [class.text-stone-400]="!m.activo">{{ m.nombre }}</span>
                <label class="flex items-center gap-2 text-xs text-stone-500">
                  <input type="checkbox" class="checkbox" [(ngModel)]="m.activo" (change)="guardarMotivo(m)" /> Activo
                </label>
              </li>
            }
          </ul>
        </div>
      </section>
    </div>
  `
})
export class AdminCatalogosComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  tipos: TipoSolicitud[] = [];
  motivos: MotivoLicencia[] = [];
  nuevoMotivo = '';

  ngOnInit() {
    this.admin.tiposSolicitud().subscribe(t => this.tipos = t);
    this.cargarMotivos();
  }

  cargarMotivos() { this.admin.motivosLicencia().subscribe(m => this.motivos = m); }

  guardarTipo(t: TipoSolicitud) {
    this.admin.actualizarTipoSolicitud(t).subscribe({
      next: () => this.notification.success(`"${t.nombre}" actualizado.`),
      error: e => this.notification.error(mensajeError(e))
    });
  }

  agregarMotivo() {
    const nombre = this.nuevoMotivo.trim();
    if (!nombre) return;
    this.admin.guardarMotivo({ nombre, activo: true }).subscribe({
      next: () => { this.nuevoMotivo = ''; this.notification.success('Motivo agregado.'); this.cargarMotivos(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  guardarMotivo(m: MotivoLicencia) {
    this.admin.guardarMotivo(m).subscribe({ error: e => this.notification.error(mensajeError(e)) });
  }
}
