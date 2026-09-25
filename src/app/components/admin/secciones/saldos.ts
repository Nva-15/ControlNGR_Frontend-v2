import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { SaldoEmpleado } from '../../../interfaces/admin';
import { FeriadoLaborado, MovimientoSaldo, TipoSaldo } from '../../../interfaces/saldo';
import { ModalComponent } from '../../shared/modal/modal.component';
import { dias, fechaCorta, mensajeError } from '../../../utils/format';
import { rolLabel } from '../../../utils/roles';

@Component({
  selector: 'app-admin-saldos',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative min-w-64 flex-1">
        <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
        <input class="input pl-9!" placeholder="Buscar por nombre o DNI" [(ngModel)]="busqueda" />
      </div>
      <button class="btn-secondary" (click)="verFeriados()"><i class="bi bi-calendar-heart"></i> Feriados laborados</button>
      <button class="btn-secondary" (click)="procesarVacaciones()" [disabled]="procesando"><i class="bi bi-arrow-repeat"></i> Procesar aniversarios</button>
    </div>

    <div class="alert-info mb-4">
      <i class="bi bi-info-circle"></i>
      <p><strong>Carga inicial:</strong> registre los días que se deben a cada empleado a la fecha de hoy. El sistema deja el saldo exactamente
        en ese valor y guarda la diferencia en el historial. Desde aquí en adelante los aniversarios y feriados se abonan solos.</p>
    </div>

    <div class="card">
      @if (cargando) {
        <div class="flex justify-center py-12"><span class="spinner"></span></div>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Empleado</th><th>Ingreso</th><th class="text-right">Vacaciones</th><th class="text-right">Compensación</th><th class="text-right">Acciones</th></tr></thead>
            <tbody>
              @for (s of filtrados; track s.empleadoId) {
                <tr [class.opacity-50]="!s.activo">
                  <td><p class="font-medium">{{ s.empleadoNombre }}</p><p class="text-xs text-stone-500">{{ s.dni }} · {{ rolLabel(s.rol) }}</p></td>
                  <td class="text-stone-600">{{ fechaCorta(s.ingreso) }}</td>
                  <td class="text-right tabular-nums">
                    <span class="font-semibold">{{ dias(s.vacaciones.saldo) }}</span>
                    @if (s.vacaciones.pendiente) { <span class="block text-xs text-stone-400">{{ dias(s.vacaciones.pendiente) }} pendiente</span> }
                  </td>
                  <td class="text-right tabular-nums">
                    <span class="font-semibold">{{ dias(s.compensacion.saldo) }}</span>
                    @if (s.compensacion.pendiente) { <span class="block text-xs text-stone-400">{{ dias(s.compensacion.pendiente) }} pendiente</span> }
                  </td>
                  <td>
                    <div class="flex justify-end gap-1">
                      <button class="btn-secondary btn-sm" (click)="abrirCarga(s)"><i class="bi bi-pencil-square"></i> Carga inicial</button>
                      <button class="btn-ghost btn-sm" (click)="abrirAjuste(s)"><i class="bi bi-plus-slash-minus"></i> Ajuste</button>
                      <button class="btn-icon" title="Historial" (click)="verMovimientos(s)"><i class="bi bi-clock-history"></i></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <app-modal [abierto]="!!carga" titulo="Carga inicial de saldos" [subtitulo]="carga?.emp?.empleadoNombre || ''" (cerrar)="carga = null">
      @if (carga; as c) {
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label">Días de vacaciones pendientes</label>
              <input type="number" min="0" step="0.5" class="input" [(ngModel)]="c.vacaciones" />
              <p class="field-help">Actual: {{ dias(c.emp.vacaciones.saldo) }}</p>
            </div>
            <div>
              <label class="label">Días por compensar</label>
              <input type="number" min="0" step="0.5" class="input" [(ngModel)]="c.compensacion" />
              <p class="field-help">Actual: {{ dias(c.emp.compensacion.saldo) }}</p>
            </div>
          </div>
          <div><label class="label">Observación</label><input class="input" [(ngModel)]="c.observacion" placeholder="Ej.: saldo según RR.HH. al 30/09/2026" /></div>
        </div>
      }
      <div footer class="flex gap-2">
        <button class="btn-secondary" (click)="carga = null">Cancelar</button>
        <button class="btn-primary" [disabled]="guardando" (click)="guardarCarga()">Guardar saldos</button>
      </div>
    </app-modal>

    <app-modal [abierto]="!!ajuste" titulo="Ajuste de saldo" [subtitulo]="ajuste?.emp?.empleadoNombre || ''" (cerrar)="ajuste = null">
      @if (ajuste; as a) {
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label">Saldo</label>
              <select class="select" [(ngModel)]="a.tipo">
                <option value="VACACIONES">Vacaciones</option>
                <option value="COMPENSACION">Compensación</option>
              </select>
            </div>
            <div>
              <label class="label">Días (+ suma, − resta)</label>
              <input type="number" step="0.5" class="input" [(ngModel)]="a.dias" />
            </div>
          </div>
          <div><label class="label">Motivo (obligatorio)</label><input class="input" [(ngModel)]="a.observacion" /></div>
        </div>
      }
      <div footer class="flex gap-2">
        <button class="btn-secondary" (click)="ajuste = null">Cancelar</button>
        <button class="btn-primary" [disabled]="guardando" (click)="guardarAjuste()">Aplicar ajuste</button>
      </div>
    </app-modal>

    <app-modal [abierto]="!!movimientosDe" titulo="Historial de movimientos" [subtitulo]="movimientosDe?.empleadoNombre || ''" tamano="xl" (cerrar)="movimientosDe = null">
      @if (!movimientos.length) { <div class="empty-state">Sin movimientos.</div> }
      @else {
        <div class="table-wrap -mx-6">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Saldo</th><th>Tipo</th><th>Detalle</th><th class="text-right">Días</th><th class="text-right">Resultado</th></tr></thead>
            <tbody>
              @for (m of movimientos; track m.id) {
                <tr>
                  <td class="whitespace-nowrap">{{ fechaCorta(m.fecha) }}</td>
                  <td>{{ m.tipoSaldo === 'VACACIONES' ? 'Vacaciones' : 'Compensación' }}</td>
                  <td><span class="badge-gray">{{ m.tipoMovimiento }}</span></td>
                  <td class="text-stone-600">{{ m.observacion }} <span class="block text-xs text-stone-400">{{ m.registradoPor }}</span></td>
                  <td class="text-right font-semibold tabular-nums" [class]="m.dias >= 0 ? 'text-emerald-700' : 'text-red-700'">{{ m.dias > 0 ? '+' : '' }}{{ dias(m.dias) }}</td>
                  <td class="text-right tabular-nums">{{ dias(m.saldoResultante) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-modal>

    <app-modal [abierto]="mostrarFeriados" titulo="Feriados laborados" subtitulo="Abonos automáticos por trabajar en feriado" tamano="xl" (cerrar)="mostrarFeriados = false">
      @if (!feriados.length) { <div class="empty-state">No hay feriados laborados registrados.</div> }
      @else {
        <div class="table-wrap -mx-6">
          <table class="table">
            <thead><tr><th>Empleado</th><th>Fecha</th><th>Feriado</th><th>Días</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (f of feriados; track f.id) {
                <tr>
                  <td class="font-medium">{{ f.empleadoNombre }}</td>
                  <td>{{ fechaCorta(f.fecha) }}</td>
                  <td>{{ f.feriado }}</td>
                  <td class="tabular-nums">{{ dias(f.diasOtorgados) }}</td>
                  <td>@if (f.estado === 'ABONADO') { <span class="badge-green">Abonado</span> } @else { <span class="badge-gray" [title]="f.observacion || ''">Revertido</span> }</td>
                  <td class="text-right">@if (f.estado === 'ABONADO') { <button class="btn-danger-soft btn-sm" (click)="revertir(f)">Revertir</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-modal>
  `
})
export class AdminSaldosComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  saldos: SaldoEmpleado[] = [];
  cargando = true;
  guardando = false;
  procesando = false;
  busqueda = '';

  carga: { emp: SaldoEmpleado; vacaciones: number | null; compensacion: number | null; observacion: string } | null = null;
  ajuste: { emp: SaldoEmpleado; tipo: TipoSaldo; dias: number | null; observacion: string } | null = null;
  movimientosDe: SaldoEmpleado | null = null;
  movimientos: MovimientoSaldo[] = [];
  mostrarFeriados = false;
  feriados: FeriadoLaborado[] = [];

  readonly dias = dias;
  readonly fechaCorta = fechaCorta;
  readonly rolLabel = rolLabel;

  ngOnInit() { this.cargar(); }

  cargar() {
    this.admin.saldos().subscribe({
      next: s => { this.saldos = s.filter(x => x.rol !== 'director').sort((a, b) => a.empleadoNombre.localeCompare(b.empleadoNombre)); this.cargando = false; },
      error: e => { this.cargando = false; this.notification.error(mensajeError(e)); }
    });
  }

  get filtrados() {
    const q = this.busqueda.trim().toLowerCase();
    return q ? this.saldos.filter(s => s.empleadoNombre.toLowerCase().includes(q) || s.dni.includes(q)) : this.saldos;
  }

  abrirCarga(emp: SaldoEmpleado) {
    this.carga = { emp, vacaciones: emp.vacaciones.saldo, compensacion: emp.compensacion.saldo, observacion: '' };
  }

  guardarCarga() {
    const c = this.carga;
    if (!c) return;
    if ((c.vacaciones ?? 0) < 0 || (c.compensacion ?? 0) < 0) { this.notification.warning('Los saldos no pueden ser negativos.'); return; }
    this.guardando = true;
    this.admin.cargaInicial(c.emp.empleadoId, c.vacaciones, c.compensacion, c.observacion).subscribe({
      next: () => { this.guardando = false; this.carga = null; this.notification.success('Saldos registrados.'); this.cargar(); },
      error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
    });
  }

  abrirAjuste(emp: SaldoEmpleado) {
    this.ajuste = { emp, tipo: 'VACACIONES', dias: null, observacion: '' };
  }

  guardarAjuste() {
    const a = this.ajuste;
    if (!a || !a.dias || !a.observacion.trim()) { this.notification.warning('Indique los días y el motivo.'); return; }
    this.guardando = true;
    this.admin.ajustarSaldo(a.emp.empleadoId, a.tipo, a.dias, a.observacion.trim()).subscribe({
      next: () => { this.guardando = false; this.ajuste = null; this.notification.success('Ajuste aplicado.'); this.cargar(); },
      error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
    });
  }

  verMovimientos(emp: SaldoEmpleado) {
    this.movimientosDe = emp;
    this.movimientos = [];
    this.admin.movimientos(emp.empleadoId).subscribe(m => this.movimientos = m);
  }

  verFeriados() {
    this.mostrarFeriados = true;
    this.admin.feriadosLaborados().subscribe(f => this.feriados = f);
  }

  async revertir(f: FeriadoLaborado) {
    const ok = await this.notification.confirm({
      title: 'Revertir feriado laborado',
      message: `Se descontarán ${dias(f.diasOtorgados)} día(s) de compensación a ${f.empleadoNombre}.`,
      confirmText: 'Revertir', type: 'danger'
    });
    if (!ok) return;
    this.admin.revertirFeriadoLaborado(f.id, 'Revertido desde el panel admin').subscribe({
      next: () => { this.notification.success('Abono revertido.'); this.verFeriados(); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  procesarVacaciones() {
    this.procesando = true;
    this.admin.procesarVacaciones().subscribe({
      next: r => {
        this.procesando = false;
        this.notification.info(r.periodosAbonados ? `Se abonaron ${r.periodosAbonados} periodo(s) de vacaciones.` : 'No hay aniversarios pendientes de abonar.');
        this.cargar();
      },
      error: e => { this.procesando = false; this.notification.error(mensajeError(e)); }
    });
  }
}
