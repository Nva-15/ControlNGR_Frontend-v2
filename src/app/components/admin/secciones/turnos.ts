import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminParametrosBloqueComponent, CampoParametro } from './parametros-bloque';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { FuncionTurno } from '../../../interfaces/horario';
import { mensajeError } from '../../../utils/format';

/** Cómo se arman los horarios: funciones de turno (LT, SP...), jornada de cada turno y entradas sugeridas. */
@Component({
  selector: 'app-admin-turnos',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminParametrosBloqueComponent],
  template: `
    <section class="card" data-funciones-turno>
      <div class="card-header">
        <h3 class="card-title">Funciones de turno</h3>
        <p class="text-xs text-stone-500">Rol que cumple la persona en su turno. En Horarios se muestran por su código, p. ej. "08:30 – 17:30 (SP) (PRE)".</p>
      </div>
      <div class="card-body space-y-4">
        <div class="flex flex-wrap gap-2">
          <input class="input w-28 uppercase" [(ngModel)]="nuevaFuncion.codigo" placeholder="Código" maxlength="10" aria-label="Código" data-nueva-codigo />
          <input class="input min-w-48 flex-1" [(ngModel)]="nuevaFuncion.nombre" placeholder="Nombre (p. ej. Soporte presencial)" aria-label="Nombre"
                 (keyup.enter)="agregarFuncion()" data-nueva-nombre />
          <button class="btn-primary" [disabled]="!nuevaFuncion.codigo.trim() || !nuevaFuncion.nombre.trim()" (click)="agregarFuncion()" data-agregar-funcion>
            <i class="bi bi-plus-lg"></i> Agregar</button>
        </div>
        <ul class="divide-y divide-stone-100 rounded-lg border border-stone-200">
          @for (f of funciones; track f.id) {
            <li class="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" [attr.data-funcion]="f.codigo">
              <span class="w-14 font-semibold" [class.text-stone-400]="!f.activo">{{ f.codigo }}</span>
              <input class="input min-w-48 flex-1 py-1!" [(ngModel)]="f.nombre" [attr.aria-label]="'Nombre de ' + f.codigo" />
              <button class="btn-secondary btn-sm" [disabled]="!f.nombre.trim() || f.nombre === nombresFuncion.get(f.id)" (click)="guardarFuncion(f)">Guardar</button>
              <label class="flex items-center gap-2 text-xs text-stone-500">
                <input type="checkbox" class="checkbox" [(ngModel)]="f.activo" (change)="guardarFuncion(f)" /> Activa
              </label>
            </li>
          } @empty {
            <li class="px-4 py-3 text-sm text-stone-500">Aún no hay funciones.</li>
          }
        </ul>
        <p class="field-help">Una función inactiva ya no se puede elegir, pero se sigue mostrando en los horarios que la tienen.</p>
      </div>
    </section>
    <app-admin-parametros-bloque [campos]="camposTurnos" />
    <p class="field-help mt-3">
      Los turnos de cada semana se arman en <a routerLink="/horarios" class="font-medium text-vino-700 hover:underline">Horarios</a>.
      Tolerancia, anticipación y salida automática están en
      <a routerLink="/admin/asistencia" class="font-medium text-vino-700 hover:underline">Reglas de marcación</a>.
    </p>
  `
})
export class AdminTurnosComponent implements OnInit {
  readonly camposTurnos: CampoParametro[] = [
    { clave: 'JORNADA_MANANA_HORAS', titulo: 'Jornada del turno mañana', unidad: 'horas', min: 1, max: 16, paso: 0.25,
      ayuda: 'Al armar un horario, la salida del turno mañana se calcula sola: entrada + estas horas, con 1 h de refrigerio incluida que empieza 4 h después de la entrada (por ejemplo, 9 → 08:30 a 17:30, refrigerio 12:30 a 13:30). Se puede cambiar en cada día.' },
    { clave: 'JORNADA_TARDE_HORAS', titulo: 'Jornada del turno tarde', unidad: 'horas', min: 1, max: 16, paso: 0.25,
      ayuda: 'Salida del turno tarde = entrada + estas horas, sin refrigerio (por ejemplo, 8 → 17:00 a 01:00). Se puede cambiar en cada día.' },
    { clave: 'ENTRADA_MANANA_SUGERIDA', titulo: 'Entrada sugerida del turno mañana',
      ayuda: 'Hora que se propone al elegir turno mañana al armar un horario (se puede cambiar en cada día).' },
    { clave: 'ENTRADA_TARDE_SUGERIDA', titulo: 'Entrada sugerida del turno tarde',
      ayuda: 'Hora que se propone al elegir turno tarde (por ejemplo, 17:00 → salida 01:00).' },
  ];
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  funciones: FuncionTurno[] = [];
  /** Nombre guardado de cada función (Guardar solo se activa si cambió). */
  nombresFuncion = new Map<number, string>();
  nuevaFuncion = { codigo: '', nombre: '' };

  ngOnInit() {
    this.cargarFunciones();
  }

  cargarFunciones() {
    this.admin.funcionesTurno().subscribe(f => {
      this.funciones = f;
      this.nombresFuncion = new Map(f.map(x => [x.id, x.nombre]));
    });
  }

  agregarFuncion() {
    const codigo = this.nuevaFuncion.codigo.trim().toUpperCase();
    const nombre = this.nuevaFuncion.nombre.trim();
    if (!codigo || !nombre) return;
    this.admin.guardarFuncionTurno({ codigo, nombre, activo: true }).subscribe({
      next: () => { this.nuevaFuncion = { codigo: '', nombre: '' }; this.notification.success(`Función ${codigo} agregada.`); this.cargarFunciones(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  guardarFuncion(f: FuncionTurno) {
    this.admin.guardarFuncionTurno({ id: f.id, nombre: f.nombre.trim(), activo: f.activo }).subscribe({
      next: g => { this.nombresFuncion.set(g.id, g.nombre); this.notification.success(`Función ${g.codigo} guardada.`); },
      error: e => { this.notification.error(mensajeError(e)); this.cargarFunciones(); }
    });
  }
}
