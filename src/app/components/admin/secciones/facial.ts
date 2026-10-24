import { AdminParametrosBloqueComponent, CampoParametro } from './parametros-bloque';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FacialService } from '../../../services/facial';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { EmpleadoFacial, ModoEquipo, ModoMarcacion, PruebaMarcacion, PruebaRegistro, ResumenFacial } from '../../../interfaces/facial';
import { ModalComponent } from '../../shared/modal/modal.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { CamaraFacialComponent } from '../../shared/camara-facial/camara-facial.component';
import { PaginacionComponent } from '../../shared/paginacion/paginacion.component';
import { Pagina } from '../../../interfaces/admin';
import { fechaCorta, horaCorta, mensajeError } from '../../../utils/format';

type Prueba = 'marcacion' | 'registro';

/** Reconocimiento facial: estado de los registros y pruebas sin afectar la asistencia. */
@Component({
  selector: 'app-admin-facial',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent, AvatarComponent, CamaraFacialComponent, PaginacionComponent, AdminParametrosBloqueComponent],
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
          <p class="field-help">0.4 estricto · 0.6 permisivo. Se cambia más abajo.</p>
        </div>
        <div class="card p-5">
          <p class="stat-label">Marcan con reconocimiento facial</p>
          <p class="stat-value mt-1">{{ resumen.conFacial ?? 0 }}<span class="text-lg text-stone-400"> / {{ resumen.total }}</span></p>
          <p class="field-help">Según el modo de su equipo. El resto marca con el botón, sin cámara.</p>
        </div>
      </div>

      <!-- Modo de marcación por equipo -->
      <section class="card mt-6" data-modos>
        <div class="card-header">
          <h3 class="card-title"><i class="bi bi-ui-radios text-vino-700"></i> Modo de marcación por equipo</h3>
        </div>
        <div class="grid gap-3 border-b border-stone-100 px-5 py-4 text-sm text-stone-600 md:grid-cols-2">
          <p><span class="badge-green"><i class="bi bi-person-bounding-box"></i> Reconocimiento facial</span> Marca con la cámara. Quien no registró su rostro debe registrarlo en Mi perfil antes de marcar.</p>
          <p><span class="badge-gray"><i class="bi bi-hand-index"></i> Botón</span> Marca con el botón y una confirmación, sin cámara, aunque tenga el rostro registrado. El rostro se conserva.</p>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Equipo</th><th class="text-center">Colaboradores que marcan</th><th class="text-center">Con rostro registrado</th><th>Modo</th><th></th></tr></thead>
            <tbody>
              @for (m of modos; track m.departamentoId) {
                <tr [attr.data-depto]="m.departamento">
                  <td>
                    <p class="font-medium">{{ m.departamento }}</p>
                    <p class="text-xs text-stone-500">
                      @if (m.actualizadoPor) { {{ m.actualizadoPor }} · {{ fechaHora(m.actualizadoEn) }} }
                      @else if (!m.configurado) { Sin configurar: usa el modo general }
                    </p>
                  </td>
                  <td class="text-center tabular-nums">{{ m.colaboradores }}</td>
                  <td class="text-center tabular-nums">
                    {{ m.conRostro }}
                    @if (seleccion[m.departamentoId] === 'FACIAL' && m.conRostro < m.colaboradores) {
                      <p class="text-xs text-amber-700">{{ m.colaboradores - m.conRostro }} sin registrar</p>
                    }
                  </td>
                  <td>
                    <select class="select w-60" data-modo [(ngModel)]="seleccion[m.departamentoId]" [name]="'modo' + m.departamentoId">
                      <option value="FACIAL">Reconocimiento facial</option>
                      <option value="BOTON">Botón</option>
                    </select>
                  </td>
                  <td class="text-right">
                    <button class="btn-secondary btn-sm" data-guardar [disabled]="seleccion[m.departamentoId] === m.modo || guardandoModo === m.departamentoId"
                            (click)="guardarModo(m)">Guardar</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
          El cambio se aplica desde la siguiente marcación. Quienes no tienen equipo usan el modo general
          ({{ resumen.obligatorio ? 'reconocimiento facial' : 'botón' }}; se cambia más abajo).
        </p>
      </section>

<div class="mb-6"><app-admin-parametros-bloque [campos]="camposFacial" [separado]="false" /></div>
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
              @if (compararCon; as c) {
                <div class="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm" data-comparar-elegido>
                  <span class="flex-1">{{ c.nombre }}</span>
                  <button type="button" class="btn-icon" aria-label="Quitar" (click)="compararCon = null"><i class="bi bi-x-lg"></i></button>
                </div>
              } @else {
                <div class="relative">
                  <input id="comparar" class="input" placeholder="Solo identificar · escriba un nombre para comparar" autocomplete="off"
                         [(ngModel)]="buscarComparar" name="comparar" (ngModelChange)="buscarParaComparar()" data-comparar />
                  @if (opcionesComparar.length) {
                    <ul class="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-superficie py-1 shadow-lg">
                      @for (o of opcionesComparar; track o.empleadoId) {
                        <li><button type="button" class="menu-opcion w-full px-3 py-2 text-left text-sm hover:bg-stone-50" (click)="elegirComparar(o)">
                          {{ o.nombre }} <span class="text-xs text-stone-500">· {{ o.departamento || 'Sin equipo' }}</span></button></li>
                      }
                    </ul>
                  }
                </div>
                <p class="field-help">Solo busca entre quienes tienen rostro registrado.</p>
              }
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
        </div>
        <div class="flex flex-wrap items-center gap-3 border-b border-stone-100 px-5 py-3">
          <select class="select w-72" [(ngModel)]="vista" (ngModelChange)="filtrar()" name="vista" aria-label="Mostrar" data-vista>
            <option value="pendientes">Pendientes de registrar (equipos con cámara)</option>
            <option value="sin_registrar">Sin rostro registrado (todos los equipos)</option>
            <option value="registrados">Con rostro registrado</option>
            <option value="facial">Equipos con reconocimiento facial</option>
            <option value="todos">Todos los que marcan asistencia</option>
          </select>
          <select class="select w-64" [(ngModel)]="filtroDepartamento" (ngModelChange)="filtrar()" name="filtroDepartamento" aria-label="Filtrar por equipo" data-equipo>
            <option value="">Todos los equipos</option>
            @for (m of modos; track m.departamentoId) { <option [ngValue]="m.departamentoId">{{ m.departamento }}</option> }
          </select>
          <div class="relative min-w-56 flex-1">
            <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
            <input class="input pl-9!" placeholder="Buscar por nombre o DNI" [(ngModel)]="busqueda" (ngModelChange)="buscar()" name="busqueda" data-buscar />
          </div>
          @if (hayFiltros) { <button class="btn-ghost btn-sm" (click)="limpiarFiltros()"><i class="bi bi-x-lg"></i> Limpiar</button> }
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Colaborador</th>@if (col.modo) { <th>Marca con</th> }@if (col.rostro) { <th>Rostro</th> }@if (col.detalle) { <th>Capturas</th><th>Registrado el</th><th class="text-right">Acciones</th> }</tr></thead>
            <tbody>
              @for (e of lista?.contenido || []; track e.empleadoId) {
                <tr>
                  <td>
                    <div class="flex items-center gap-3">
                      <app-avatar [nombre]="e.nombre" [foto]="e.foto" [tamano]="32" />
                      <div class="min-w-0"><p class="truncate font-medium">{{ e.nombre }}</p><p class="truncate text-xs text-stone-500">{{ e.cargo }}@if (e.departamento) { · {{ e.departamento }} }</p></div>
                    </div>
                  </td>
                  @if (col.modo) {
                  <td>
                    @if (e.modo === 'FACIAL') { <span class="badge-green"><i class="bi bi-person-bounding-box"></i> Facial</span> }
                    @else { <span class="badge-gray"><i class="bi bi-hand-index"></i> Botón</span> }
                  </td>
                  }
                  @if (col.rostro) {
                  <td>
                    @if (e.registrado) { <span class="badge-green"><i class="bi bi-person-check"></i> Registrado</span> }
                    @else { <span class="badge-gray">Pendiente</span> }
                  </td>
                  }
                  @if (col.detalle) {
                  <td class="tabular-nums">{{ e.muestras || '—' }}</td>
                  <td class="text-stone-600">{{ e.registrado ? fechaCorta(e.registradoEl) : '—' }}</td>
                  <td>
                    <div class="flex justify-end gap-1">
                      @if (e.registrado) {
                        <button class="btn-icon accion-ver" title="Probar marcación con este colaborador" (click)="probarCon(e)"><i class="bi bi-person-check"></i></button>
                        <button class="btn-icon accion-rostro" title="Restablecer rostro registrado" (click)="restablecer(e)">
                          <span class="relative inline-flex">
                            <i class="bi bi-person-bounding-box"></i>
                            <i class="bi bi-arrow-counterclockwise absolute -bottom-1.5 -right-2 rounded-full bg-superficie text-[10px] leading-none"></i>
                          </span>
                        </button>
                      }
                    </div>
                  </td>
                  }
                </tr>
              } @empty {
                <tr><td colspan="7"><div class="empty-state">
                  @if (cargandoLista) { <span class="spinner"></span> }
                  @else if (vista === 'pendientes' && !busqueda.trim() && !filtroDepartamento) { <i class="bi bi-check2-circle text-3xl text-emerald-600"></i><p>Nadie pendiente de registrar en los equipos con cámara.</p> }
                  @else { <p>No hay colaboradores con esos filtros.</p> }
                </div></td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (lista) {
          <app-paginacion [total]="lista.total" [pagina]="lista.pagina" [tamano]="lista.tamano" unidad="colaboradores"
                          [cargando]="cargandoLista" (cambiar)="cargarLista($event)" />
        }
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
  readonly camposFacial: CampoParametro[] = [
    { clave: 'MARCACION_FACIAL_OBLIGATORIA', titulo: 'Modo para quienes no tienen equipo configurado', si: 'Reconocimiento facial', no: 'Botón',
      ayuda: 'Se aplica a colaboradores sin departamento o de un departamento nuevo que aún no aparece en la tabla de arriba.' },
    { clave: 'UMBRAL_FACIAL', titulo: 'Umbral de coincidencia', min: 0.3, max: 0.8, paso: 0.01,
      ayuda: 'Distancia máxima para aceptar un rostro: 0.4 estricto (rechaza más), 0.6 permisivo. Recomendado 0.5.' },
    { clave: 'MUESTRAS_FACIALES', titulo: 'Capturas al registrar un rostro', min: 3, max: 10,
      ayuda: 'Cantidad de capturas que se toman al registrar un rostro (5 por defecto).' },
  ];
  private facial = inject(FacialService);
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  resumen: ResumenFacial | null = null;
  // Lista paginada en el servidor: al entrar solo los pendientes de registrar
  vista = 'pendientes';
  busqueda = '';
  filtroDepartamento: number | '' = '';
  lista: Pagina<EmpleadoFacial> | null = null;
  cargandoLista = false;
  private esperaBusqueda: any;
  private pedidoLista = 0;
  // Comparar con: buscador entre los registrados (no se carga la lista completa)
  compararCon: { empleadoId: number; nombre: string } | null = null;
  buscarComparar = '';
  opcionesComparar: EmpleadoFacial[] = [];
  private esperaComparar: any;
  prueba: Prueba | null = null;
  procesando = false;
  pruebaMarcacion: PruebaMarcacion | null = null;
  pruebaRegistro: PruebaRegistro | null = null;
  modos: ModoEquipo[] = [];
  seleccion: Record<number, ModoMarcacion> = {};
  guardandoModo: number | null = null;

  readonly fechaCorta = fechaCorta;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.facial.resumenAdmin().subscribe({
      next: r => { this.resumen = r; this.cargarLista(this.lista?.pagina ?? 0); },
      error: e => this.notification.error(mensajeError(e), 'Reconocimiento facial')
    });
    this.admin.marcacionEquipos().subscribe({
      next: m => { this.modos = m; this.seleccion = Object.fromEntries(m.map(x => [x.departamentoId, x.modo])); },
      error: e => this.notification.error(mensajeError(e), 'Modo de marcación')
    });
  }

  fechaHora(iso?: string | null) {
    return iso ? `${fechaCorta(iso)} ${horaCorta(iso.substring(11))}` : '';
  }

  async guardarModo(m: ModoEquipo) {
    const modo = this.seleccion[m.departamentoId];
    const facial = modo === 'FACIAL';
    const pendientes = m.colaboradores - m.conRostro;
    const ok = await this.notification.confirm({
      title: facial ? 'Pasar a reconocimiento facial' : 'Pasar a marcación con botón',
      message: facial
        ? `${m.departamento} marcará con la cámara desde la siguiente marcación.` +
          (pendientes > 0 ? ` ${pendientes} colaborador(es) aún no registran su rostro y no podrán marcar hasta hacerlo.` : '')
        : `${m.departamento} marcará con el botón, sin cámara. Los rostros registrados se conservan.`,
      confirmText: 'Cambiar modo', type: facial && pendientes > 0 ? 'warning' : 'info'
    });
    if (!ok) { this.seleccion[m.departamentoId] = m.modo; return; }
    this.guardandoModo = m.departamentoId;
    this.admin.guardarMarcacionEquipo(m.departamentoId, modo).subscribe({
      next: () => { this.guardandoModo = null; this.notification.success(`Modo de marcación de ${m.departamento} actualizado.`); this.cargar(); },
      error: e => { this.guardandoModo = null; this.notification.error(mensajeError(e)); }
    });
  }

  cargarLista(pagina = 0) {
    const pedido = ++this.pedidoLista;
    this.cargandoLista = true;
    this.facial.colaboradores({ vista: this.vista, q: this.busqueda.trim(), departamentoId: this.filtroDepartamento, pagina, tamano: 20 }).subscribe({
      next: p => { if (pedido === this.pedidoLista) { this.lista = p; this.cargandoLista = false; } },
      error: e => { this.cargandoLista = false; this.notification.error(mensajeError(e)); }
    });
  }

  filtrar() { this.cargarLista(0); }

  /** Columnas que aportan en cada vista (no se repite el mismo valor en todas las filas). */
  get col() {
    const v = this.vista;
    return { modo: v !== 'pendientes' && v !== 'facial', rostro: v === 'todos' || v === 'facial', detalle: v !== 'pendientes' && v !== 'sin_registrar' };
  }

  /** Busca al dejar de escribir. */
  buscar() {
    clearTimeout(this.esperaBusqueda);
    this.esperaBusqueda = setTimeout(() => this.cargarLista(0), 350);
  }

  get hayFiltros() { return !!(this.busqueda.trim() || this.filtroDepartamento || this.vista !== 'pendientes'); }

  limpiarFiltros() { this.busqueda = ''; this.filtroDepartamento = ''; this.vista = 'pendientes'; this.cargarLista(0); }

  buscarParaComparar() {
    clearTimeout(this.esperaComparar);
    const q = this.buscarComparar.trim();
    if (q.length < 2) { this.opcionesComparar = []; return; }
    this.esperaComparar = setTimeout(() => this.facial.colaboradores({ vista: 'registrados', q, tamano: 8 })
      .subscribe({ next: p => this.opcionesComparar = p.contenido, error: () => this.opcionesComparar = [] }), 300);
  }

  elegirComparar(e: EmpleadoFacial) {
    this.compararCon = { empleadoId: e.empleadoId, nombre: e.nombre };
    this.buscarComparar = '';
    this.opcionesComparar = [];
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
    this.compararCon = { empleadoId: e.empleadoId, nombre: e.nombre };
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
      this.facial.probarMarcacion(descriptores[0], this.compararCon?.empleadoId ?? null).subscribe({ next: r => { this.pruebaMarcacion = r; fin(); }, error });
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
