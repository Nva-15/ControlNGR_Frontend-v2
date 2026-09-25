import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { EmpleadosService } from '../../../services/empleados';
import { NotificationService } from '../../../services/notification.service';
import { Departamento } from '../../../interfaces/admin';
import { ModalComponent } from '../../shared/modal/modal.component';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-departamentos',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Departamentos</h3>
        <button class="btn-primary btn-sm" (click)="abrir()"><i class="bi bi-plus-lg"></i> Nuevo departamento</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Responsable</th><th>Personal</th><th>Estado</th><th class="text-right"></th></tr></thead>
          <tbody>
            @for (d of departamentos; track d.id) {
              <tr>
                <td class="font-medium">{{ d.nombre }}</td>
                <td class="text-stone-600">{{ d.descripcion }}</td>
                <td>{{ nombreEmpleado(d.responsableId) }}</td>
                <td class="tabular-nums">{{ cantidad(d.id) }}</td>
                <td><span [class]="d.activo ? 'badge-green' : 'badge-gray'">{{ d.activo ? 'Activo' : 'Inactivo' }}</span></td>
                <td class="text-right"><button class="btn-icon" (click)="abrir(d)"><i class="bi bi-pencil"></i></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <app-modal [abierto]="!!form" [titulo]="form?.id ? 'Editar departamento' : 'Nuevo departamento'" (cerrar)="form = null">
      @if (form; as f) {
        <div class="space-y-4">
          <div><label class="label">Nombre</label><input class="input" [(ngModel)]="f.nombre" /></div>
          <div><label class="label">Descripción</label><input class="input" [(ngModel)]="f.descripcion" /></div>
          <div>
            <label class="label">Responsable</label>
            <select class="select" [(ngModel)]="f.responsableId">
              <option [ngValue]="null">Sin responsable</option>
              @for (e of empleados; track e.id) { <option [ngValue]="e.id">{{ e.nombre }}</option> }
            </select>
          </div>
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
export class AdminDepartamentosComponent implements OnInit {
  private admin = inject(AdminService);
  private empleadosService = inject(EmpleadosService);
  private notification = inject(NotificationService);
  departamentos: Departamento[] = [];
  empleados: any[] = [];
  form: Departamento | null = null;

  ngOnInit() {
    this.cargar();
    this.empleadosService.getEmpleados().subscribe(e => this.empleados = e.filter(x => x.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  cargar() { this.admin.departamentos().subscribe(d => this.departamentos = d); }

  nombreEmpleado(id?: number | null) { return this.empleados.find(e => e.id === id)?.nombre || '—'; }
  cantidad(id?: number) { return this.empleados.filter(e => e.departamentoId === id).length; }

  abrir(d?: Departamento) {
    this.form = d ? { ...d } : { nombre: '', descripcion: '', responsableId: null, activo: true };
  }

  guardar() {
    if (!this.form) return;
    this.admin.guardarDepartamento(this.form).subscribe({
      next: () => { this.form = null; this.notification.success('Departamento guardado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
