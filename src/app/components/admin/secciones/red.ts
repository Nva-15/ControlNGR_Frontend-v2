import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { SegmentoRed } from '../../../interfaces/admin';
import { ModalComponent } from '../../shared/modal/modal.component';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-red',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="alert-info mb-4">
      <i class="bi bi-info-circle"></i>
      <div>
        <p>Solo se puede marcar asistencia desde estos segmentos. Formatos: <code class="font-mono">10.92.104.%</code>,
          <code class="font-mono">10.92.104.0/24</code> o una IP exacta. Fuera de ellos el sistema responde <strong>"Está fuera de red"</strong>.</p>
        @if (validar === 'false') { <p class="mt-1 font-semibold">La validación de red está desactivada en Parámetros.</p> }
      </div>
    </div>
    @if (miIp) {
      <div class="card mb-4 flex flex-wrap items-center gap-3 p-4 text-sm">
        <i class="bi bi-pc-display text-lg text-stone-500"></i>
        <span>El servidor ve a este equipo con la IP <strong class="font-mono">{{ miIp.ip }}</strong></span>
        <span [class]="miIp.dentroDeRed ? 'badge-green' : 'badge-red'">{{ miIp.dentroDeRed ? 'Dentro de red' : 'Fuera de red' }}</span>
      </div>
    }
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Segmentos permitidos</h3>
        <button class="btn-primary btn-sm" (click)="abrir()"><i class="bi bi-plus-lg"></i> Agregar segmento</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th>Patrón</th><th>Descripción</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead>
          <tbody>
            @for (s of segmentos; track s.id) {
              <tr>
                <td class="font-medium">{{ s.nombre }}</td>
                <td class="font-mono">{{ s.patron }}</td>
                <td class="text-stone-600">{{ s.descripcion }}</td>
                <td><span [class]="s.activo ? 'badge-green' : 'badge-gray'">{{ s.activo ? 'Activo' : 'Inactivo' }}</span></td>
                <td>
                  <div class="flex justify-end gap-1">
                    <button class="btn-icon" title="Editar" (click)="abrir(s)"><i class="bi bi-pencil"></i></button>
                    <button class="btn-icon hover:bg-red-50! hover:text-red-600!" title="Eliminar" (click)="eliminar(s)"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5"><div class="empty-state">No hay segmentos: nadie podrá marcar asistencia.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [abierto]="!!form" [titulo]="form?.id ? 'Editar segmento' : 'Nuevo segmento'" (cerrar)="form = null">
      @if (form; as f) {
        <div class="space-y-4">
          <div><label class="label">Nombre</label><input class="input" [(ngModel)]="f.nombre" placeholder="Ej.: Red oficina" /></div>
          <div><label class="label">Patrón</label><input class="input font-mono" [(ngModel)]="f.patron" placeholder="10.92.104.%" /></div>
          <div><label class="label">Descripción</label><input class="input" [(ngModel)]="f.descripcion" /></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="checkbox" [(ngModel)]="f.activo" /> Activo</label>
        </div>
      }
      <div footer class="flex gap-2">
        <button class="btn-secondary" (click)="form = null">Cancelar</button>
        <button class="btn-primary" (click)="guardar()">Guardar</button>
      </div>
    </app-modal>
  `
})
export class AdminRedComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  segmentos: SegmentoRed[] = [];
  form: SegmentoRed | null = null;
  validar = 'true';
  miIp: { ip: string; dentroDeRed: boolean } | null = null;

  ngOnInit() {
    this.cargar();
    this.admin.parametros().subscribe(p => this.validar = p.find(x => x.clave === 'VALIDAR_IP_MARCACION')?.valor || 'true');
  }

  cargar() {
    this.admin.segmentos().subscribe(s => this.segmentos = s);
    this.admin.miIp().subscribe({ next: r => this.miIp = r, error: () => this.miIp = null });
  }

  abrir(s?: SegmentoRed) {
    this.form = s ? { ...s } : { nombre: '', patron: '', descripcion: '', activo: true };
  }

  guardar() {
    if (!this.form) return;
    this.admin.guardarSegmento(this.form).subscribe({
      next: () => { this.form = null; this.notification.success('Segmento guardado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  async eliminar(s: SegmentoRed) {
    const ok = await this.notification.confirm({ title: 'Eliminar segmento', message: `¿Eliminar ${s.patron}?`, confirmText: 'Eliminar', type: 'danger' });
    if (!ok) return;
    this.admin.eliminarSegmento(s.id!).subscribe({
      next: () => { this.notification.success('Segmento eliminado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
