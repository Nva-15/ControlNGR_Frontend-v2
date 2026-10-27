import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { mensajeError } from '../../../utils/format';
import { ConfigAlerta, TipoAlerta } from '../../../interfaces/reportes-asistencia';
import { ALERTAS_ASISTENCIA } from '../../../utils/alertas-asistencia';

/**
 * Reportes de asistencia: transparencia ("Mi récord" de cada colaborador, apagado por defecto) y
 * mantenimiento del resumen con el que se calculan el dashboard y los récords.
 */
@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (cargado) {
      <section class="card" data-mi-record-config>
        <div class="card-header">
          <h3 class="card-title"><i class="bi bi-person-vcard text-vino-700"></i> Mi récord de asistencia</h3>
          <p class="text-xs text-stone-500">Transparencia: cada colaborador consulta su propio récord desde su perfil.</p>
        </div>
        <div class="card-body space-y-5">
          <label class="flex items-start gap-3">
            <input type="checkbox" class="checkbox mt-0.5" [(ngModel)]="habilitado" data-mi-record-habilitado />
            <span><b>Permitir que cada colaborador vea su récord de asistencia</b><br>
              <span class="text-xs text-stone-500">Solo ve sus propios datos (no los de otras personas ni promedios del equipo), en modo de solo lectura,
                con el aviso de comunicarse con su jefatura si encuentra un error. Recomendado: activarlo cuando RR.HH. lo apruebe y lo comunique.</span></span>
          </label>

          <div>
            <p class="label">Historial que puede ver</p>
            <div class="flex flex-wrap items-center gap-4 text-sm">
              <label class="flex items-center gap-2"><input type="radio" name="desde" value="INGRESO" [(ngModel)]="modoDesde" data-desde-ingreso /> Desde su fecha de ingreso</label>
              <label class="flex items-center gap-2"><input type="radio" name="desde" value="FECHA" [(ngModel)]="modoDesde" data-desde-fecha /> Desde una fecha</label>
              @if (modoDesde === 'FECHA') {
                <input type="date" class="input w-44" [(ngModel)]="fechaDesde" aria-label="Fecha desde la que ve su historial" data-fecha-desde />
              }
            </div>
            <p class="field-help">Use una fecha si los horarios o marcaciones antiguas no están revisados: nadie verá días anteriores a esa fecha (ni anteriores a su ingreso).</p>
          </div>

          <div class="flex justify-end">
            <button class="btn-primary" [disabled]="guardando || !cambio || (modoDesde === 'FECHA' && !fechaDesde)" (click)="guardar()" data-guardar-mi-record>
              {{ guardando ? 'Guardando...' : 'Guardar' }}</button>
          </div>
        </div>
      </section>

      <section class="card mt-6" data-config-alertas>
        <div class="card-header">
          <h3 class="card-title"><i class="bi bi-exclamation-triangle text-amber-600"></i> Alertas para jefaturas</h3>
          <p class="text-xs text-stone-500">Aparecen en Reportes → Dashboard y como aviso en el menú de cada jefatura (solo de su equipo).
            Son indicadores para conversar con la persona, no sanciones; el colaborador no ve alertas sobre sí mismo.</p>
        </div>
        <div class="divide-y divide-stone-100">
          @for (a of alertas; track a.tipo) {
            <div class="grid items-center gap-3 p-5 md:grid-cols-[auto_1fr_auto]" [attr.data-alerta-config]="a.tipo">
              <input type="checkbox" class="checkbox" [(ngModel)]="a.activa" [attr.aria-label]="'Activar ' + info(a.tipo).titulo" />
              <div [class.opacity-50]="!a.activa">
                <p class="font-medium text-stone-900"><i class="bi" [class]="info(a.tipo).icono + ' ' + info(a.tipo).clase"></i> {{ info(a.tipo).titulo }}</p>
                <p class="text-xs text-stone-500">{{ info(a.tipo).ayuda }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-sm" [class.opacity-50]="!a.activa">
                <input type="number" class="input w-24" min="1" [max]="a.tipo === 'MINUTOS_TARDE' ? 10000 : 100" [(ngModel)]="a.umbral"
                       [disabled]="!a.activa" [attr.aria-label]="'Umbral de ' + info(a.tipo).titulo" />
                <span class="text-stone-600">{{ info(a.tipo).unidad }}</span>
                @if (info(a.tipo).conPeriodo) {
                  <select class="select w-36" [(ngModel)]="a.periodo" [disabled]="!a.activa" [attr.aria-label]="'Período de ' + info(a.tipo).titulo">
                    <option value="MES">en el mes</option><option value="SEMANA">en la semana</option>
                  </select>
                } @else { <span class="text-stone-600">en el mes</span> }
              </div>
            </div>
          }
        </div>
        <div class="flex justify-end border-t border-stone-100 p-4">
          <button class="btn-primary" [disabled]="guardandoAlertas || !cambioAlertas || !alertasValidas" (click)="guardarAlertas()" data-guardar-alertas>
            {{ guardandoAlertas ? 'Guardando...' : 'Guardar alertas' }}</button>
        </div>
      </section>

      <section class="card mt-6" data-recalcular>
        <div class="card-header">
          <h3 class="card-title"><i class="bi bi-arrow-repeat text-vino-700"></i> Datos del dashboard</h3>
          <p class="text-xs text-stone-500">El dashboard y los récords usan un resumen diario que se actualiza solo (cada 15 minutos el día de hoy y cada noche los últimos 35 días).</p>
        </div>
        <div class="card-body flex flex-wrap items-end gap-3">
          <div><label class="label" for="recalc-desde">Recalcular desde</label>
            <input id="recalc-desde" type="date" class="input w-44" [(ngModel)]="recalcularDesde" /></div>
          <button class="btn-secondary" [disabled]="recalculando" (click)="recalcular()" data-boton-recalcular>
            <i class="bi bi-arrow-repeat"></i> {{ recalcularDesde ? 'Recalcular desde esa fecha' : 'Recalcular todo el historial' }}</button>
          <p class="field-help w-full">Úselo solo si corrigió horarios, solicitudes o marcaciones de hace más de un mes. Corre en segundo plano y puede tardar unos minutos.</p>
        </div>
      </section>
    }
  `
})
export class AdminReportesComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  cargado = false;
  habilitado = false;
  modoDesde: 'INGRESO' | 'FECHA' = 'INGRESO';
  fechaDesde = '';
  guardando = false;
  recalcularDesde = '';
  recalculando = false;
  private original = { habilitado: false, desde: 'INGRESO' };
  alertas: ConfigAlerta[] = [];
  private alertasOriginales = '';
  guardandoAlertas = false;

  info(tipo: TipoAlerta) { return ALERTAS_ASISTENCIA[tipo]; }

  get cambioAlertas(): boolean { return JSON.stringify(this.alertas) !== this.alertasOriginales; }

  get alertasValidas(): boolean {
    return this.alertas.every(a => Number.isInteger(Number(a.umbral)) && a.umbral >= 1 && a.umbral <= (a.tipo === 'MINUTOS_TARDE' ? 10000 : 100));
  }

  guardarAlertas() {
    this.guardandoAlertas = true;
    this.admin.guardarAlertasAsistencia(this.alertas.map(a => ({ ...a, umbral: Number(a.umbral) }))).subscribe({
      next: c => {
        this.alertas = c;
        this.alertasOriginales = JSON.stringify(c);
        this.guardandoAlertas = false;
        this.notification.success('Alertas guardadas. Se recalcularon las del período en curso.');
      },
      error: e => { this.guardandoAlertas = false; this.notification.error(mensajeError(e)); }
    });
  }

  ngOnInit() {
    this.admin.alertasAsistencia().subscribe({
      next: c => { this.alertas = c; this.alertasOriginales = JSON.stringify(c); },
      error: e => this.notification.error(mensajeError(e))
    });
    this.admin.parametros().subscribe({
      next: ps => {
        const habilitado = ps.find(p => p.clave === 'MI_RECORD_HABILITADO')?.valor === 'true';
        const desde = ps.find(p => p.clave === 'MI_RECORD_DESDE')?.valor || 'INGRESO';
        this.original = { habilitado, desde };
        this.habilitado = habilitado;
        this.modoDesde = desde === 'INGRESO' ? 'INGRESO' : 'FECHA';
        this.fechaDesde = desde === 'INGRESO' ? '' : desde;
        this.cargado = true;
      },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  private get desde(): string { return this.modoDesde === 'INGRESO' ? 'INGRESO' : this.fechaDesde; }

  get cambio(): boolean {
    return this.habilitado !== this.original.habilitado || this.desde !== this.original.desde;
  }

  guardar() {
    this.guardando = true;
    const desde = this.desde;
    this.admin.actualizarParametro('MI_RECORD_DESDE', desde).subscribe({
      next: () => this.admin.actualizarParametro('MI_RECORD_HABILITADO', String(this.habilitado)).subscribe({
        next: () => {
          this.original = { habilitado: this.habilitado, desde };
          this.guardando = false;
          this.notification.success(this.habilitado ? 'Los colaboradores ya pueden ver su récord desde su perfil.' : 'Mi récord de asistencia está desactivado.');
        },
        error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
      }),
      error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
    });
  }

  recalcular() {
    this.recalculando = true;
    this.admin.recalcularResumenAsistencia(this.recalcularDesde || null).subscribe({
      next: r => { this.recalculando = false; this.notification.info(r.mensaje, 'Datos del dashboard', 8000); },
      error: e => { this.recalculando = false; this.notification.error(mensajeError(e)); }
    });
  }
}
