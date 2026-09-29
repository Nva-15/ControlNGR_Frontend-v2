import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FacialService } from '../../../services/facial';
import { NotificationService } from '../../../services/notification.service';
import { EmpleadoFacial, PruebaMarcacion, PruebaRegistro, ResumenFacial } from '../../../interfaces/facial';
import { ModalComponent } from '../../shared/modal/modal.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { CamaraFacialComponent } from '../../shared/camara-facial/camara-facial.component';
import { fechaCorta, mensajeError } from '../../../utils/format';

type Prueba = 'marcacion' | 'registro';

/** Reconocimiento facial: estado de los registros y pruebas sin afectar la asistencia. */
@Component({
  selector: 'app-admin-facial',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent, AvatarComponent, CamaraFacialComponent],
  template: `
    @if (!resumen) {
      <div class="flex justify-center py-12"><span class="spinner"></span></div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card p-5">
          <p class="stat-label">Rostros registrados</p>
          <p class="stat-value mt-1">{{ resumen.registrados }}<span class="text-lg text-stone-400"> / {{ resumen.total }}</span></p>
          <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div class="h-full bg-emerald-500" [style.width.%]="resumen.total ? resumen.registrados / resumen.total * 100 : 0"></div>
          </div>
        </div>
        <div class="card p-5">
          <p class="stat-label">Umbral de coincidencia</p>
          <p class="stat-value mt-1 font-mono">{{ resumen.umbral }}</p>
          <p class="field-help">0.4 estricto · 0.6 permisivo. <a routerLink="/admin/parametros" class="text-vino-700 hover:underline">Cambiar</a></p>
        </div>
        <div class="card p-5">
          <p class="stat-label">Marcación facial</p>
          <p class="mt-2">
            @if (resumen.obligatorio) { <span class="badge-green"><i class="bi bi-shield-check"></i> Obligatoria</span> }
            @else { <span class="badge-amber"><i class="bi bi-shield-exclamation"></i> Opcional</span> }
          </p>
          <p class="field-help">{{ resumen.obligatorio ? 'Nadie marca sin rostro.' : 'Solo quienes tienen rostro registrado marcan con cámara.' }}</p>
        </div>
      </div>

      <!-- Pruebas -->
      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="bi bi-person-check text-vino-700"></i> Probar marcación</h3>
          </div>
          <div class="card-body space-y-4">
            <p class="text-sm text-stone-600">Captura un rostro y muestra a quién reconoce el sistema y con qué distancia. <b>No registra asistencia.</b></p>
            <div>
              <label class="label" for="comparar">Comparar además con (opcional)</label>
              <select id="comparar" class="select" [(ngModel)]="compararCon" name="comparar">
                <option [ngValue]="null">— Solo identificar —</option>
                @for (e of registrados; track e.empleadoId) { <option [ngValue]="e.empleadoId">{{ e.nombre }}</option> }
              </select>
            </div>
            <button type="button" class="btn-primary" [disabled]="!resumen.registrados" (click)="iniciar('marcacion')">
              <i class="bi bi-camera"></i> Iniciar prueba de marcación
            </button>
            @if (!resumen.registrados) { <p class="field-help">Aún no hay rostros registrados para comparar.</p> }

            @if (pruebaMarcacion; as r) {
              <div class="border-t border-stone-100 pt-4">
                @if (r.reconocido; as rec) {
                  <div class="alert-success">
                    <i class="bi bi-check-circle-fill text-lg"></i>
                    <div><p class="font-semibold">Reconocido: {{ rec.nombre }}</p>
                      <p>Distancia {{ rec.distancia }} (umbral {{ r.umbral }}). Esta persona podría marcar asistencia.</p></div>
                  </div>
                } @else {
                  <div class="alert-warning">
                    <i class="bi bi-question-circle text-lg"></i>
                    <div><p class="font-semibold">No coincide con ningún colaborador registrado</p>
                      <p>Ninguna distancia es menor o igual al umbral ({{ r.umbral }}). La marcación sería rechazada.</p></div>
                  </div>
                }
                @if (r.objetivo; as o) {
                  <div class="mt-3 flex items-center gap-3 rounded-lg bg-stone-50 p-3 text-sm">
                    <app-avatar [nombre]="o.nombre" [foto]="o.foto" [tamano]="32" />
                    <span class="flex-1">Comparado con <b>{{ o.nombre }}</b>:
                      @if (o.registrado) { distancia <span class="font-mono">{{ o.distancia }}</span> } @else { sin rostro registrado }</span>
                    @if (o.registrado) {
                      <span [class]="o.coincide ? 'badge-green' : 'badge-red'">{{ o.coincide ? 'Aceptaría la marcación' : 'Rechazaría la marcación' }}</span>
                    }
                  </div>
                }
                <p class="stat-label mt-4 mb-2">Más parecidos</p>
                <ul class="space-y-2">
                  @for (c of r.candidatos; track c.empleadoId) {
                    <li class="flex items-center gap-3 text-sm">
                      <app-avatar [nombre]="c.nombre" [foto]="c.foto" [tamano]="28" />
                      <span class="w-40 truncate">{{ c.nombre }}</span>
                      <div class="relative h-2 flex-1 overflow-hidden rounded-full bg-stone-100" title="Mientras más corta la barra, más parecido">
                        <div class="h-full rounded-full" [class]="c.coincide ? 'bg-emerald-500' : 'bg-stone-400'" [style.width.%]="barra(c.distancia)"></div>
                        <div class="absolute inset-y-0 w-0.5 bg-vino-600" [style.left.%]="barra(r.umbral)" title="Umbral"></div>
                      </div>
                      <span class="w-14 text-right font-mono tabular-nums">{{ c.distancia }}</span>
                    </li>
                  }
                </ul>
                <p class="field-help mt-2">La línea vertical es el umbral: a su izquierda se acepta la marcación.</p>
              </div>
            }
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h3 class="card-title"><i class="bi bi-person-bounding-box text-vino-700"></i> Probar registro</h3>
          </div>
          <div class="card-body space-y-4">
            <p class="text-sm text-stone-600">Hace las {{ resumen.muestrasRequeridas }} capturas de un registro y revisa si son de buena calidad y si el rostro ya pertenece a alguien. <b>No guarda nada.</b></p>
            <button type="button" class="btn-primary" (click)="iniciar('registro')"><i class="bi bi-camera"></i> Iniciar prueba de registro</button>

            @if (pruebaRegistro; as r) {
              <div class="border-t border-stone-100 pt-4 space-y-3">
                @if (r.aceptable) {
                  <div class="alert-success"><i class="bi bi-check-circle-fill text-lg"></i>
                    <div><p class="font-semibold">El registro sería aceptado</p><p>Capturas consistentes y rostro no registrado en otra cuenta.</p></div></div>
                } @else {
                  <div class="alert-danger"><i class="bi bi-x-circle-fill text-lg"></i>
                    <div><p class="font-semibold">El registro sería rechazado</p>
                      @if (!r.consistente) { <p>Las capturas no parecen de la misma persona (mejore la iluminación y mire de frente).</p> }
                      @if (r.yaRegistradoPara; as d) { <p>Este rostro ya está registrado para <b>{{ d.nombre }}</b> (distancia {{ d.distancia }}).</p> }
                    </div></div>
                }
                <dl class="grid grid-cols-2 gap-3 text-sm">
                  <div><dt class="label">Capturas</dt><dd class="font-medium">{{ r.muestras }}</dd></div>
                  <div><dt class="label">Variación entre capturas</dt>
                    <dd class="font-mono">{{ r.dispersion }} <span class="text-stone-400">/ máx. {{ r.dispersionMaxima }}</span></dd></div>
                </dl>
              </div>
            }
          </div>
        </section>
      </div>

      <!-- Colaboradores -->
      <section class="card mt-6">
        <div class="card-header">
          <h3 class="card-title">Colaboradores que marcan asistencia</h3>
          <input class="input w-56" placeholder="Buscar…" [(ngModel)]="busqueda" name="busqueda" />
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Colaborador</th><th>Rostro</th><th>Capturas</th><th>Registrado el</th><th class="text-right">Acciones</th></tr></thead>
            <tbody>
              @for (e of filtrados; track e.empleadoId) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <app-avatar [nombre]="e.nombre" [foto]="e.foto" [tamano]="32" />
                      <div class="min-w-0"><p class="truncate font-medium">{{ e.nombre }}</p><p class="truncate text-xs text-stone-500">{{ e.cargo }}</p></div>
                    </div>
                  </td>
                  <td>
                    @if (e.registrado) { <span class="badge-green"><i class="bi bi-person-check"></i> Registrado</span> }
                    @else { <span class="badge-gray">Pendiente</span> }
                  </td>
                  <td class="tabular-nums">{{ e.muestras || '—' }}</td>
                  <td class="text-stone-600">{{ e.registrado ? fechaCorta(e.registradoEl) : '—' }}</td>
                  <td>
                    <div class="flex justify-end gap-1">
                      @if (e.registrado) {
                        <button class="btn-icon accion-ver" title="Probar marcación con este colaborador" (click)="probarCon(e)"><i class="bi bi-person-check"></i></button>
                        <button class="btn-icon accion-rostro" title="Restablecer rostro registrado" (click)="restablecer(e)">
                          <span class="relative inline-flex">
                            <i class="bi bi-person-bounding-box"></i>
                            <i class="bi bi-arrow-counterclockwise absolute -bottom-1.5 -right-2 rounded-full bg-white text-[10px] leading-none"></i>
                          </span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="empty-state">No hay colaboradores con esa búsqueda.</div></td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          Cada colaborador registra su rostro en <b>Mi perfil</b>. Para registrarlo en persona use <a routerLink="/empleados" class="text-vino-700 hover:underline">Empleados</a>.
        </p>
      </section>
    }

    <app-modal [abierto]="!!prueba" [titulo]="prueba === 'registro' ? 'Prueba de registro' : 'Prueba de marcación'"
               subtitulo="Solo prueba: no se registra asistencia ni se guarda el rostro" icono="bi-camera"
               [cerrarAlClicFuera]="false" (cerrar)="prueba = null">
      @if (prueba) {
        <app-camara-facial [muestras]="prueba === 'registro' ? resumen?.muestrasRequeridas || 5 : 1" (capturado)="capturado($event)" />
        @if (procesando) {
          <p class="mt-3 flex items-center gap-2 text-sm text-stone-600"><span class="spinner size-4!"></span> Comparando…</p>
        }
      }
      <div footer><button type="button" class="btn-secondary" (click)="prueba = null">Cerrar</button></div>
    </app-modal>
  `
})
export class AdminFacialComponent implements OnInit {
  private facial = inject(FacialService);
  private notification = inject(NotificationService);

  resumen: ResumenFacial | null = null;
  busqueda = '';
  compararCon: number | null = null;
  prueba: Prueba | null = null;
  procesando = false;
  pruebaMarcacion: PruebaMarcacion | null = null;
  pruebaRegistro: PruebaRegistro | null = null;

  readonly fechaCorta = fechaCorta;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.facial.resumenAdmin().subscribe({
      next: r => this.resumen = r,
      error: e => this.notification.error(mensajeError(e), 'Reconocimiento facial')
    });
  }

  get registrados(): EmpleadoFacial[] {
    return (this.resumen?.empleados || []).filter(e => e.registrado);
  }

  get filtrados(): EmpleadoFacial[] {
    const q = this.busqueda.trim().toLowerCase();
    return (this.resumen?.empleados || []).filter(e => !q || e.nombre.toLowerCase().includes(q));
  }

  /** Ancho de la barra: distancia sobre una escala de 0 a 1.2. */
  barra(distancia?: number): number {
    return Math.min(100, ((distancia ?? 0) / 1.2) * 100);
  }

  iniciar(tipo: Prueba) {
    this.procesando = false;
    this.prueba = tipo;
  }

  probarCon(e: EmpleadoFacial) {
    this.compararCon = e.empleadoId;
    this.iniciar('marcacion');
  }

  capturado(descriptores: number[][]) {
    const tipo = this.prueba;
    this.procesando = true;
    const fin = () => { this.procesando = false; setTimeout(() => this.prueba = null, 300); };
    const error = (e: any) => { fin(); this.notification.error(mensajeError(e), 'Prueba de reconocimiento'); };
    if (tipo === 'registro') {
      this.facial.probarRegistro(descriptores).subscribe({ next: r => { this.pruebaRegistro = r; fin(); }, error });
    } else {
      this.facial.probarMarcacion(descriptores[0], this.compararCon).subscribe({ next: r => { this.pruebaMarcacion = r; fin(); }, error });
    }
  }

  async restablecer(e: EmpleadoFacial) {
    const ok = await this.notification.confirm({
      title: 'Restablecer rostro',
      message: `Se borrará el rostro registrado de ${e.nombre}. Deberá registrarlo de nuevo para poder marcar asistencia.`,
      confirmText: 'Restablecer', type: 'warning'
    });
    if (!ok) return;
    this.facial.restablecer(e.empleadoId).subscribe({
      next: () => { this.notification.success('Rostro restablecido.'); this.cargar(); },
      error: err => this.notification.error(mensajeError(err))
    });
  }
}
