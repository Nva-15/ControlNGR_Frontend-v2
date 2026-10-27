import { AdminParametrosBloqueComponent, CampoParametro } from './parametros-bloque';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { MotivoLicencia, TipoSolicitud } from '../../../interfaces/solicitud';
import { FuncionTurno } from '../../../interfaces/horario';
import { mensajeError } from '../../../utils/format';

@Component({
  selector: 'app-admin-catalogos',
  standalone: true,
  imports: [FormsModule, AdminParametrosBloqueComponent],
  template: `
    <div class="grid gap-6 2xl:grid-cols-5">
      <section class="card 2xl:col-span-3">
        <div class="card-header"><h3 class="card-title">Tipos de solicitud</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nombre</th><th>Descuenta de</th><th class="text-center">Exige evidencia</th><th class="text-center">Activo</th><th></th></tr></thead>
            <tbody>
              @for (t of tipos; track t.id) {
                <tr>
                  <td>
                    <input class="input min-w-44 py-1!" [(ngModel)]="t.nombre" />
                  </td>
                  <td>
                    <span [class]="t.descuentaDe === 'NINGUNO' ? 'badge-gray' : 'badge-oro'">
                      {{ t.descuentaDe === 'VACACIONES' ? 'Vacaciones' : t.descuentaDe === 'COMPENSACION' ? 'Compensación' : 'No descuenta' }}
                    </span>
                  </td>
                  <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.requiereEvidencia" /></td>
                  <td class="text-center"><input type="checkbox" class="checkbox" [(ngModel)]="t.activo" /></td>
                  <td class="text-right"><button class="btn-secondary btn-sm" data-guardar [disabled]="!cambioTipo(t)" (click)="guardarTipo(t)">Guardar</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card 2xl:col-span-2">
        <div class="card-header"><h3 class="card-title">Motivos de licencia</h3></div>
        <div class="card-body space-y-4">
          <div class="flex gap-2">
            <input class="input" [(ngModel)]="nuevoMotivo" placeholder="Nuevo motivo" (keyup.enter)="agregarMotivo()" />
            <button class="btn-primary" [disabled]="!nuevoMotivo.trim()" (click)="agregarMotivo()"><i class="bi bi-plus-lg"></i></button>
          </div>
          <ul class="divide-y divide-stone-100 rounded-lg border border-stone-200">
            @for (m of motivos; track m.id) {
              <li class="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span class="flex-1" [class.text-stone-400]="!m.activo">{{ m.nombre }}</span>
                <label class="flex items-center gap-2 text-xs text-stone-500">
                  <input type="checkbox" class="checkbox" [(ngModel)]="m.activo" (change)="guardarMotivo(m)" /> Activo
                </label>
              </li>
            }
          </ul>
        </div>
      </section>
    </div>

    <section class="card mt-6" data-funciones-turno>
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
    <app-admin-parametros-bloque [campos]="camposCatalogos" />
  `
})
export class AdminCatalogosComponent implements OnInit {
  readonly camposCatalogos: CampoParametro[] = [
    { clave: 'EVIDENCIA_MAX_MB', titulo: 'Tamaño máximo de evidencia', unidad: 'MB', min: 1, max: 50,
      ayuda: 'Límite del archivo (foto o PDF) que se adjunta a descanso médico y licencias.' },
  ];
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  tipos: TipoSolicitud[] = [];
  private originales = new Map<number, string>();
  funciones: FuncionTurno[] = [];
  /** Nombre guardado de cada función (Guardar solo se activa si cambió). */
  nombresFuncion = new Map<number, string>();
  nuevaFuncion = { codigo: '', nombre: '' };
  motivos: MotivoLicencia[] = [];
  nuevoMotivo = '';

  ngOnInit() {
    this.admin.tiposSolicitud().subscribe(t => { this.tipos = t; t.forEach(x => this.originales.set(x.id, this.huella(x))); });
    this.cargarMotivos();
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

  cargarMotivos() { this.admin.motivosLicencia().subscribe(m => this.motivos = m); }

  private huella(t: TipoSolicitud) { return JSON.stringify([t.nombre.trim(), !!t.requiereEvidencia, !!t.activo]); }

  /** Guardar solo se activa si la fila cambió. */
  cambioTipo(t: TipoSolicitud) { return !!t.nombre.trim() && this.huella(t) !== this.originales.get(t.id); }

  guardarTipo(t: TipoSolicitud) {
    this.admin.actualizarTipoSolicitud(t).subscribe({
      next: () => { this.originales.set(t.id, this.huella(t)); this.notification.success(`"${t.nombre}" actualizado.`); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  agregarMotivo() {
    const nombre = this.nuevoMotivo.trim();
    if (!nombre) return;
    this.admin.guardarMotivo({ nombre, activo: true }).subscribe({
      next: () => { this.nuevoMotivo = ''; this.notification.success('Motivo agregado.'); this.cargarMotivos(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  guardarMotivo(m: MotivoLicencia) {
    this.admin.guardarMotivo(m).subscribe({ error: e => this.notification.error(mensajeError(e)) });
  }
}
