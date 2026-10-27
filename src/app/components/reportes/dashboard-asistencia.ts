import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesAsistenciaService } from '../../services/reportes-asistencia';
import { EmpleadosService } from '../../services/empleados';
import { ExportService } from '../../services/export';
import { NotificationService } from '../../services/notification.service';
import { ColaboradorAsistencia, DashboardAsistencia, FiltroDashboard } from '../../interfaces/reportes-asistencia';
import {
  COLOR_A_TIEMPO, COLOR_FALTA, COLOR_TARDANZA, etiquetaMes, fechaCorta, llegadaTexto, minutosTexto
} from '../../utils/estados-asistencia';
import { hoyIso, mensajeError } from '../../utils/format';

type Periodo = 'mes' | 'tres' | 'anio' | 'todo' | 'personalizado';
type Orden = keyof Pick<ColaboradorAsistencia, 'nombre' | 'programados' | 'puntualidad' | 'tardanzas' | 'minutosRetraso' | 'faltas' | 'salidasAutomaticas' | 'llegadaPromedio' | 'tendencia'>;

/** Escala secuencial (un solo tono, claro → oscuro) para el mapa de tardanzas. */
const SECUENCIAL = ['#e8f1fd', '#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Dashboard de asistencia del equipo: indicadores frente al período anterior, resultado por mes, hora de
 * llegada, mapa de tardanzas, comparativo por equipo y tabla de colaboradores (clic → su ficha).
 */
@Component({
  selector: 'app-dashboard-asistencia',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  template: `
    <div class="card mb-5">
      <div class="card-body flex flex-wrap items-end gap-3" data-filtros-dashboard>
        <div>
          <p class="label">Período</p>
          <div class="inline-flex rounded-lg border border-stone-200 p-0.5">
            @for (p of periodos; track p.valor) {
              <button type="button" class="rounded-md px-3 py-1.5 text-sm" [attr.data-periodo]="p.valor"
                      [class]="periodo === p.valor ? 'bg-vino-700 text-white' : 'text-stone-600 hover:bg-stone-100'"
                      (click)="elegirPeriodo(p.valor)">{{ p.texto }}</button>
            }
          </div>
        </div>
        @if (periodo === 'personalizado') {
          <div><label class="label" for="db-desde">Desde</label><input id="db-desde" type="date" class="input" [max]="hoy" [(ngModel)]="filtro.desde" (change)="cargar()" /></div>
          <div><label class="label" for="db-hasta">Hasta</label><input id="db-hasta" type="date" class="input" [min]="filtro.desde" [max]="hoy" [(ngModel)]="filtro.hasta" (change)="cargar()" /></div>
        }
        @if (!datos?.departamentoForzado) {
          <div class="w-48"><label class="label" for="db-equipo">Equipo</label>
            <select id="db-equipo" class="select" [(ngModel)]="filtro.departamentoId" (ngModelChange)="cargar()">
              <option [ngValue]="null">Todos</option>
              @for (d of departamentos; track d.id) { <option [ngValue]="d.id">{{ d.nombre }}</option> }
            </select>
          </div>
        }
        <div class="w-44"><label class="label" for="db-rol">Rol</label>
          <select id="db-rol" class="select" [(ngModel)]="filtro.rol" (ngModelChange)="cargar()">
            <option value="">Todos</option>
            @for (r of roles; track r.codigo) { <option [value]="r.codigo">{{ r.nombre }}</option> }
          </select>
        </div>
        <div class="w-36"><label class="label" for="db-turno">Turno</label>
          <select id="db-turno" class="select" [(ngModel)]="filtro.turno" (ngModelChange)="cargar()">
            <option value="">Todos</option><option value="manana">Mañana</option><option value="tarde">Tarde</option>
          </select>
        </div>
        <div class="w-36"><label class="label" for="db-personal">Personal</label>
          <select id="db-personal" class="select" [(ngModel)]="filtro.personal" (ngModelChange)="cargar()">
            <option value="activos">Activos</option><option value="cesados">Cesados</option><option value="todos">Todos</option>
          </select>
        </div>
        <button type="button" class="btn-excel ml-auto" (click)="exportar()" [disabled]="!datos?.colaboradores?.length"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button>
      </div>
    </div>

    @if (cargando && !datos) {
      <div class="flex justify-center py-16"><span class="spinner"></span></div>
    } @else if (datos) {
      <div class="space-y-5" [class.opacity-60]="cargando" data-dashboard>
        <p class="text-xs text-stone-500">
          {{ fecha(datos.desde) }} al {{ fecha(datos.hasta) }} · comparado con {{ fecha(datos.anteriorDesde) }} al {{ fecha(datos.anteriorHasta) }}
          @if (datos.actualizado) { · datos al {{ datos.actualizado.substring(0, 16).replace('T', ' ') }} }
        </p>

        <!-- Indicadores -->
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-6" data-kpis>
          <div class="card p-4"><p class="stat-label">Puntualidad</p><p class="stat-value mt-1">{{ pct(datos.kpis.puntualidad) }}</p>
            <p class="text-xs" [class]="claseDelta(delta(datos.kpis.puntualidad, datos.kpisAnterior.puntualidad), true)">{{ textoDelta(delta(datos.kpis.puntualidad, datos.kpisAnterior.puntualidad), 'pts') }}</p></div>
          <div class="card p-4"><p class="stat-label">Asistencia</p><p class="stat-value mt-1">{{ pct(datos.kpis.asistencia) }}</p>
            <p class="text-xs text-stone-500">{{ (datos.kpis.aTiempo + datos.kpis.tardanzas) | number }} de {{ datos.kpis.programados | number }} días</p></div>
          <div class="card p-4"><p class="stat-label">Tardanzas</p><p class="stat-value mt-1">{{ datos.kpis.tardanzas | number }}</p>
            <p class="text-xs text-stone-500">prom. {{ minutos(datos.kpis.promedioRetraso) }} · total {{ minutos(datos.kpis.minutosRetraso) }}</p></div>
          <div class="card p-4"><p class="stat-label">Faltas</p><p class="stat-value mt-1">{{ datos.kpis.faltas | number }}</p>
            <p class="text-xs" [class]="claseDelta(datos.kpis.faltas - datos.kpisAnterior.faltas, false)">{{ textoDelta(datos.kpis.faltas - datos.kpisAnterior.faltas, '') }}</p></div>
          <div class="card p-4"><p class="stat-label">Salidas automáticas</p><p class="stat-value mt-1">{{ datos.kpis.salidasAutomaticas | number }}</p>
            <p class="text-xs text-stone-500">no marcaron su salida</p></div>
          <div class="card p-4"><p class="stat-label">Horas trabajadas</p><p class="stat-value mt-1">{{ pct(datos.kpis.horas ?? null) }}</p>
            <p class="text-xs text-stone-500">de las programadas (días con salida)</p></div>
        </div>

        <div class="grid gap-5 xl:grid-cols-5">
          <!-- Resultado por mes -->
          <section class="card p-5 xl:col-span-3">
            <h3 class="card-title">Resultado de los días programados, por mes</h3>
            <div class="my-2 flex flex-wrap gap-4 text-xs text-stone-600">
              @for (s of series; track s.clave) {
                <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="s.color"></span><i class="bi" [class]="s.icono"></i> {{ s.texto }}</span>
              }
            </div>
            @if (datos.porMes.length) {
              <svg viewBox="0 0 640 220" class="w-full" role="img" aria-label="Resultado por mes" data-barras-mes>
                @for (g of [0, 50, 100]; track g) {
                  <line x1="36" [attr.y1]="yBarra(g)" x2="636" [attr.y2]="yBarra(g)" stroke="currentColor" [class]="g === 0 ? 'text-stone-300' : 'text-stone-200'" />
                  <text x="0" [attr.y]="yBarra(g) + 4" font-size="10" fill="currentColor" class="text-stone-500">{{ g }}%</text>
                }
                @for (m of datos.porMes; track m.mes; let i = $index) {
                  @for (seg of segmentos(m); track seg.clave) {
                    <rect [attr.x]="xBarra(i)" [attr.y]="seg.y" [attr.width]="anchoBarra" [attr.height]="seg.alto" [attr.fill]="seg.color"
                          rx="2" class="transition-opacity hover:opacity-80">
                      <title>{{ mesTexto(m.mes) }} · {{ seg.texto }}: {{ seg.valor | number }} ({{ seg.pct }} %)</title>
                    </rect>
                  }
                  @if (mostrarMes(i)) {
                    <text [attr.x]="xBarra(i) + anchoBarra / 2" y="214" font-size="10" text-anchor="middle" fill="currentColor" class="text-stone-500">{{ mesTexto(m.mes) }}</text>
                  }
                }
              </svg>
            } @else { <p class="py-10 text-center text-sm text-stone-500">Sin días programados en el período.</p> }
          </section>

          <!-- Llegadas -->
          <section class="card p-5 xl:col-span-2">
            <h3 class="card-title">¿A qué hora llegan?</h3>
            <p class="mb-2 text-xs text-stone-500">Entradas según minutos respecto al turno · tolerancia {{ datos.toleranciaMinutos }} min</p>
            <svg viewBox="0 0 420 210" class="w-full" role="img" aria-label="Distribución de llegadas" data-llegadas>
              <line x1="10" y1="180" x2="414" y2="180" stroke="currentColor" class="text-stone-300" />
              @for (b of datos.llegadas; track b.rango; let i = $index) {
                <rect [attr.x]="14 + i * 57" [attr.y]="180 - altoLlegada(b.cantidad)" width="46" [attr.height]="altoLlegada(b.cantidad)"
                      rx="3" [attr.fill]="b.tarde ? colorTarde : '#3987e5'">
                  <title>{{ b.rango }} min: {{ b.cantidad | number }} entrada(s)</title>
                </rect>
                <text [attr.x]="37 + i * 57" [attr.y]="174 - altoLlegada(b.cantidad)" font-size="10" text-anchor="middle" fill="currentColor" class="text-stone-600">{{ b.cantidad | number }}</text>
                <text [attr.x]="37 + i * 57" y="196" font-size="9.5" text-anchor="middle" fill="currentColor" class="text-stone-500">{{ b.rango }}</text>
              }
            </svg>
            <p class="mt-1 flex gap-4 text-xs text-stone-600">
              <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm bg-[#3987e5]"></span> Dentro de la tolerancia</span>
              <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="colorTarde"></span><i class="bi bi-clock"></i> Tardanza</span>
            </p>
          </section>
        </div>

        <div class="grid gap-5" [class.xl:grid-cols-2]="datos.porEquipo.length > 1">
          <!-- Mapa de tardanzas -->
          <section class="card p-5">
            <h3 class="card-title">Tardanzas por día y hora de entrada</h3>
            <p class="mb-2 text-xs text-stone-500">% de entradas con tardanza · más oscuro = más tardanzas</p>
            @if (horasMapa.length) {
              <svg [attr.viewBox]="'0 0 430 ' + (horasMapa.length * 30 + 30)" class="w-full" role="img" aria-label="Mapa de tardanzas" data-mapa>
                @for (h of horasMapa; track h; let r = $index) {
                  <text x="0" [attr.y]="r * 30 + 20" font-size="10" fill="currentColor" class="text-stone-500">{{ (h < 10 ? '0' : '') + h }}:00</text>
                  @for (d of [1, 2, 3, 4, 5, 6, 7]; track d) {
                    <rect [attr.x]="44 + (d - 1) * 54" [attr.y]="r * 30 + 4" width="50" height="26" rx="3" [attr.fill]="colorMapa(d, h)">
                      <title>{{ dias[d - 1] }} {{ (h < 10 ? '0' : '') + h }}:00 · {{ textoMapa(d, h) }}</title>
                    </rect>
                  }
                }
                @for (d of dias; track d; let i = $index) {
                  <text [attr.x]="69 + i * 54" [attr.y]="horasMapa.length * 30 + 22" font-size="10" text-anchor="middle" fill="currentColor" class="text-stone-500">{{ d }}</text>
                }
              </svg>
              <div class="mt-2 flex items-center gap-1 text-[11px] text-stone-500">0 %
                @for (c of escala; track c) { <span class="inline-block h-2.5 w-6" [style.background]="c"></span> }
                {{ maxMapa }} % o más</div>
            } @else { <p class="py-10 text-center text-sm text-stone-500">Sin entradas en el período.</p> }
          </section>

          <!-- Por equipo -->
          @if (datos.porEquipo.length > 1) {
            <section class="card p-5">
              <h3 class="card-title">Comparativo por equipo</h3>
              <p class="mb-2 text-xs text-stone-500">Puntualidad del período</p>
              <svg [attr.viewBox]="'0 0 430 ' + (datos.porEquipo.length * 32 + 8)" class="w-full" role="img" aria-label="Puntualidad por equipo" data-equipos>
                @for (e of datos.porEquipo; track e.nombre; let i = $index) {
                  <text x="0" [attr.y]="i * 32 + 20" font-size="11" fill="currentColor" class="text-stone-700">{{ e.nombre.length > 18 ? e.nombre.substring(0, 17) + '…' : e.nombre }}</text>
                  <rect x="130" [attr.y]="i * 32 + 7" [attr.width]="(e.puntualidad ?? 0) * 2.4" height="18" rx="3" fill="#3987e5">
                    <title>{{ e.nombre }}: {{ pct(e.puntualidad) }} · {{ e.tardanzas }} tardanza(s) · {{ e.faltas }} falta(s)</title>
                  </rect>
                  <text [attr.x]="136 + (e.puntualidad ?? 0) * 2.4" [attr.y]="i * 32 + 20" font-size="11" fill="currentColor" class="text-stone-900">{{ pct(e.puntualidad) }}</text>
                }
              </svg>
            </section>
          }
        </div>

        <!-- Colaboradores -->
        <section class="card">
          <div class="card-header flex flex-wrap items-center justify-between gap-3">
            <div><h3 class="card-title">Colaboradores</h3>
              <p class="text-xs text-stone-500">Clic en una columna para ordenar · clic en una fila para ver su ficha</p></div>
            <input class="input w-60" placeholder="Buscar colaborador" [(ngModel)]="busqueda" aria-label="Buscar colaborador" data-buscar-colaborador />
          </div>
          <div class="table-wrap">
            <table class="table text-sm" data-tabla-colaboradores>
              <thead><tr>
                @for (c of columnas; track c.clave) {
                  <th class="cursor-pointer select-none whitespace-nowrap" [class.text-right]="c.num" (click)="ordenarPor(c.clave)" [attr.aria-sort]="orden === c.clave ? (asc ? 'ascending' : 'descending') : null">
                    {{ c.texto }} @if (orden === c.clave) { <i class="bi" [class]="asc ? 'bi-caret-up-fill' : 'bi-caret-down-fill'"></i> }
                  </th>
                }
              </tr></thead>
              <tbody>
                @for (c of colaboradoresVisibles; track c.empleadoId) {
                  <tr class="cursor-pointer hover:bg-stone-50" (click)="abrirFicha.emit(c.empleadoId)" [attr.data-colaborador]="c.empleadoId">
                    <td class="min-w-48"><p class="font-medium text-stone-900">{{ c.nombre }} @if (!c.activo) { <span class="badge-gray ml-1">Cesado</span> }</p>
                      <p class="text-xs text-stone-500">{{ c.departamento || 'Sin equipo' }} @if (c.ingreso) { · ingresó {{ fecha(c.ingreso) }} }</p></td>
                    <td class="text-right tabular-nums">{{ c.programados | number }}</td>
                    <td class="text-right tabular-nums font-semibold">{{ pct(c.puntualidad) }}</td>
                    <td class="text-right tabular-nums">{{ c.tardanzas | number }}</td>
                    <td class="text-right tabular-nums">{{ minutos(c.minutosRetraso) }}</td>
                    <td class="text-right tabular-nums">{{ c.faltas | number }}</td>
                    <td class="text-right tabular-nums">{{ c.salidasAutomaticas | number }}</td>
                    <td class="text-right whitespace-nowrap">{{ llegada(c.llegadaPromedio) }}</td>
                    <td class="text-right whitespace-nowrap" [class]="claseDelta(c.tendencia, true)">
                      @if (c.tendencia === null) { — } @else if (c.tendencia > 0) { <i class="bi bi-arrow-up-right"></i> +{{ c.tendencia }} } @else if (c.tendencia < 0) { <i class="bi bi-arrow-down-right"></i> {{ c.tendencia }} } @else { = }
                    </td>
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="columnas.length"><div class="empty-state">No hay colaboradores con esos filtros.</div></td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (colaboradoresFiltrados.length > limite) {
            <div class="border-t border-stone-100 p-3 text-center">
              <button type="button" class="btn-ghost btn-sm" (click)="limite = limite + 50">Ver más ({{ colaboradoresFiltrados.length - limite }} restantes)</button>
            </div>
          }
        </section>
      </div>
    }
  `
})
export class DashboardAsistenciaComponent implements OnInit {
  @Output() abrirFicha = new EventEmitter<number>();

  private servicio = inject(ReportesAsistenciaService);
  private empleados = inject(EmpleadosService);
  private exportService = inject(ExportService);
  private notification = inject(NotificationService);

  readonly periodos: { valor: Periodo; texto: string }[] = [
    { valor: 'mes', texto: 'Este mes' }, { valor: 'tres', texto: '3 meses' }, { valor: 'anio', texto: 'Este año' },
    { valor: 'todo', texto: 'Todo el historial' }, { valor: 'personalizado', texto: 'Personalizado' }
  ];
  readonly series = [
    { clave: 'aTiempo', texto: 'A tiempo', color: COLOR_A_TIEMPO, icono: 'bi-check-lg' },
    { clave: 'tardanzas', texto: 'Tardanza', color: COLOR_TARDANZA, icono: 'bi-clock' },
    { clave: 'faltas', texto: 'Falta', color: COLOR_FALTA, icono: 'bi-x-lg' }
  ] as const;
  readonly columnas: { clave: Orden; texto: string; num: boolean }[] = [
    { clave: 'nombre', texto: 'Colaborador', num: false }, { clave: 'programados', texto: 'Días prog.', num: true },
    { clave: 'puntualidad', texto: 'Puntualidad', num: true }, { clave: 'tardanzas', texto: 'Tardanzas', num: true },
    { clave: 'minutosRetraso', texto: 'Tiempo tarde', num: true }, { clave: 'faltas', texto: 'Faltas', num: true },
    { clave: 'salidasAutomaticas', texto: 'Salidas auto.', num: true }, { clave: 'llegadaPromedio', texto: 'Llegada prom.', num: true },
    { clave: 'tendencia', texto: 'Tendencia', num: true }
  ];
  readonly dias = DIAS;
  readonly escala = SECUENCIAL;
  readonly colorTarde = COLOR_TARDANZA;

  hoy = hoyIso();
  periodo: Periodo = 'mes';
  filtro: FiltroDashboard = { desde: '', hasta: '', departamentoId: null, rol: '', turno: '', personal: 'activos' };
  datos: DashboardAsistencia | null = null;
  cargando = false;
  departamentos: { id: number; nombre: string }[] = [];
  roles: { codigo: string; nombre: string }[] = [];
  busqueda = '';
  orden: Orden = 'puntualidad';
  asc = true;
  limite = 50;
  horasMapa: number[] = [];
  maxMapa = 0;
  private mapa = new Map<string, { tardanzas: number; entradas: number }>();
  private maxLlegada = 1;
  private solicitud = 0;

  ngOnInit() {
    this.empleados.departamentos().subscribe({ next: d => this.departamentos = d, error: () => {} });
    this.empleados.rolesConHorario().subscribe({ next: r => this.roles = r, error: () => {} });
    this.elegirPeriodo('mes');
  }

  elegirPeriodo(p: Periodo) {
    this.periodo = p;
    const hoy = new Date(this.hoy + 'T00:00:00');
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (p === 'personalizado') {
      if (!this.filtro.desde) this.filtro.desde = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
      this.filtro.hasta ||= this.hoy;
    } else {
      this.filtro.hasta = this.hoy;
      this.filtro.desde = p === 'mes' ? iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
        : p === 'tres' ? iso(new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1))
        : p === 'anio' ? iso(new Date(hoy.getFullYear(), 0, 1))
        : '2015-01-01';
    }
    this.cargar();
  }

  cargar() {
    if (!this.filtro.desde || !this.filtro.hasta || this.filtro.desde > this.filtro.hasta) return;
    const id = ++this.solicitud;
    this.cargando = true;
    this.servicio.dashboard(this.filtro).subscribe({
      next: d => {
        if (id !== this.solicitud) return;
        this.datos = d;
        this.prepararGraficos(d);
        this.limite = 50;
        this.cargando = false;
      },
      error: e => {
        if (id !== this.solicitud) return;
        this.cargando = false;
        this.notification.error(mensajeError(e), 'No se pudo cargar el dashboard');
      }
    });
  }

  private prepararGraficos(d: DashboardAsistencia) {
    this.maxLlegada = Math.max(1, ...d.llegadas.map(b => b.cantidad));
    this.mapa = new Map(d.mapaTardanzas.map(c => [`${c.dia}|${c.hora}`, c]));
    this.horasMapa = [...new Set(d.mapaTardanzas.filter(c => c.entradas > 0).map(c => c.hora))].sort((a, b) => a - b);
    const tasas = d.mapaTardanzas.filter(c => c.entradas > 0).map(c => (c.tardanzas * 100) / c.entradas);
    this.maxMapa = Math.max(5, Math.ceil(Math.max(0, ...tasas) / 5) * 5);
  }

  // ---------- Barras por mes ----------
  get anchoBarra(): number {
    const n = this.datos?.porMes.length || 1;
    return Math.max(6, Math.min(40, 560 / n - 6));
  }
  xBarra(i: number): number {
    const n = this.datos?.porMes.length || 1;
    return 44 + i * (592 / n) + (592 / n - this.anchoBarra) / 2;
  }
  yBarra(pct: number): number { return 196 - pct * 1.8; }
  mostrarMes(i: number): boolean {
    const n = this.datos?.porMes.length || 1;
    const paso = Math.ceil(n / 12);
    return i % paso === 0 || i === n - 1;
  }
  segmentos(m: { aTiempo: number; tardanzas: number; faltas: number }) {
    const total = m.aTiempo + m.tardanzas + m.faltas;
    if (!total) return [];
    let acumulado = 0;
    return this.series.map(s => {
      const valor = m[s.clave];
      const pct = (valor * 100) / total;
      const y = this.yBarra(acumulado + pct);
      const alto = Math.max(0, pct * 1.8 - (valor ? 2 : 0));
      acumulado += pct;
      return { clave: s.clave, texto: s.texto, color: s.color, valor, pct: Math.round(pct * 10) / 10, y: y + (valor ? 1 : 0), alto };
    }).filter(s => s.valor > 0);
  }

  // ---------- Llegadas y mapa ----------
  altoLlegada(n: number): number { return n ? Math.max(2, (n / this.maxLlegada) * 150) : 0; }
  colorMapa(dia: number, hora: number): string {
    const c = this.mapa.get(`${dia}|${hora}`);
    if (!c || !c.entradas) return 'transparent';
    const t = (c.tardanzas * 100) / c.entradas;
    return SECUENCIAL[Math.min(SECUENCIAL.length - 1, Math.floor((t / this.maxMapa) * (SECUENCIAL.length - 1) + 0.0001))];
  }
  textoMapa(dia: number, hora: number): string {
    const c = this.mapa.get(`${dia}|${hora}`);
    if (!c || !c.entradas) return 'sin entradas';
    return `${c.tardanzas} tardanza(s) de ${c.entradas} entradas (${Math.round((c.tardanzas * 100) / c.entradas)} %)`;
  }

  // ---------- Tabla ----------
  ordenarPor(c: Orden) {
    if (this.orden === c) this.asc = !this.asc;
    else { this.orden = c; this.asc = c === 'nombre' || c === 'puntualidad'; }
  }
  get colaboradoresFiltrados(): ColaboradorAsistencia[] {
    const q = this.busqueda.trim().toLowerCase();
    const lista = (this.datos?.colaboradores ?? []).filter(c => !q || c.nombre.toLowerCase().includes(q));
    const k = this.orden, signo = this.asc ? 1 : -1;
    return [...lista].sort((a, b) => {
      const x = a[k], y = b[k];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * signo;
    });
  }
  get colaboradoresVisibles(): ColaboradorAsistencia[] { return this.colaboradoresFiltrados.slice(0, this.limite); }

  exportar() {
    const filas = this.colaboradoresFiltrados.map(c => ({
      Colaborador: c.nombre, Equipo: c.departamento || '', Ingreso: c.ingreso ? fechaCorta(c.ingreso) : '', Activo: c.activo ? 'Sí' : 'No',
      'Días programados': c.programados, 'A tiempo': c.aTiempo, Tardanzas: c.tardanzas, 'Minutos tarde': c.minutosRetraso,
      Faltas: c.faltas, 'Salidas automáticas': c.salidasAutomaticas, 'Puntualidad (%)': c.puntualidad ?? '',
      'Asistencia (%)': c.asistencia ?? '', 'Llegada promedio (min)': c.llegadaPromedio ?? '', 'Tendencia (pts)': c.tendencia ?? ''
    }));
    this.exportService.exportToExcel(filas, `dashboard_asistencia_${this.filtro.desde}_${this.filtro.hasta}`, 'Colaboradores');
  }

  // ---------- Formato ----------
  delta(actual: number | null, anterior: number | null): number | null {
    return actual === null || anterior === null ? null : Math.round((actual - anterior) * 10) / 10;
  }
  textoDelta(d: number | null, unidad: string): string {
    if (d === null) return 'sin período anterior para comparar';
    if (d === 0) return '= igual al período anterior';
    return `${d > 0 ? '▲ +' : '▼ '}${d}${unidad ? ' ' + unidad : ''} vs período anterior`;
  }
  /** Verde si mejora, rojo si empeora (para faltas, subir es empeorar). */
  claseDelta(d: number | null, subirEsBueno: boolean): string {
    if (d === null || d === 0) return 'text-stone-500';
    return (d > 0) === subirEsBueno ? 'text-emerald-700' : 'text-red-700';
  }
  pct(p: number | null) { return p === null || p === undefined ? '—' : `${p} %`; }
  minutos(m: number | null) { return minutosTexto(m); }
  llegada(d: number | null) { return llegadaTexto(d); }
  fecha(iso: string) { return fechaCorta(iso); }
  mesTexto(m: string) { return etiquetaMes(m); }
}
