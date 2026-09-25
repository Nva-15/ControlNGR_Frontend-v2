import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { Feriado } from '../../../interfaces/admin';
import { ModalComponent } from '../../shared/modal/modal.component';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-feriados',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <div class="flex items-center gap-2">
          <button class="btn-icon" (click)="cambiarAnio(-1)"><i class="bi bi-chevron-left"></i></button>
          <h3 class="card-title tabular-nums">{{ anio }}</h3>
          <button class="btn-icon" (click)="cambiarAnio(1)"><i class="bi bi-chevron-right"></i></button>
          <span class="badge-gray">{{ feriados.length }} feriados</span>
        </div>
        <button class="btn-primary btn-sm" (click)="abrir()"><i class="bi bi-plus-lg"></i> Agregar feriado</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Fecha</th><th>Día</th><th>Descripción</th><th>Tipo</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead>
          <tbody>
            @for (f of feriados; track f.id) {
              <tr [class.opacity-50]="!f.activo">
                <td class="font-medium tabular-nums">{{ f.fecha.split('-').reverse().join('/') }}</td>
                <td class="capitalize text-stone-600">{{ diaSemana(f.fecha) }}</td>
                <td>{{ f.descripcion }}</td>
                <td class="capitalize">{{ f.tipo }}</td>
                <td><span [class]="f.activo ? 'badge-green' : 'badge-gray'">{{ f.activo ? 'Activo' : 'Inactivo' }}</span></td>
                <td>
                  <div class="flex justify-end gap-1">
                    <button class="btn-icon" title="Editar" (click)="abrir(f)"><i class="bi bi-pencil"></i></button>
                    <button class="btn-icon hover:bg-red-50! hover:text-red-600!" title="Eliminar" (click)="eliminar(f)"><i class="bi bi-trash"></i></button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6"><div class="empty-state">No hay feriados registrados para {{ anio }}.</div></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [abierto]="!!form" [titulo]="form?.id ? 'Editar feriado' : 'Nuevo feriado'" (cerrar)="form = null">
      @if (form; as f) {
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label class="label">Fecha</label><input type="date" class="input" [(ngModel)]="f.fecha" /></div>
            <div>
              <label class="label">Tipo</label>
              <select class="select" [(ngModel)]="f.tipo">
                <option value="nacional">Nacional</option>
                <option value="regional">Regional</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
          </div>
          <div><label class="label">Descripción</label><input class="input" [(ngModel)]="f.descripcion" /></div>
          <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="checkbox" [(ngModel)]="f.activo" /> Activo (trabajarlo abona días de compensación)</label>
        </div>
      }
      <div footer class="flex gap-2">
        <button class="btn-secondary" (click)="form = null">Cancelar</button>
        <button class="btn-primary" (click)="guardar()">Guardar</button>
      </div>
    </app-modal>
  `
})
export class AdminFeriadosComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  anio = new Date().getFullYear();
  feriados: Feriado[] = [];
  form: Feriado | null = null;

  ngOnInit() { this.cargar(); }

  cargar() { this.admin.feriados(this.anio).subscribe(f => this.feriados = f); }

  cambiarAnio(d: number) { this.anio += d; this.cargar(); }

  diaSemana(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long' });
  }

  abrir(f?: Feriado) {
    this.form = f ? { ...f } : { fecha: `${this.anio}-01-01`, descripcion: '', tipo: 'nacional', activo: true };
  }

  guardar() {
    if (!this.form) return;
    this.admin.guardarFeriado(this.form).subscribe({
      next: () => { this.form = null; this.notification.success('Feriado guardado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  async eliminar(f: Feriado) {
    const ok = await this.notification.confirm({ title: 'Eliminar feriado', message: `¿Eliminar "${f.descripcion}"?`, confirmText: 'Eliminar', type: 'danger' });
    if (!ok) return;
    this.admin.eliminarFeriado(f.id!).subscribe({
      next: () => { this.notification.success('Feriado eliminado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
