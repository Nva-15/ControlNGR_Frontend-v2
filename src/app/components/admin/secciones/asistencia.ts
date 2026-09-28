import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { RolAsistencia } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

interface CampoParametro {
  clave: string;
  titulo: string;
  ayuda: string;
  unidad: string;
  min: number;
  max: number;
  porDefecto: string;
}

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

    <div class="card mt-6 divide-y divide-stone-100">
      @for (c of campos; track c.clave) {
        <div class="p-5" [attr.data-parametro]="c.clave">
          <div class="grid items-center gap-4 md:grid-cols-[1fr_10rem_auto]">
            <div>
              <p class="font-medium text-stone-900">{{ c.titulo }}</p>
              <p class="text-xs text-stone-500">{{ c.ayuda }}</p>
            </div>
            <div class="flex items-center gap-2">
              <input type="number" [min]="c.min" [max]="c.max" step="1" class="input" [(ngModel)]="valores[c.clave]" />
              <span class="text-sm text-stone-500">{{ c.unidad }}</span>
            </div>
            <button class="btn-primary btn-sm" data-guardar
                    [disabled]="guardandoParametro === c.clave || !valido(c) || '' + valores[c.clave] === actuales[c.clave]"
                    (click)="guardarParametro(c)">Guardar</button>
          </div>
          @if (!valido(c)) { <p class="field-error mt-2">Ingrese un número entero entre {{ c.min }} y {{ c.max }}.</p> }
        </div>
      }
    </div>
  `
})
export class AdminAsistenciaComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  roles: RolAsistencia[] = [];
  cargando = true;
  guardando: number | null = null;

  readonly campos: CampoParametro[] = [
    { clave: 'TOLERANCIA_TARDANZA_MINUTOS', titulo: 'Tolerancia de tardanza', unidad: 'min', min: 0, max: 120, porDefecto: '10',
      ayuda: 'Minutos después de la hora de entrada programada en los que la marcación aún cuenta como puntual. Solo se aplica a los roles con horario, al marcar y en el reporte.' },
    { clave: 'SALIDA_AUTOMATICA_HORAS', titulo: 'Salida automática', unidad: 'horas', min: 1, max: 23, porDefecto: '12',
      ayuda: 'Si el colaborador no marca su salida, el sistema la registra sola estas horas después de la entrada (por ejemplo, entrada 17:00 → salida 05:00 del día siguiente). Queda marcada como "automática" en el reporte.' },
  ];
  valores: Record<string, number | string> = {};
  actuales: Record<string, string> = {};
  guardandoParametro: string | null = null;

  ngOnInit() {
    this.cargarRoles();
    this.cargarParametros();
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

  valido(c: CampoParametro): boolean {
    const v = this.valores[c.clave];
    const n = Number(v);
    return v !== '' && v !== null && v !== undefined && Number.isInteger(n) && n >= c.min && n <= c.max;
  }

  cargarParametros() {
    this.admin.parametros().subscribe({
      next: ps => {
        for (const c of this.campos) {
          this.actuales[c.clave] = ps.find(x => x.clave === c.clave)?.valor ?? c.porDefecto;
          this.valores[c.clave] = this.actuales[c.clave];
        }
      },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  guardarParametro(c: CampoParametro) {
    if (!this.valido(c)) return;
    this.guardandoParametro = c.clave;
    this.admin.actualizarParametro(c.clave, String(Number(this.valores[c.clave]))).subscribe({
      next: p => {
        this.guardandoParametro = null;
        this.actuales[c.clave] = p.valor;
        this.valores[c.clave] = p.valor;
        this.notification.success(`${c.titulo}: ${p.valor} ${c.unidad === 'min' ? 'minuto(s)' : 'hora(s)'}.`);
      },
      error: e => { this.guardandoParametro = null; this.notification.error(mensajeError(e)); }
    });
  }
}
