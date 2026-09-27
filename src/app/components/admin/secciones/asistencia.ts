import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { RolAsistencia } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

const TOLERANCIA = 'TOLERANCIA_TARDANZA_MINUTOS';

/**
 * Asistencia y horarios por rol: quién marca, quién trabaja con horario (aparece en Horarios y en el
 * reporte de asistencia) y la tolerancia de tardanza.
 */
@Component({
  selector: 'app-admin-asistencia',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Configuración por rol</h3>
      </div>
      <div class="grid gap-3 border-b border-stone-100 px-5 py-4 text-sm text-stone-600 md:grid-cols-3">
        <p><span class="badge-green">Con horario</span> Marca asistencia, recibe horario y aparece en el <b>reporte de asistencia</b> (con tardanzas).</p>
        <p><span class="badge-oro">Horario flexible</span> Marca asistencia cualquier día, sin horario ni tardanzas. No aparece en Horarios ni en el reporte.</p>
        <p><span class="badge-gray">No marca</span> No registra asistencia. No aparece en Horarios ni en el reporte.</p>
      </div>

      @if (cargando) {
        <div class="flex justify-center py-12"><span class="spinner"></span></div>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Rol</th>
                <th class="text-center">Empleados activos</th>
                <th class="text-center">Marca asistencia</th>
                <th class="text-center">Horario y reporte de asistencia</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              @for (r of roles; track r.id) {
                <tr [attr.data-rol]="r.codigo">
                  <td>
                    <p class="font-medium">{{ r.nombre }}</p>
                    <p class="font-mono text-xs text-stone-500">{{ r.codigo }}@if (!r.activo) { · inactivo }</p>
                  </td>
                  <td class="text-center tabular-nums">{{ r.empleados }}</td>
                  <td class="text-center">
                    <input type="checkbox" class="checkbox" data-marca [checked]="r.marcaAsistencia" [disabled]="guardando === r.id"
                           (change)="cambiar(r, { marcaAsistencia: !r.marcaAsistencia })" />
                  </td>
                  <td class="text-center">
                    <input type="checkbox" class="checkbox" data-horario [checked]="r.conHorario" [disabled]="guardando === r.id || !r.marcaAsistencia"
                           [title]="r.marcaAsistencia ? '' : 'Primero marque Marca asistencia'"
                           (change)="cambiar(r, { conHorario: !r.conHorario })" />
                  </td>
                  <td>
                    @if (!r.marcaAsistencia) { <span class="badge-gray">No marca</span> }
                    @else if (r.conHorario) { <span class="badge-green">Con horario</span> }
                    @else { <span class="badge-oro">Horario flexible</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="field-help px-5 pb-4 pt-2">
          Los cambios se aplican de inmediato en Horarios, en el reporte de asistencia (y su filtro de roles) y al marcar.
          Los horarios ya creados de un rol que pasa a flexible se conservan, pero dejan de usarse.
        </p>
      }
    </div>

    <div class="card mt-6 p-5">
      <div class="grid items-center gap-4 md:grid-cols-[1fr_10rem_auto]">
        <div>
          <p class="font-medium text-stone-900">Tolerancia de tardanza</p>
          <p class="text-xs text-stone-500">
            Minutos después de la hora de entrada programada en los que la marcación aún cuenta como puntual.
            Solo se aplica a los roles con horario, al marcar y en el reporte.
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
  `
})
export class AdminAsistenciaComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  roles: RolAsistencia[] = [];
  cargando = true;
  guardando: number | null = null;

  tolerancia: number | string = '';
  toleranciaActual = '';
  guardandoTolerancia = false;

  ngOnInit() {
    this.cargarRoles();
    this.cargarTolerancia();
  }

  cargarRoles() {
    this.admin.rolesAsistencia().subscribe({
      next: r => { this.roles = r; this.cargando = false; },
      error: e => { this.cargando = false; this.notification.error(mensajeError(e)); }
    });
  }

  cambiar(r: RolAsistencia, cambios: { marcaAsistencia?: boolean; conHorario?: boolean }) {
    this.guardando = r.id;
    this.admin.configurarRolAsistencia(r.id, cambios).subscribe({
      next: roles => {
        this.roles = roles;
        this.guardando = null;
        const n = roles.find(x => x.id === r.id)!;
        const estado = !n.marcaAsistencia ? 'no marca asistencia' : n.conHorario ? 'marca con horario y aparece en el reporte' : 'marca con horario flexible';
        this.notification.success(`${n.nombre}: ${estado}.`);
      },
      error: e => {
        this.guardando = null;
        this.notification.error(mensajeError(e));
        this.cargarRoles();
      }
    });
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
}
