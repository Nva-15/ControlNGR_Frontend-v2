import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { CopiaFeriados, Feriado } from '../../../interfaces/admin';
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
          <button class="btn-icon" title="Año anterior" aria-label="Año anterior" (click)="cambiarAnio(-1)"><i class="bi bi-chevron-left"></i></button>
          <h3 class="card-title tabular-nums">{{ anio }}</h3>
          <button class="btn-icon" title="Año siguiente" aria-label="Año siguiente" (click)="cambiarAnio(1)"><i class="bi bi-chevron-right"></i></button>
          <span class="badge-gray">{{ feriados.length }} feriados</span>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary btn-sm" data-copiar-feriados [disabled]="!feriados.length" (click)="abrirCopia()"
                  [title]="feriados.length ? '' : 'No hay feriados en ' + anio + ' para copiar'">
            <i class="bi bi-copy"></i> Copiar a {{ anio + 1 }}
          </button>
          <button class="btn-primary btn-sm" (click)="abrir()"><i class="bi bi-plus-lg"></i> Agregar feriado</button>
        </div>
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
                    <button class="btn-icon accion-editar" title="Editar" (click)="abrir(f)"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn-icon accion-eliminar" title="Eliminar" (click)="eliminar(f)"><i class="bi bi-trash3"></i></button>
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

    <app-modal [abierto]="!!copia" [titulo]="'Copiar feriados de ' + copia?.origen + ' a ' + copia?.destino"
               subtitulo="Mismo día y mes; Jueves y Viernes Santo se recalculan según la Semana Santa del año" icono="bi-copy"
               tamano="lg" (cerrar)="copia = null">
      @if (copia; as c) {
        <div class="table-wrap -mx-1">
          <table class="table">
            <thead><tr><th class="w-10"></th><th>Feriado</th><th>{{ c.origen }}</th><th>{{ c.destino }}</th><th>Estado</th></tr></thead>
            <tbody>
              @for (i of c.items; track i.id) {
                <tr [attr.data-copia]="i.descripcion" [class.opacity-60]="i.estado !== 'nuevo'">
                  <td>
                    <input type="checkbox" class="checkbox" [disabled]="i.estado !== 'nuevo'"
                           [checked]="i.estado === 'nuevo' && seleccion.has(i.id)" (change)="alternar(i.id)" />
                  </td>
                  <td>{{ i.descripcion }}</td>
                  <td class="tabular-nums text-stone-500">{{ corta(i.fechaOrigen) }}</td>
                  <td class="tabular-nums font-medium">
                    {{ i.fechaNueva ? corta(i.fechaNueva) + ' · ' + diaSemana(i.fechaNueva) : '—' }}
                  </td>
                  <td>
                    @switch (i.estado) {
                      @case ('nuevo') {
                        @if (i.movil) { <span class="badge-oro" title="Fecha calculada según la Pascua">Semana Santa</span> }
                        @else { <span class="badge-green">Se copiará</span> }
                      }
                      @case ('existe') { <span class="badge-gray">Ya registrado</span> }
                      @case ('fecha_ocupada') { <span class="badge-gray">Fecha ya es feriado</span> }
                      @case ('fecha_invalida') { <span class="badge-amber">No existe ese año</span> }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!copiables) {
          <p class="mt-3 text-sm text-stone-600"><i class="bi bi-check-circle text-emerald-600"></i> Todos los feriados de {{ c.origen }} ya están registrados en {{ c.destino }}.</p>
        } @else {
          <p class="field-help mt-3">Revise las fechas antes de copiar. Después puede editar o eliminar cualquier feriado del año {{ c.destino }}.</p>
        }
      }
      <div footer class="flex gap-2">
        <button class="btn-secondary" (click)="copia = null">Cancelar</button>
        <button class="btn-primary" data-confirmar-copia [disabled]="!seleccionadosCopiables || copiando" (click)="confirmarCopia()">
          @if (copiando) { <span class="spinner size-4! border-white/40! border-t-white!"></span> }
          Copiar {{ seleccionadosCopiables }} feriado(s)
        </button>
      </div>
    </app-modal>

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

  // Copia al año siguiente
  copia: CopiaFeriados | null = null;
  seleccion = new Set<number>();
  copiando = false;

  ngOnInit() { this.cargar(); }

  cargar() { this.admin.feriados(this.anio).subscribe(f => this.feriados = f); }

  cambiarAnio(d: number) { this.anio += d; this.cargar(); }

  diaSemana(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', { weekday: 'long' });
  }

  corta(iso: string): string {
    return iso.split('-').reverse().join('/');
  }

  /** Vista previa de la copia del año mostrado al siguiente. */
  abrirCopia() {
    this.admin.copiarFeriados(this.anio, this.anio + 1, true).subscribe({
      next: c => {
        this.copia = c;
        this.seleccion = new Set(c.items.filter(i => i.estado === 'nuevo').map(i => i.id));
      },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  alternar(id: number) {
    const s = new Set(this.seleccion);
    s.has(id) ? s.delete(id) : s.add(id);
    this.seleccion = s;
  }

  get copiables(): number {
    return this.copia?.items.filter(i => i.estado === 'nuevo').length ?? 0;
  }

  get seleccionadosCopiables(): number {
    return this.copia?.items.filter(i => i.estado === 'nuevo' && this.seleccion.has(i.id)).length ?? 0;
  }

  confirmarCopia() {
    const c = this.copia;
    if (!c) return;
    this.copiando = true;
    this.admin.copiarFeriados(c.origen, c.destino, false, [...this.seleccion]).subscribe({
      next: r => {
        this.copiando = false;
        this.copia = null;
        this.notification.success(`Se copiaron ${r.creados} feriado(s) a ${r.destino}.`);
        this.anio = r.destino;
        this.cargar();
      },
      error: e => { this.copiando = false; this.notification.error(mensajeError(e)); }
    });
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
