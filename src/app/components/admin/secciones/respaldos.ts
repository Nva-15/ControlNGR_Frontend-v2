import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { EstadoRespaldos, FrecuenciaRespaldo, ProgramacionRespaldo, Respaldo } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Respaldos de la base de datos: programación automática, respaldo inmediato e historial. */
@Component({
  selector: 'app-admin-respaldos',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (!estado) {
      <div class="flex justify-center py-12"><span class="spinner"></span></div>
    } @else {
      @if (!estado.carpetaDisponible) {
        <div class="alert-danger mb-4">
          <i class="bi bi-exclamation-octagon text-lg"></i>
          <div><p class="font-semibold">No se puede escribir en la carpeta de respaldos</p>
            <p>Vuelva a encender el sistema con <code>scripts\\iniciar.ps1</code>; el script le da permiso a la carpeta <code>respaldos</code>.</p></div>
        </div>
      }

      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Programación -->
        <section class="card lg:col-span-3">
          <div class="card-header">
            <h3 class="card-title"><i class="bi bi-calendar-check text-vino-700"></i> Respaldo automático</h3>
            @if (estado.programacion.frecuencia !== 'NINGUNA' && estado.proximo) {
              <span class="badge-green"><i class="bi bi-clock"></i> Próximo: {{ fechaHora(estado.proximo) }}</span>
            } @else {
              <span class="badge-gray">Desactivado</span>
            }
          </div>
          <div class="card-body space-y-5">
            <div>
              <label class="label">Frecuencia</label>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Frecuencia">
                @for (f of frecuencias; track f.valor) {
                  <button type="button" role="radio" [attr.aria-checked]="form.frecuencia === f.valor" [attr.data-frecuencia]="f.valor"
                          class="flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm font-medium transition"
                          [class]="form.frecuencia === f.valor ? 'border-vino-500 bg-vino-50 text-vino-700' : 'border-stone-200 text-stone-600 hover:bg-stone-50'"
                          (click)="form.frecuencia = f.valor">
                    <i class="bi text-lg" [class]="f.icono"></i>{{ f.texto }}
                  </button>
                }
              </div>
            </div>

            @if (form.frecuencia !== 'NINGUNA') {
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="label" for="hora-respaldo">Hora</label>
                  <input id="hora-respaldo" type="time" class="input" [(ngModel)]="form.hora" required />
                  <p class="field-help">Hora de Lima. Elija una hora con poco uso (por ejemplo, de madrugada).</p>
                </div>
                @if (form.frecuencia === 'SEMANAL') {
                  <div>
                    <label class="label" for="dia-semana">Día de la semana</label>
                    <select id="dia-semana" class="select" [(ngModel)]="form.diaSemana">
                      @for (d of dias; track $index) { <option [ngValue]="$index + 1">{{ d }}</option> }
                    </select>
                  </div>
                }
                @if (form.frecuencia === 'MENSUAL') {
                  <div>
                    <label class="label" for="dia-mes">Día del mes</label>
                    <input id="dia-mes" type="number" min="1" max="31" class="input" [(ngModel)]="form.diaMes" />
                    <p class="field-help">Si el mes tiene menos días, se hace el último día del mes.</p>
                  </div>
                }
                <div>
                  <label class="label" for="conservar">Respaldos automáticos a conservar</label>
                  <input id="conservar" type="number" min="1" max="365" class="input" [(ngModel)]="form.conservar" />
                  <p class="field-help">Al superar esta cantidad se borra el más antiguo. Los manuales no se borran solos.</p>
                </div>
              </div>
              <label class="flex items-start gap-3 text-sm">
                <input type="checkbox" class="checkbox mt-0.5" [(ngModel)]="form.incluirArchivos" />
                <span><span class="font-medium">Incluir fotos y evidencias</span>
                  <span class="block text-stone-500">Recomendado para poder restaurar todo en otro equipo. El archivo es más pesado.</span></span>
              </label>
              <p class="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600"><i class="bi bi-info-circle"></i> {{ resumen() }}</p>
            }

            <div class="flex justify-end">
              <button type="button" class="btn-primary" data-guardar-programacion [disabled]="guardando" (click)="guardar()">
                <i class="bi bi-check2"></i> Guardar programación
              </button>
            </div>
          </div>
        </section>

        <!-- Respaldo inmediato -->
        <section class="card lg:col-span-2">
          <div class="card-header">
            <h3 class="card-title"><i class="bi bi-database-down text-vino-700"></i> Respaldo ahora</h3>
          </div>
          <div class="card-body space-y-4">
            <p class="text-sm text-stone-600">Genera un respaldo en este momento, por ejemplo antes de actualizar el sistema o de cambiarlo de equipo.</p>
            <label class="flex items-center gap-3 text-sm">
              <input type="checkbox" class="checkbox" [(ngModel)]="manualConArchivos" />
              <span>Incluir fotos y evidencias</span>
            </label>
            <button type="button" class="btn-primary w-full" data-respaldar-ahora [disabled]="estado.enCurso || creando" (click)="respaldarAhora()">
              @if (estado.enCurso) { <span class="spinner size-4! border-white/40! border-t-white!"></span> Respaldo en curso… }
              @else { <i class="bi bi-database-down"></i> Crear respaldo ahora }
            </button>
            <div class="rounded-lg border border-stone-200 p-3 text-xs text-stone-500">
              <p class="font-medium text-stone-700"><i class="bi bi-folder2-open"></i> ¿Dónde quedan?</p>
              <p class="mt-1">En la carpeta <code class="font-mono">respaldos</code> dentro de <code class="font-mono">ControlNGR_Backend-v2</code> del servidor. También puede descargarlos desde la tabla.</p>
              <p class="mt-1">Cada ZIP incluye un <b>LEEME.txt</b> con los pasos para restaurarlo.</p>
            </div>
          </div>
        </section>
      </div>

      <!-- Historial -->
      <section class="card mt-6">
        <div class="card-header">
          <h3 class="card-title">Historial de respaldos</h3>
          <button type="button" class="btn-ghost btn-sm" (click)="cargar()"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>
        </div>
        @if (!estado.respaldos.length) {
          <div class="empty-state"><i class="bi bi-database text-3xl"></i><p>Aún no se ha generado ningún respaldo.</p></div>
        } @else {
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Contenido</th><th>Estado</th><th class="text-right">Tamaño</th><th class="text-right">Acciones</th></tr></thead>
              <tbody>
                @for (r of estado.respaldos; track r.id) {
                  <tr [attr.data-respaldo]="r.estado">
                    <td class="whitespace-nowrap">
                      <p class="font-medium">{{ fechaHora(r.iniciadoEn) }}</p>
                      <p class="font-mono text-[11px] text-stone-400">{{ r.archivo }}</p>
                    </td>
                    <td>
                      @if (r.tipo === 'PROGRAMADO') { <span class="badge-blue"><i class="bi bi-calendar-check"></i> Automático</span> }
                      @else { <span class="badge-gray" [title]="r.creadoPor || ''"><i class="bi bi-hand-index"></i> Manual</span> }
                    </td>
                    <td class="text-sm text-stone-600">{{ r.incluyeArchivos ? 'Base de datos, fotos y evidencias' : 'Base de datos' }}</td>
                    <td>
                      @switch (r.estado) {
                        @case ('COMPLETADO') { <span class="badge-green"><i class="bi bi-check-circle"></i> Completado</span> }
                        @case ('EN_CURSO') { <span class="badge-amber"><span class="spinner size-3!"></span> En curso</span> }
                        @default { <span class="badge-red" [title]="r.mensaje || ''"><i class="bi bi-x-circle"></i> Fallido</span> }
                      }
                      @if (r.estado === 'FALLIDO' && r.mensaje) { <p class="mt-1 max-w-72 text-xs text-red-700">{{ r.mensaje }}</p> }
                      @if (r.estado === 'COMPLETADO' && !r.disponible) { <p class="mt-1 text-xs text-stone-500">El archivo ya no está en la carpeta.</p> }
                    </td>
                    <td class="text-right tabular-nums">{{ tamano(r.tamanoBytes) }}</td>
                    <td>
                      <div class="flex justify-end gap-1">
                        @if (r.disponible) {
                          <button type="button" class="btn-icon accion-ver" title="Descargar" aria-label="Descargar respaldo"
                                  [disabled]="descargando === r.id" (click)="descargar(r)">
                            @if (descargando === r.id) { <span class="spinner size-4!"></span> } @else { <i class="bi bi-download"></i> }
                          </button>
                        }
                        @if (r.estado !== 'EN_CURSO') {
                          <button type="button" class="btn-icon accion-eliminar" title="Eliminar" aria-label="Eliminar respaldo" (click)="eliminar(r)">
                            <i class="bi bi-trash"></i>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <p class="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          <i class="bi bi-shield-lock"></i> Los respaldos contienen datos personales (las contraseñas van encriptadas). Guárdelos en un lugar seguro y no los comparta.
        </p>
      </section>
    }
  `
})
export class AdminRespaldosComponent implements OnInit, OnDestroy {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  estado: EstadoRespaldos | null = null;
  form: ProgramacionRespaldo = { frecuencia: 'NINGUNA', hora: '02:00', diaSemana: 1, diaMes: 1, conservar: 10, incluirArchivos: true };
  manualConArchivos = true;
  guardando = false;
  creando = false;
  descargando: number | null = null;
  private sondeo: ReturnType<typeof setTimeout> | null = null;

  readonly dias = DIAS;
  readonly frecuencias: { valor: FrecuenciaRespaldo; texto: string; icono: string }[] = [
    { valor: 'NINGUNA', texto: 'Desactivado', icono: 'bi-slash-circle' },
    { valor: 'DIARIA', texto: 'Diario', icono: 'bi-calendar-day' },
    { valor: 'SEMANAL', texto: 'Semanal', icono: 'bi-calendar-week' },
    { valor: 'MENSUAL', texto: 'Mensual', icono: 'bi-calendar-month' },
  ];

  ngOnInit() {
    this.cargar(true);
  }

  ngOnDestroy() {
    if (this.sondeo) clearTimeout(this.sondeo);
  }

  cargar(conFormulario = false) {
    this.admin.respaldos().subscribe({
      next: e => {
        this.estado = e;
        if (conFormulario) this.form = { ...e.programacion, hora: e.programacion.hora.substring(0, 5) };
        this.programarSondeo();
      },
      error: err => this.notification.error(mensajeError(err), 'Respaldos')
    });
  }

  /** Mientras haya un respaldo en curso se consulta el estado cada 3 segundos. */
  private programarSondeo() {
    if (this.sondeo) clearTimeout(this.sondeo);
    this.sondeo = null;
    const pendiente = this.estado && (this.estado.enCurso || this.estado.respaldos.some(r => r.estado === 'EN_CURSO'));
    if (pendiente) this.sondeo = setTimeout(() => this.cargar(), 3000);
  }

  resumen(): string {
    const f = this.form;
    const hora = f.hora || '--:--';
    const contenido = f.incluirArchivos ? 'la base de datos, fotos y evidencias' : 'solo la base de datos';
    switch (f.frecuencia) {
      case 'DIARIA': return `Todos los días a las ${hora} se respaldará ${contenido}.`;
      case 'SEMANAL': return `Cada ${DIAS[(f.diaSemana || 1) - 1].toLowerCase()} a las ${hora} se respaldará ${contenido}.`;
      case 'MENSUAL': return `El día ${f.diaMes} de cada mes a las ${hora} se respaldará ${contenido}.`;
      default: return '';
    }
  }

  guardar() {
    const f = this.form;
    if (f.frecuencia !== 'NINGUNA') {
      if (!/^\d{2}:\d{2}$/.test(f.hora || '')) { this.notification.warning('Indique la hora del respaldo.'); return; }
      if (!(f.diaMes >= 1 && f.diaMes <= 31)) { this.notification.warning('El día del mes debe estar entre 1 y 31.'); return; }
      if (!(f.conservar >= 1 && f.conservar <= 365)) { this.notification.warning('Conserve entre 1 y 365 respaldos.'); return; }
    }
    this.guardando = true;
    this.admin.programarRespaldos(f).subscribe({
      next: () => {
        this.guardando = false;
        this.notification.success(f.frecuencia === 'NINGUNA' ? 'Respaldo automático desactivado.' : 'Programación guardada.');
        this.cargar(true);
      },
      error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
    });
  }

  respaldarAhora() {
    this.creando = true;
    this.admin.crearRespaldo(this.manualConArchivos).subscribe({
      next: () => { this.creando = false; this.notification.info('Respaldo iniciado. Puede seguir trabajando mientras se genera.'); this.cargar(); },
      error: e => { this.creando = false; this.notification.error(mensajeError(e)); this.cargar(); }
    });
  }

  descargar(r: Respaldo) {
    this.descargando = r.id;
    this.admin.descargarRespaldo(r.id).subscribe({
      next: blob => { this.descargando = null; saveAs(blob, r.archivo); },
      error: () => { this.descargando = null; this.notification.error('No se pudo descargar el respaldo.'); this.cargar(); }
    });
  }

  async eliminar(r: Respaldo) {
    const ok = await this.notification.confirm({
      title: 'Eliminar respaldo',
      message: `Se borrará el archivo ${r.archivo} de la carpeta de respaldos. Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar', type: 'danger'
    });
    if (!ok) return;
    this.admin.eliminarRespaldo(r.id).subscribe({
      next: () => { this.notification.success('Respaldo eliminado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  fechaHora(iso?: string | null): string {
    if (!iso) return '—';
    const [f, h] = iso.split('T');
    const [a, m, d] = f.split('-');
    return `${d}/${m}/${a} ${(h || '').substring(0, 5)}`;
  }

  tamano(bytes?: number | null): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  }
}
