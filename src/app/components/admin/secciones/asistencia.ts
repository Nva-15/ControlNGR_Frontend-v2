import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { PersonalReporte } from '../../../interfaces/admin';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { mensajeError } from '../../../utils/format';
import { rolBadge, rolLabel } from '../../../utils/roles';

const TOLERANCIA = 'TOLERANCIA_TARDANZA_MINUTOS';

/** Tolerancia de tardanza y personal que aparece en el reporte de asistencia. */
@Component({
  selector: 'app-admin-asistencia',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  template: `
    <div class="card p-5">
      <div class="grid items-center gap-4 md:grid-cols-[1fr_10rem_auto]">
        <div>
          <p class="font-medium text-stone-900">Tolerancia de tardanza</p>
          <p class="text-xs text-stone-500">
            Minutos después de la hora de entrada programada en los que la marcación aún cuenta como puntual.
            Pasado ese tiempo se registra como tardanza (también en el reporte).
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input type="number" min="0" max="120" step="1" class="input" data-tolerancia [(ngModel)]="tolerancia" />
          <span class="text-sm text-stone-500">min</span>
        </div>
        <button class="btn-primary btn-sm" data-guardar-tolerancia
                [disabled]="guardandoTolerancia || !toleranciaValida || '' + tolerancia === toleranciaActual"
                (click)="guardarTolerancia()">Guardar</button>
      </div>
      @if (!toleranciaValida) { <p class="field-error mt-2">Ingrese un número entero entre 0 y 120.</p> }
    </div>

    <div class="card mt-6">
      <div class="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div class="min-w-60 flex-1">
          <p class="font-medium text-stone-900">Personal incluido en el reporte de asistencia</p>
          <p class="text-xs text-stone-500">
            Marque a quiénes se les aplica el reporte. Director, gerente y jefe tienen horario flexible y no figuran.
            {{ seleccionados.size }} de {{ personal.length }} seleccionados.
          </p>
        </div>
        <input class="input w-60" placeholder="Buscar por nombre o cargo" [(ngModel)]="busqueda" />
        <button class="btn-secondary btn-sm" (click)="marcarTodos(true)">Marcar todos</button>
        <button class="btn-secondary btn-sm" (click)="marcarTodos(false)">Quitar todos</button>
      </div>

      @if (cargando) {
        <div class="flex justify-center py-12"><span class="spinner"></span></div>
      } @else if (!personal.length) {
        <div class="empty-state"><i class="bi bi-people text-4xl"></i><p>No hay personal con horario.</p></div>
      } @else {
        <ul class="divide-y divide-stone-100">
          @for (p of filtrados; track p.id) {
            <li>
              <label class="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-stone-50" [attr.data-personal]="p.id">
                <input type="checkbox" class="checkbox" [checked]="seleccionados.has(p.id)" (change)="alternar(p.id)" />
                <app-avatar [nombre]="p.nombre" [foto]="p.foto" [tamano]="32" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-medium">{{ p.nombre }}</p>
                  <p class="truncate text-xs text-stone-500">{{ p.cargo }}</p>
                </div>
                <span [class]="rolBadge(p.rol)">{{ rolLabel(p.rol) }}</span>
              </label>
            </li>
          }
        </ul>
      }

      <div class="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
        <button class="btn-secondary" [disabled]="!hayCambios || guardando" (click)="deshacer()">Deshacer</button>
        <button class="btn-primary" data-guardar-personal [disabled]="!hayCambios || guardando" (click)="guardarPersonal()">
          @if (guardando) { <span class="spinner size-4! border-white/40! border-t-white!"></span> }
          Guardar selección
        </button>
      </div>
    </div>
  `
})
export class AdminAsistenciaComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  readonly rolBadge = rolBadge;
  readonly rolLabel = rolLabel;

  tolerancia: number | string = '';
  toleranciaActual = '';
  guardandoTolerancia = false;

  personal: PersonalReporte[] = [];
  seleccionados = new Set<number>();
  busqueda = '';
  cargando = true;
  guardando = false;

  ngOnInit() {
    this.cargarTolerancia();
    this.cargarPersonal();
  }

  get toleranciaValida(): boolean {
    const n = Number(this.tolerancia);
    return this.tolerancia !== '' && this.tolerancia !== null && Number.isInteger(n) && n >= 0 && n <= 120;
  }

  cargarTolerancia() {
    this.admin.parametros().subscribe({
      next: ps => {
        const p = ps.find(x => x.clave === TOLERANCIA);
        this.toleranciaActual = p?.valor ?? '10';
        this.tolerancia = this.toleranciaActual;
      },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  guardarTolerancia() {
    if (!this.toleranciaValida) return;
    this.guardandoTolerancia = true;
    this.admin.actualizarParametro(TOLERANCIA, String(Number(this.tolerancia))).subscribe({
      next: p => {
        this.guardandoTolerancia = false;
        this.toleranciaActual = p.valor;
        this.tolerancia = p.valor;
        this.notification.success(`Tolerancia de tardanza: ${p.valor} minuto(s).`);
      },
      error: e => { this.guardandoTolerancia = false; this.notification.error(mensajeError(e)); }
    });
  }

  cargarPersonal() {
    this.cargando = true;
    this.admin.personalReporte().subscribe({
      next: p => this.aplicar(p),
      error: e => { this.cargando = false; this.notification.error(mensajeError(e)); }
    });
  }

  private aplicar(p: PersonalReporte[]) {
    this.personal = p;
    this.seleccionados = new Set(p.filter(x => x.enReporte).map(x => x.id));
    this.cargando = false;
  }

  get filtrados(): PersonalReporte[] {
    const q = this.busqueda.trim().toLowerCase();
    return q ? this.personal.filter(p => p.nombre.toLowerCase().includes(q) || (p.cargo || '').toLowerCase().includes(q))
             : this.personal;
  }

  get hayCambios(): boolean {
    return this.personal.some(p => p.enReporte !== this.seleccionados.has(p.id));
  }

  alternar(id: number) {
    if (this.seleccionados.has(id)) this.seleccionados.delete(id);
    else this.seleccionados.add(id);
    this.seleccionados = new Set(this.seleccionados);
  }

  /** Marca o quita a todos los que se ven con el filtro actual. */
  marcarTodos(incluir: boolean) {
    const s = new Set(this.seleccionados);
    this.filtrados.forEach(p => incluir ? s.add(p.id) : s.delete(p.id));
    this.seleccionados = s;
  }

  deshacer() {
    this.seleccionados = new Set(this.personal.filter(x => x.enReporte).map(x => x.id));
  }

  guardarPersonal() {
    this.guardando = true;
    this.admin.guardarPersonalReporte([...this.seleccionados]).subscribe({
      next: p => {
        this.guardando = false;
        this.aplicar(p);
        this.notification.success('Personal del reporte de asistencia actualizado.');
      },
      error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
    });
  }
}
