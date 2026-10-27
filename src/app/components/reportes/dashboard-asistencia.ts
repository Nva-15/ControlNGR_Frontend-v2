import { Component, EventEmitter, HostListener, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReportesAsistenciaService } from '../../services/reportes-asistencia';
import { EmpleadosService } from '../../services/empleados';
import { HorariosService } from '../../services/horarios';
import { ExportService } from '../../services/export';
import { NotificationService } from '../../services/notification.service';
import {
  AlertaAsistencia, ColaboradorAsistencia, ColaboradorHoy, ConteoAsistencia, DashboardAsistencia, FiltroDashboard, PuntoSerie
} from '../../interfaces/reportes-asistencia';
import { NotificacionesService } from '../../services/notificaciones';
import { ALERTAS_ASISTENCIA, mensajeAlerta } from '../../utils/alertas-asistencia';
import {
  COLOR_A_TIEMPO, COLOR_AUSENCIA, COLOR_FALTA, COLOR_PENDIENTE, COLOR_SIN_HORARIO, COLOR_TARDANZA, estadoAsistencia,
  etiquetaMes, fechaCorta, llegadaTexto, minutosTexto
} from '../../utils/estados-asistencia';
import { hoyIso, mensajeError } from '../../utils/format';

type Periodo = 'hoy' | 'semana' | 'quincena' | 'mes' | 'tres' | 'todo' | 'personalizado';
type Orden = keyof Pick<ColaboradorAsistencia, 'nombre' | 'programados' | 'puntualidad' | 'tardanzas' | 'minutosRetraso' | 'faltas'
  | 'salidasAutomaticas' | 'llegadaPromedio' | 'tendencia' | 'diasMarcados' | 'entradaPromedio' | 'minutosExtra'>;
type SerieClave = 'aTiempo' | 'tardanzas' | 'faltas' | 'diasSinHorario';

/** Escala secuencial (un solo tono, claro → oscuro) para el mapa de tardanzas. */
const SECUENCIAL = ['#e8f1fd', '#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
/** Días hacia atrás de cada período (incluye hoy). */
const DIAS_PERIODO: Partial<Record<Periodo, number>> = { hoy: 1, semana: 7, quincena: 15, mes: 30, tres: 90 };
const REFRESCO_HOY_MS = 60_000;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return iso(d);
}

/**
 * Dashboard de asistencia (reemplaza el reporte externo en Power BI). Por defecto "Hoy en vivo": quién
 * llegó, quién falta y quién está por llegar, actualizado cada minuto. Con un período: indicadores frente al
 * período anterior, evolución (por día, semana o mes según el rango), hora de llegada, mapa de tardanzas,
 * comparativos por equipo y función, rankings y tabla de colaboradores. Clic en un equipo, función o barra
 * filtra el resto; las alertas se abren en un desplegable.
 */
@Component({
  selector: 'app-dashboard-asistencia',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink],
  template: `
    <div class="card mb-4">
      <div class="card-body flex flex-wrap items-end gap-3" data-filtros-dashboard>
        <div class="max-w-full">
          <p class="label">Período</p>
          <div class="flex max-w-full flex-wrap rounded-lg border border-stone-200 p-0.5" role="group" aria-label="Período">
            @for (p of periodos; track p.valor) {
              <button type="button" class="rounded-md px-3 py-1.5 text-sm" [attr.data-periodo]="p.valor" [attr.aria-pressed]="periodo === p.valor"
                      [class]="periodo === p.valor ? 'bg-vino-700 text-white' : 'text-stone-600 hover:bg-stone-100'"
                      (click)="elegirPeriodo(p.valor)">{{ p.texto }}</button>
            }
          </div>
        </div>
        @if (periodo === 'personalizado') {
          <div><label class="label" for="db-desde">Desde</label><input id="db-desde" type="date" class="input" [max]="hoy" [(ngModel)]="filtro.desde" (change)="cargar()" /></div>
          <div><label class="label" for="db-hasta">Hasta</label><input id="db-hasta" type="date" class="input" [min]="filtro.desde" [max]="hoy" [(ngModel)]="filtro.hasta" (change)="cargar()" /></div>
        }
        <div class="w-44"><label class="label" for="db-equipo">Equipo</label>
          <select id="db-equipo" class="select" [(ngModel)]="filtro.departamentoId" (ngModelChange)="cargar()">
            <option [ngValue]="null">Todos</option>
            @for (d of departamentos; track d.id) { <option [ngValue]="d.id">{{ d.nombre }}</option> }
          </select>
        </div>
        <div class="w-36"><label class="label" for="db-rol">Rol</label>
          <select id="db-rol" class="select" [(ngModel)]="filtro.rol" (ngModelChange)="cargar()">
            <option value="">Todos</option>
            @for (r of rolesVisibles; track r.codigo) { <option [value]="r.codigo">{{ r.nombre }}</option> }
          </select>
        </div>
        <div class="w-32"><label class="label" for="db-turno">Turno</label>
          <select id="db-turno" class="select" [(ngModel)]="filtro.turno" (ngModelChange)="cargar()">
            <option value="">Todos</option><option value="manana">Mañana</option><option value="tarde">Tarde</option>
          </select>
        </div>
        <div class="w-36"><label class="label" for="db-funcion">Función</label>
          <select id="db-funcion" class="select" [(ngModel)]="filtro.funcion" (ngModelChange)="cargar()">
            <option value="">Todas</option>
            @for (f of funciones; track f.codigo) { <option [value]="f.codigo">{{ f.codigo }} · {{ f.nombre }}</option> }
          </select>
        </div>
        <div class="w-32"><label class="label" for="db-personal">Personal</label>
          <select id="db-personal" class="select" [(ngModel)]="filtro.personal" (ngModelChange)="cargar()">
            <option value="activos">Activos</option><option value="cesados">Cesados</option><option value="todos">Todos</option>
          </select>
        </div>
        <div class="ml-auto flex flex-wrap items-end gap-2">
          <!-- Alertas: desplegable, no empuja el dashboard -->
          <div class="relative">
            <button type="button" class="btn-ghost relative border border-stone-200" (click)="alternarAlertas($event)"
                    [attr.aria-expanded]="alertasAbiertas" aria-haspopup="true" data-boton-alertas>
              <i class="bi bi-exclamation-triangle" [class.text-amber-600]="alertas.length"></i> Alertas
              <span class="ml-1 rounded-full px-1.5 text-xs font-semibold" [class]="nuevas ? 'bg-red-600 text-white' : 'bg-stone-200 text-stone-700'" data-total-alertas>{{ alertas.length }}</span>
            </button>
            @if (alertasAbiertas) {
              <div class="fixed inset-x-4 top-20 z-30 rounded-xl border border-stone-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[26rem]"
                   (click)="$event.stopPropagation()" role="dialog" aria-label="Alertas de asistencia" data-alertas>
                <div class="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3">
                  <div>
                    <p class="font-semibold text-stone-900">Alertas del período en curso
                      @if (nuevas) { <span class="badge-red ml-1 align-middle">{{ nuevas }} nueva(s)</span> }</p>
                    <p class="text-xs text-stone-500">Indicadores para conversar, no sanciones · clic para ver su ficha</p>
                  </div>
                  <button type="button" class="btn-ghost btn-sm" (click)="alertasAbiertas = false" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
                </div>
                <ul class="max-h-96 divide-y divide-stone-100 overflow-y-auto">
                  @for (a of alertas; track a.tipo + a.empleadoId) {
                    <li>
                      <button type="button" class="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-stone-50"
                              (click)="alertasAbiertas = false; abrirFicha.emit(a.empleadoId)" [attr.data-alerta]="a.tipo">
                        <i class="bi mt-0.5" [class]="infoAlerta(a).icono + ' ' + infoAlerta(a).clase" [attr.aria-label]="infoAlerta(a).titulo"></i>
                        <span class="flex-1"><b class="text-stone-900">{{ a.nombre }}</b>
                          <span class="text-stone-500"> · {{ a.departamento || 'Sin equipo' }}</span><br>
                          <span class="text-stone-700">{{ texto(a) }}</span></span>
                        @if (a.nueva) { <span class="badge-red">Nueva</span> }
                      </button>
                    </li>
                  } @empty {
                    <li class="px-4 py-8 text-center text-sm text-stone-500"><i class="bi bi-check2-circle text-emerald-600"></i> Sin alertas en el período en curso.</li>
                  }
                </ul>
              </div>
            }
          </div>
          <button type="button" class="btn-excel" (click)="exportar()" [disabled]="!hayDatosExportables"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button>
          <button type="button" class="btn-pdf" (click)="exportarPdf()" [disabled]="!hayDatosExportables"><i class="bi bi-file-earmark-pdf-fill"></i> PDF</button>
        </div>
      </div>
      @if (chips.length) {
        <div class="flex flex-wrap items-center gap-2 border-t border-stone-100 px-5 py-2.5 text-sm" data-chips>
          <span class="text-xs text-stone-500">Filtrando por:</span>
          @for (c of chips; track c.clave) {
            <span class="inline-flex items-center gap-1 rounded-full bg-vino-50 px-2.5 py-0.5 text-vino-800 ring-1 ring-vino-200">
              {{ c.texto }}
              <button type="button" class="ml-0.5 rounded-full hover:text-vino-950" (click)="quitarFiltro(c.clave)" [attr.aria-label]="'Quitar ' + c.texto"><i class="bi bi-x"></i></button>
            </span>
          }
          <button type="button" class="text-xs text-stone-500 underline hover:text-stone-800" (click)="limpiarFiltros()">Limpiar todo</button>
          <span class="text-xs text-stone-400">· clic en un equipo, función o barra para filtrar</span>
        </div>
      }
    </div>

    @if (cargando && !datos) {
      <div class="flex justify-center py-16"><span class="spinner"></span></div>
    } @else if (datos) {
      <div class="space-y-5" [class.opacity-60]="cargando" data-dashboard>
        <!-- Avisos -->
        @if (datos.semanasBorrador.length) {
          <div class="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900" data-aviso-borrador>
            <i class="bi bi-pencil-square"></i>
            <span class="flex-1">{{ datos.semanasBorrador.length === 1 ? 'Hay 1 semana en borrador' : 'Hay ' + datos.semanasBorrador.length + ' semanas en borrador' }}
              ({{ textoSemanas }}): sus turnos no cuentan hasta publicarla{{ datos.semanasBorrador.length === 1 ? '' : 's' }}.</span>
            <a routerLink="/horarios" class="font-medium underline">Ir a Horarios</a>
          </div>
        }
        @if (sinHorario) {
          <div class="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900" data-aviso-sin-horario>
            <i class="bi bi-info-circle"></i> <b>{{ sinHorario | number }} día(s) con marcación sin horario programado</b>:
            se muestran como «Asistió (sin horario)» y no cuentan para puntualidad ni faltas. Publique las semanas o registre el horario base para medirlos.
          </div>
        }

        <p class="text-xs text-stone-500">
          @if (datos.hoy) { Hoy {{ fecha(datos.hasta) }} · se actualiza cada minuto }
          @else { {{ fecha(datos.desde) }} al {{ fecha(datos.hasta) }} · comparado con {{ fecha(datos.anteriorDesde) }} al {{ fecha(datos.anteriorHasta) }} }
          @if (datos.actualizado) { · datos al {{ datos.actualizado.substring(11, 16) || datos.actualizado }} {{ datos.actualizado.substring(0, 10) !== hoy ? '(' + fecha(datos.actualizado.substring(0, 10)) + ')' : '' }} }
        </p>

        @if (datos.hoy; as h) {
          <!-- ===== HOY EN VIVO ===== -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" data-kpis-hoy>
            @for (k of kpisHoy; track k.clave) {
              <button type="button" class="card p-4 text-left transition hover:ring-2 hover:ring-vino-200" [class.ring-2]="estadoHoy === k.estado && k.estado" [class.ring-vino-400]="estadoHoy === k.estado && k.estado"
                      (click)="filtrarHoy(k.estado)" [attr.data-kpi-hoy]="k.clave" [disabled]="!k.estado">
                <p class="stat-label flex items-center gap-1.5">@if (k.color) { <span class="inline-block h-2.5 w-2.5 rounded-full" [style.background]="k.color"></span> } {{ k.texto }}</p>
                <p class="stat-value mt-1">{{ h.kpis[k.clave] | number }}</p>
                <p class="text-xs text-stone-500">{{ k.ayuda }}</p>
              </button>
            }
          </div>

          <div class="grid gap-5 xl:grid-cols-3">
            <section class="card min-w-0 xl:col-span-2">
              <div class="card-header flex flex-wrap items-center justify-between gap-3">
                <div><h3 class="card-title">Estado de hoy por colaborador</h3>
                  <p class="text-xs text-stone-500">Primero lo que requiere atención · clic en una fila para ver su ficha</p></div>
                <input class="input w-56" placeholder="Buscar colaborador" [(ngModel)]="busqueda" aria-label="Buscar colaborador" />
              </div>
              <div class="table-wrap">
                <table class="table text-sm" data-tabla-hoy>
                  <thead><tr><th>Colaborador</th><th>Turno</th><th>Programado</th><th>Marcó</th><th class="text-right">Diferencia</th><th>Estado</th></tr></thead>
                  <tbody>
                    @for (c of hoyVisibles; track c.empleadoId) {
                      <tr class="cursor-pointer hover:bg-stone-50" (click)="abrirFicha.emit(c.empleadoId)" [attr.data-hoy]="c.empleadoId" [attr.data-estado]="c.estado">
                        <td class="min-w-44"><p class="font-medium text-stone-900">{{ c.nombre }}</p><p class="text-xs text-stone-500">{{ c.departamento }}</p></td>
                        <td class="whitespace-nowrap">{{ turnoTexto(c.turno) }}
                          @for (f of c.funciones; track f) { <span class="badge-gray ml-1">{{ f }}</span> }</td>
                        <td class="whitespace-nowrap tabular-nums">{{ c.entradaProgramada ? c.entradaProgramada + ' – ' + (c.salidaProgramada || '') : '—' }}</td>
                        <td class="whitespace-nowrap tabular-nums">{{ c.entrada || '—' }}@if (c.salida) { – {{ c.salida }} } @else if (c.enTurno) { <span class="badge-green ml-1">En turno</span> }</td>
                        <td class="text-right whitespace-nowrap">{{ llegada(c.minutosDiferencia) }}</td>
                        <td class="whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" [style.background]="colorEstado(c.estado)"></span><i class="bi" [class]="iconoEstado(c.estado)"></i> {{ etiquetaEstado(c.estado) }}</span></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="6"><div class="empty-state">Nadie con esos filtros hoy.</div></td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>

            <section class="card min-w-0 p-5" data-hoy-equipos>
              <h3 class="card-title">Hoy por equipo</h3>
              <p class="mb-3 text-xs text-stone-500">Clic en un equipo para filtrar</p>
              <div class="mb-3 flex flex-wrap gap-3 text-xs text-stone-600">
                @for (s of segmentosHoy; track s.clave) { <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="s.color"></span>{{ s.texto }}</span> }
              </div>
              <div class="space-y-3">
                @for (e of h.porEquipo; track e.nombre) {
                  <button type="button" class="block w-full text-left" (click)="filtrarEquipo(e.departamentoId)" [attr.data-equipo-hoy]="e.nombre">
                    <div class="mb-1 flex justify-between text-sm"><span class="text-stone-800">{{ e.nombre }}</span><span class="text-xs text-stone-500">{{ e.programados }} prog.</span></div>
                    <div class="flex h-4 w-full overflow-hidden rounded bg-stone-100">
                      @for (s of segmentosHoy; track s.clave) {
                        @if (e[s.clave]) { <span class="h-full" [style.width.%]="e[s.clave] * 100 / maxEquipoHoy" [style.background]="s.color" [title]="s.texto + ': ' + e[s.clave]"></span> }
                      }
                    </div>
                  </button>
                } @empty { <p class="py-6 text-center text-sm text-stone-500">Sin datos hoy.</p> }
              </div>
            </section>
          </div>
        } @else {
          <!-- ===== PERÍODO ===== -->
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-6" data-kpis>
            <div class="card p-4"><p class="stat-label">Puntualidad</p><p class="stat-value mt-1">{{ pct(datos.kpis.puntualidad) }}</p>
              <p class="text-xs" [class]="claseDelta(delta(datos.kpis.puntualidad, datos.kpisAnterior.puntualidad), true)">{{ textoDelta(delta(datos.kpis.puntualidad, datos.kpisAnterior.puntualidad), 'pts') }}</p></div>
            <div class="card p-4"><p class="stat-label">Asistencia</p><p class="stat-value mt-1">{{ pct(datos.kpis.asistencia) }}</p>
              <p class="text-xs text-stone-500">{{ (datos.kpis.aTiempo + datos.kpis.tardanzas) | number }} de {{ datos.kpis.programados | number }} días</p></div>
            <div class="card p-4"><p class="stat-label">Tardanzas</p><p class="stat-value mt-1">{{ datos.kpis.tardanzas | number }}</p>
              <p class="text-xs text-stone-500">prom. {{ minutos(datos.kpis.promedioRetraso) }} · total {{ minutos(datos.kpis.minutosRetraso) }}</p></div>
            <div class="card p-4"><p class="stat-label">Faltas</p><p class="stat-value mt-1">{{ datos.kpis.faltas | number }}</p>
              <p class="text-xs" [class]="claseDelta(datos.kpis.faltas - datos.kpisAnterior.faltas, false)">{{ textoDelta(datos.kpis.faltas - datos.kpisAnterior.faltas, '') }}</p></div>
            <div class="card p-4"><p class="stat-label">Horas extra</p><p class="stat-value mt-1">{{ minutos(datos.kpis.minutosExtra ?? 0) }}</p>
              <p class="text-xs text-stone-500">sobre lo programado (desde 15 min/día)</p></div>
            <div class="card p-4"><p class="stat-label">Salidas automáticas</p><p class="stat-value mt-1">{{ datos.kpis.salidasAutomaticas | number }}</p>
              <p class="text-xs text-stone-500">no marcaron su salida</p></div>
          </div>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-kpis-marcaciones>
            <div class="card p-4"><p class="stat-label">Días con marcación</p><p class="stat-value mt-1">{{ (datos.kpis.diasMarcados ?? 0) | number }}</p>
              <p class="text-xs text-stone-500">{{ datos.kpis.personas ?? 0 }} persona(s)</p></div>
            <div class="card p-4"><p class="stat-label">Llegada promedio</p><p class="stat-value mt-1">{{ llegada(datos.kpis.llegadaPromedio) }}</p>
              <p class="text-xs text-stone-500">respecto a la hora de su turno</p></div>
            <div class="card p-4"><p class="stat-label">Horas por día</p><p class="stat-value mt-1">{{ minutos(datos.kpis.minutosPorDia ?? null) }}</p>
              <p class="text-xs text-stone-500">promedio, días con salida marcada</p></div>
            <div class="card p-4"><p class="stat-label">Días sin horario</p><p class="stat-value mt-1">{{ (datos.kpis.diasSinHorario ?? 0) | number }}</p>
              <p class="text-xs text-stone-500">marcó sin turno programado</p></div>
          </div>

          <div class="grid gap-5 xl:grid-cols-5">
            <!-- Evolución -->
            <section class="card min-w-0 p-5 xl:col-span-3">
              <h3 class="card-title">Resultado {{ tituloSerie }}</h3>
              <p class="text-xs text-stone-500">Clic en una barra para ver ese {{ datos.serie.granularidad === 'dia' ? 'día' : datos.serie.granularidad }}</p>
              <div class="my-2 flex flex-wrap gap-4 text-xs text-stone-600">
                @for (s of series; track s.clave) {
                  <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="s.color"></span><i class="bi" [class]="s.icono"></i> {{ s.texto }}</span>
                }
              </div>
              @if (datos.serie.puntos.length) {
                <svg viewBox="0 0 640 220" class="w-full" role="img" [attr.aria-label]="'Resultado ' + tituloSerie" data-serie>
                  @for (g of [0, 50, 100]; track g) {
                    <line x1="36" [attr.y1]="yBarra(g)" x2="636" [attr.y2]="yBarra(g)" stroke="currentColor" [class]="g === 0 ? 'text-stone-300' : 'text-stone-200'" />
                    <text x="0" [attr.y]="yBarra(g) + 4" font-size="10" fill="currentColor" class="text-stone-500">{{ g }}%</text>
                  }
                  @for (m of datos.serie.puntos; track m.clave; let i = $index) {
                    <g class="cursor-pointer" (click)="verPunto(m)" [attr.data-punto]="m.clave">
                      <rect [attr.x]="xBarra(i) - 2" y="10" [attr.width]="anchoBarra + 4" height="188" fill="transparent" />
                      @for (seg of segmentos(m); track seg.clave) {
                        <rect [attr.x]="xBarra(i)" [attr.y]="seg.y" [attr.width]="anchoBarra" [attr.height]="seg.alto" [attr.fill]="seg.color"
                              rx="2" class="transition-opacity hover:opacity-80">
                          <title>{{ etiquetaPunto(m.clave) }} · {{ seg.texto }}: {{ seg.valor | number }} ({{ seg.pct }} %)</title>
                        </rect>
                      }
                    </g>
                    @if (mostrarEtiqueta(i)) {
                      <text [attr.x]="xBarra(i) + anchoBarra / 2" y="214" font-size="10" text-anchor="middle" fill="currentColor" class="text-stone-500">{{ etiquetaPunto(m.clave) }}</text>
                    }
                  }
                </svg>
              } @else { <p class="py-10 text-center text-sm text-stone-500">Sin días registrados en el período.</p> }
            </section>

            <!-- Llegadas -->
            <section class="card min-w-0 p-5 xl:col-span-2">
              <h3 class="card-title">¿A qué hora llegan?</h3>
              <p class="mb-2 text-xs text-stone-500">Entradas según minutos respecto al turno · tolerancia {{ datos.toleranciaMinutos }} min</p>
              <svg viewBox="0 0 420 210" class="w-full" role="img" aria-label="Distribución de llegadas" data-llegadas>
                <line x1="10" y1="180" x2="414" y2="180" stroke="currentColor" class="text-stone-300" />
                @for (b of datos.llegadas; track b.rango; let i = $index) {
                  <rect [attr.x]="14 + i * 57" [attr.y]="180 - altoLlegada(b.cantidad)" width="46" [attr.height]="altoLlegada(b.cantidad)"
                        rx="3" [attr.fill]="b.tarde ? colorTarde : colorAusencia">
                    <title>{{ b.rango }} min: {{ b.cantidad | number }} entrada(s)</title>
                  </rect>
                  <text [attr.x]="37 + i * 57" [attr.y]="174 - altoLlegada(b.cantidad)" font-size="10" text-anchor="middle" fill="currentColor" class="text-stone-600">{{ b.cantidad | number }}</text>
                  <text [attr.x]="37 + i * 57" y="196" font-size="9.5" text-anchor="middle" fill="currentColor" class="text-stone-500">{{ b.rango }}</text>
                }
              </svg>
              <p class="mt-1 flex gap-4 text-xs text-stone-600">
                <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="colorAusencia"></span> Dentro de la tolerancia</span>
                <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="colorTarde"></span><i class="bi bi-clock"></i> Tardanza</span>
              </p>
            </section>
          </div>

          <!-- Rankings -->
          <div class="grid gap-5 lg:grid-cols-2">
            <section class="card min-w-0 p-5" data-ranking-tardanzas>
              <h3 class="card-title"><i class="bi bi-clock text-amber-600"></i> Más tardanzas</h3>
              <ol class="mt-3 space-y-2">
                @for (c of topTardanzas; track c.empleadoId; let i = $index) {
                  <li><button type="button" class="flex w-full items-center gap-3 text-left text-sm hover:text-vino-800" (click)="abrirFicha.emit(c.empleadoId)">
                    <span class="w-5 text-right text-stone-400">{{ i + 1 }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ c.nombre }} <span class="text-xs text-stone-500">· {{ c.departamento || 'Sin equipo' }}</span></span>
                    <span class="tabular-nums font-semibold">{{ c.tardanzas }}</span><span class="w-20 text-right text-xs text-stone-500">{{ minutos(c.minutosRetraso) }}</span>
                  </button></li>
                } @empty { <li class="text-sm text-stone-500">Nadie con tardanzas en el período. 🎉</li> }
              </ol>
            </section>
            <section class="card min-w-0 p-5" data-ranking-puntuales>
              <h3 class="card-title"><i class="bi bi-award text-emerald-700"></i> Más puntuales</h3>
              <ol class="mt-3 space-y-2">
                @for (c of masPuntuales; track c.empleadoId; let i = $index) {
                  <li><button type="button" class="flex w-full items-center gap-3 text-left text-sm hover:text-vino-800" (click)="abrirFicha.emit(c.empleadoId)">
                    <span class="w-5 text-right text-stone-400">{{ i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1 }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ c.nombre }} <span class="text-xs text-stone-500">· {{ c.departamento || 'Sin equipo' }}</span></span>
                    <span class="tabular-nums font-semibold">{{ pct(c.puntualidad) }}</span><span class="w-20 text-right text-xs text-stone-500">{{ c.programados }} días</span>
                  </button></li>
                } @empty { <li class="text-sm text-stone-500">Aún no hay suficientes días programados (mín. {{ minimoRanking }}).</li> }
              </ol>
            </section>
          </div>

          <div class="grid gap-5 xl:grid-cols-2">
            <!-- Mapa de tardanzas -->
            <section class="card min-w-0 p-5">
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
              } @else { <p class="py-10 text-center text-sm text-stone-500">Sin entradas programadas en el período.</p> }
            </section>

            <!-- Comparativos -->
            <section class="card min-w-0 p-5">
              @if (equiposConTurnos.length > 1) {
                <h3 class="card-title">Puntualidad por equipo</h3>
                <p class="mb-2 text-xs text-stone-500">Clic en un equipo para filtrar</p>
                <div class="mb-5 space-y-2" data-equipos>
                  @for (e of equiposConTurnos; track e.nombre) {
                    <button type="button" class="flex w-full items-center gap-3 text-left text-sm" (click)="filtrarEquipo(e.departamentoId)" [attr.data-equipo]="e.nombre"
                            [title]="e.nombre + ': ' + pct(e.puntualidad) + ' · ' + e.tardanzas + ' tardanza(s) · ' + e.faltas + ' falta(s)'">
                      <span class="w-24 shrink-0 truncate text-stone-700 sm:w-32">{{ e.nombre }}</span>
                      <span class="h-4 flex-1 rounded bg-stone-100"><span class="block h-full rounded" [style.width.%]="e.puntualidad ?? 0" [style.background]="colorAusencia"></span></span>
                      <span class="w-14 text-right tabular-nums">{{ pct(e.puntualidad) }}</span>
                    </button>
                  }
                </div>
              }
              <h3 class="card-title">Puntualidad por función</h3>
              <p class="mb-2 text-xs text-stone-500">Según la función del turno · clic para filtrar</p>
              <div class="space-y-2" data-funciones>
                @for (f of datos.porFuncion; track f.funcion) {
                  <button type="button" class="flex w-full items-center gap-3 text-left text-sm" (click)="filtrarFuncion(f.funcion)" [attr.data-funcion]="f.funcion"
                          [title]="f.funcion + ': ' + pct(f.puntualidad) + ' · ' + f.tardanzas + ' tardanza(s) · ' + f.faltas + ' falta(s)'">
                    <span class="w-24 shrink-0 truncate text-stone-700 sm:w-32">{{ f.funcion }} <span class="text-xs text-stone-500">{{ nombreFuncion(f.funcion) }}</span></span>
                    <span class="h-4 flex-1 rounded bg-stone-100"><span class="block h-full rounded" [style.width.%]="f.puntualidad ?? 0" [style.background]="colorAusencia"></span></span>
                    <span class="w-14 text-right tabular-nums">{{ pct(f.puntualidad) }}</span>
                  </button>
                } @empty { <p class="py-4 text-center text-sm text-stone-500">Sin turnos con función en el período.</p> }
              </div>
            </section>
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
                      <td class="text-right tabular-nums">{{ c.diasMarcados ?? 0 | number }}</td>
                      <td class="text-right tabular-nums">{{ c.programados | number }}</td>
                      <td class="text-right tabular-nums font-semibold">{{ pct(c.puntualidad) }}</td>
                      <td class="text-right tabular-nums">{{ c.tardanzas | number }}</td>
                      <td class="text-right tabular-nums">{{ minutos(c.minutosRetraso) }}</td>
                      <td class="text-right tabular-nums">{{ c.faltas | number }}</td>
                      <td class="text-right tabular-nums">{{ c.salidasAutomaticas | number }}</td>
                      <td class="text-right whitespace-nowrap">{{ c.entradaPromedio || '—' }}</td>
                      <td class="text-right whitespace-nowrap">{{ llegada(c.llegadaPromedio) }}</td>
                      <td class="text-right whitespace-nowrap">{{ c.minutosExtra ? minutos(c.minutosExtra) : '—' }}</td>
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
        }
      </div>
    }
  `
})
export class DashboardAsistenciaComponent implements OnInit, OnDestroy {
  @Output() abrirFicha = new EventEmitter<number>();

  private servicio = inject(ReportesAsistenciaService);
  private empleados = inject(EmpleadosService);
  private horarios = inject(HorariosService);
  private exportService = inject(ExportService);
  private notification = inject(NotificationService);
  private notificaciones = inject(NotificacionesService);

  alertas: AlertaAsistencia[] = [];
  nuevas = 0;
  alertasAbiertas = false;
  private alertasCargadas = false;
  private departamentoAlertas: number | null = null;

  readonly periodos: { valor: Periodo; texto: string }[] = [
    { valor: 'hoy', texto: 'Hoy' }, { valor: 'semana', texto: '7 días' }, { valor: 'quincena', texto: '15 días' },
    { valor: 'mes', texto: '1 mes' }, { valor: 'tres', texto: '3 meses' }, { valor: 'todo', texto: 'Todo' },
    { valor: 'personalizado', texto: 'Rango…' }
  ];
  readonly series: { clave: SerieClave; texto: string; color: string; icono: string }[] = [
    { clave: 'aTiempo', texto: 'A tiempo', color: COLOR_A_TIEMPO, icono: 'bi-check-lg' },
    { clave: 'tardanzas', texto: 'Tardanza', color: COLOR_TARDANZA, icono: 'bi-clock' },
    { clave: 'faltas', texto: 'Falta', color: COLOR_FALTA, icono: 'bi-x-lg' },
    { clave: 'diasSinHorario', texto: 'Asistió (sin horario)', color: COLOR_SIN_HORARIO, icono: 'bi-check2' }
  ];
  readonly kpisHoy: { clave: 'programados' | 'aTiempo' | 'tardanzas' | 'faltas' | 'porLlegar' | 'enTurno' | 'ausencias'; texto: string; ayuda: string; estado: string | null; color?: string }[] = [
    { clave: 'programados', texto: 'Programados', ayuda: 'con turno hoy', estado: null },
    { clave: 'aTiempo', texto: 'A tiempo', ayuda: 'dentro de la tolerancia', estado: 'a_tiempo', color: COLOR_A_TIEMPO },
    { clave: 'tardanzas', texto: 'Tardanzas', ayuda: 'llegaron tarde', estado: 'tardanza', color: COLOR_TARDANZA },
    { clave: 'faltas', texto: 'Faltas', ayuda: 'pasó su hora sin marcar', estado: 'falta', color: COLOR_FALTA },
    { clave: 'porLlegar', texto: 'Por llegar', ayuda: 'su turno aún no empieza', estado: 'pendiente', color: COLOR_PENDIENTE },
    { clave: 'enTurno', texto: 'En turno ahora', ayuda: 'marcaron y no han salido', estado: 'en_turno' },
    { clave: 'ausencias', texto: 'Ausencias', ayuda: 'vacaciones, permisos, licencias', estado: 'ausencia', color: COLOR_AUSENCIA }
  ];
  readonly segmentosHoy: { clave: 'aTiempo' | 'tardanzas' | 'faltas' | 'porLlegar' | 'sinHorario'; texto: string; color: string }[] = [
    { clave: 'aTiempo', texto: 'A tiempo', color: COLOR_A_TIEMPO },
    { clave: 'tardanzas', texto: 'Tardanza', color: COLOR_TARDANZA },
    { clave: 'faltas', texto: 'Falta', color: COLOR_FALTA },
    { clave: 'porLlegar', texto: 'Por llegar', color: COLOR_PENDIENTE },
    { clave: 'sinHorario', texto: 'Sin horario', color: COLOR_SIN_HORARIO }
  ];
  readonly columnas: { clave: Orden; texto: string; num: boolean }[] = [
    { clave: 'nombre', texto: 'Colaborador', num: false }, { clave: 'diasMarcados', texto: 'Días marcados', num: true },
    { clave: 'programados', texto: 'Días prog.', num: true },
    { clave: 'puntualidad', texto: 'Puntualidad', num: true }, { clave: 'tardanzas', texto: 'Tardanzas', num: true },
    { clave: 'minutosRetraso', texto: 'Tiempo tarde', num: true }, { clave: 'faltas', texto: 'Faltas', num: true },
    { clave: 'salidasAutomaticas', texto: 'Salidas auto.', num: true }, { clave: 'entradaPromedio', texto: 'Entrada prom.', num: true },
    { clave: 'llegadaPromedio', texto: 'Llegada prom.', num: true }, { clave: 'minutosExtra', texto: 'Horas extra', num: true },
    { clave: 'tendencia', texto: 'Tendencia', num: true }
  ];
  readonly dias = DIAS;
  readonly escala = SECUENCIAL;
  readonly colorTarde = COLOR_TARDANZA;
  readonly colorAusencia = COLOR_AUSENCIA;
  /** Días programados mínimos para entrar al ranking de puntuales. */
  readonly minimoRanking = 5;

  hoy = hoyIso();
  periodo: Periodo = 'hoy';
  filtro: FiltroDashboard = { desde: '', hasta: '', departamentoId: null, rol: '', turno: '', funcion: '', personal: 'activos' };
  datos: DashboardAsistencia | null = null;
  cargando = false;
  departamentos: { id: number; nombre: string }[] = [];
  roles: { codigo: string; nombre: string }[] = [];
  funciones: { codigo: string; nombre: string }[] = [];
  busqueda = '';
  estadoHoy: string | null = null;
  orden: Orden = 'puntualidad';
  asc = true;
  limite = 50;
  horasMapa: number[] = [];
  maxMapa = 0;
  maxEquipoHoy = 1;
  topTardanzas: ColaboradorAsistencia[] = [];
  masPuntuales: ColaboradorAsistencia[] = [];
  private mapa = new Map<string, { tardanzas: number; entradas: number }>();
  private maxLlegada = 1;
  private solicitud = 0;
  private reloj: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.empleados.departamentos().subscribe({ next: d => this.departamentos = d, error: () => {} });
    this.empleados.rolesConHorario().subscribe({ next: r => this.roles = r, error: () => {} });
    this.horarios.funcionesTurno().subscribe({ next: f => this.funciones = f.filter(x => x.activo), error: () => {} });
    this.elegirPeriodo('hoy');
  }

  ngOnDestroy() { this.detenerReloj(); }

  @HostListener('document:click')
  cerrarAlertas() { this.alertasAbiertas = false; }

  @HostListener('document:keydown.escape')
  cerrarConEscape() { this.alertasAbiertas = false; }

  /** Roles del filtro: solo los que puede ver quien consulta. */
  get rolesVisibles() {
    const alcance = this.datos?.alcanceRoles;
    return alcance ? this.roles.filter(r => alcance.includes(r.codigo.toLowerCase())) : this.roles;
  }

  elegirPeriodo(p: Periodo) {
    this.periodo = p;
    this.hoy = hoyIso();
    if (p === 'personalizado') {
      if (!this.filtro.desde || this.filtro.desde === this.hoy) this.filtro.desde = sumarDias(this.hoy, -29);
      this.filtro.hasta ||= this.hoy;
    } else {
      this.filtro.hasta = this.hoy;
      this.filtro.desde = p === 'todo' ? '2015-01-01' : sumarDias(this.hoy, 1 - (DIAS_PERIODO[p] ?? 1));
    }
    this.estadoHoy = null;
    this.detenerReloj();
    if (p === 'hoy') this.reloj = setInterval(() => this.refrescarHoy(), REFRESCO_HOY_MS);
    this.cargar();
  }

  private refrescarHoy() {
    if (this.periodo !== 'hoy' || document.hidden) return;
    const hoy = hoyIso();
    if (hoy !== this.hoy) { this.elegirPeriodo('hoy'); return; } // pasó la medianoche
    this.cargar();
  }

  private detenerReloj() {
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  // ---------- Alertas ----------
  private cargarAlertas() {
    this.servicio.alertas(this.filtro.departamentoId).subscribe({
      next: r => { this.alertas = r.alertas; this.nuevas = r.nuevas; },
      error: () => { this.alertas = []; this.nuevas = 0; }
    });
  }

  /** Al abrir el desplegable, las alertas dejan de contar como nuevas (en el menú). */
  alternarAlertas(ev: Event) {
    ev.stopPropagation();
    this.alertasAbiertas = !this.alertasAbiertas;
    if (this.alertasAbiertas && this.nuevas > 0) {
      this.servicio.marcarAlertasVistas().subscribe({ next: () => this.notificaciones.limpiarAlertasAsistencia(), error: () => {} });
    }
  }

  infoAlerta(a: AlertaAsistencia) { return ALERTAS_ASISTENCIA[a.tipo]; }
  texto(a: AlertaAsistencia) { return mensajeAlerta(a); }

  // ---------- Carga ----------
  cargar() {
    if (!this.filtro.desde || !this.filtro.hasta || this.filtro.desde > this.filtro.hasta) return;
    if (this.departamentoAlertas !== this.filtro.departamentoId || !this.alertasCargadas) {
      this.departamentoAlertas = this.filtro.departamentoId ?? null;
      this.alertasCargadas = true;
      this.cargarAlertas();
    }
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
    this.maxEquipoHoy = Math.max(1, ...(d.hoy?.porEquipo ?? []).map(e => this.segmentosHoy.reduce((s, x) => s + e[x.clave], 0)));
    const lista = d.colaboradores;
    this.topTardanzas = lista.filter(c => c.tardanzas > 0)
      .sort((a, b) => b.tardanzas - a.tardanzas || b.minutosRetraso - a.minutosRetraso).slice(0, 5);
    this.masPuntuales = lista.filter(c => c.programados >= this.minimoRanking && c.puntualidad !== null)
      .sort((a, b) => (b.puntualidad ?? 0) - (a.puntualidad ?? 0) || b.programados - a.programados || a.faltas - b.faltas).slice(0, 5);
  }

  // ---------- Filtros cruzados ----------
  get chips(): { clave: 'departamentoId' | 'rol' | 'turno' | 'funcion' | 'personal' | 'estadoHoy'; texto: string }[] {
    const f = this.filtro, c: { clave: 'departamentoId' | 'rol' | 'turno' | 'funcion' | 'personal' | 'estadoHoy'; texto: string }[] = [];
    if (f.departamentoId) c.push({ clave: 'departamentoId', texto: 'Equipo: ' + (this.departamentos.find(d => d.id === f.departamentoId)?.nombre ?? f.departamentoId) });
    if (f.rol) c.push({ clave: 'rol', texto: 'Rol: ' + (this.roles.find(r => r.codigo === f.rol)?.nombre ?? f.rol) });
    if (f.turno) c.push({ clave: 'turno', texto: 'Turno: ' + this.turnoTexto(f.turno) });
    if (f.funcion) c.push({ clave: 'funcion', texto: 'Función: ' + f.funcion });
    if (f.personal && f.personal !== 'activos') c.push({ clave: 'personal', texto: 'Personal: ' + f.personal });
    if (this.estadoHoy) c.push({ clave: 'estadoHoy', texto: 'Hoy: ' + (this.kpisHoy.find(k => k.estado === this.estadoHoy)?.texto ?? this.estadoHoy) });
    return c;
  }

  quitarFiltro(clave: 'departamentoId' | 'rol' | 'turno' | 'funcion' | 'personal' | 'estadoHoy') {
    if (clave === 'estadoHoy') { this.estadoHoy = null; return; }
    if (clave === 'departamentoId') this.filtro.departamentoId = null;
    else if (clave === 'personal') this.filtro.personal = 'activos';
    else this.filtro[clave] = '';
    this.cargar();
  }

  limpiarFiltros() {
    this.filtro = { ...this.filtro, departamentoId: null, rol: '', turno: '', funcion: '', personal: 'activos' };
    this.estadoHoy = null;
    this.cargar();
  }

  filtrarEquipo(id: number | null) {
    if (id === null || id === this.filtro.departamentoId) return;
    this.filtro.departamentoId = id;
    this.cargar();
  }

  filtrarFuncion(codigo: string) {
    if (codigo === this.filtro.funcion) return;
    this.filtro.funcion = codigo;
    this.cargar();
  }

  filtrarHoy(estado: string | null) {
    this.estadoHoy = !estado || this.estadoHoy === estado ? null : estado;
  }

  /** Clic en una barra de la evolución: ese día, semana o mes. */
  verPunto(p: PuntoSerie) {
    const g = this.datos?.serie.granularidad;
    let desde = p.clave, hasta = p.clave;
    if (g === 'semana') hasta = sumarDias(p.clave, 6);
    if (g === 'mes') {
      desde = p.clave + '-01';
      const [a, m] = p.clave.split('-').map(Number);
      hasta = iso(new Date(a, m, 0));
    }
    if (hasta > this.hoy) hasta = this.hoy;
    if (desde === this.hoy && hasta === this.hoy) { this.elegirPeriodo('hoy'); return; }
    this.detenerReloj();
    this.periodo = 'personalizado';
    this.filtro.desde = desde;
    this.filtro.hasta = hasta;
    this.cargar();
  }

  // ---------- Hoy ----------
  get hoyFiltrados(): ColaboradorHoy[] {
    const q = this.busqueda.trim().toLowerCase();
    const ausencias = ['vacaciones', 'descanso_medico', 'licencia', 'compensado', 'permiso'];
    return (this.datos?.hoy?.colaboradores ?? []).filter(c =>
      (!q || c.nombre.toLowerCase().includes(q))
      && (!this.estadoHoy
        || (this.estadoHoy === 'en_turno' ? c.enTurno : this.estadoHoy === 'ausencia' ? ausencias.includes(c.estado) : c.estado === this.estadoHoy)));
  }
  get hoyVisibles(): ColaboradorHoy[] { return this.hoyFiltrados.slice(0, this.limite); }

  /** Equipos con días programados (los que solo marcan sin horario no tienen puntualidad). */
  get equiposConTurnos() { return (this.datos?.porEquipo ?? []).filter(e => e.programados > 0); }

  get sinHorario(): number {
    return this.datos?.hoy ? this.datos.hoy.kpis.sinHorario : (this.datos?.kpis.diasSinHorario ?? 0);
  }

  get textoSemanas(): string {
    return (this.datos?.semanasBorrador ?? []).map(s => s.nombre || `${this.fecha(s.fechaInicio)} al ${this.fecha(s.fechaFin)}`).join(', ');
  }

  // ---------- Evolución ----------
  get tituloSerie(): string {
    const g = this.datos?.serie.granularidad;
    return g === 'dia' ? 'día a día' : g === 'semana' ? 'por semana' : 'por mes';
  }
  etiquetaPunto(clave: string): string {
    if (this.datos?.serie.granularidad === 'mes') return etiquetaMes(clave);
    return clave.substring(8, 10) + '/' + clave.substring(5, 7);
  }
  get anchoBarra(): number {
    const n = this.datos?.serie.puntos.length || 1;
    return Math.max(4, Math.min(40, 560 / n - 4));
  }
  xBarra(i: number): number {
    const n = this.datos?.serie.puntos.length || 1;
    return 44 + i * (592 / n) + (592 / n - this.anchoBarra) / 2;
  }
  yBarra(pct: number): number { return 196 - pct * 1.8; }
  mostrarEtiqueta(i: number): boolean {
    const n = this.datos?.serie.puntos.length || 1;
    const paso = Math.ceil(n / 12);
    return i % paso === 0 || i === n - 1;
  }
  segmentos(m: ConteoAsistencia) {
    const valor = (k: SerieClave) => (k === 'diasSinHorario' ? m.diasSinHorario ?? 0 : m[k]);
    const total = this.series.reduce((s, x) => s + valor(x.clave), 0);
    if (!total) return [];
    let acumulado = 0;
    return this.series.map(s => {
      const v = valor(s.clave);
      const pct = (v * 100) / total;
      const y = this.yBarra(acumulado + pct);
      const alto = Math.max(0, pct * 1.8 - (v ? 2 : 0));
      acumulado += pct;
      return { clave: s.clave, texto: s.texto, color: s.color, valor: v, pct: Math.round(pct * 10) / 10, y: y + (v ? 1 : 0), alto };
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
    else { this.orden = c; this.asc = c === 'nombre' || c === 'puntualidad' || c === 'entradaPromedio'; }
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

  // ---------- Exportar ----------
  get hayDatosExportables(): boolean {
    return this.datos?.hoy ? this.hoyFiltrados.length > 0 : !!this.datos?.colaboradores.length;
  }

  private get nombreArchivo(): string {
    return `dashboard_asistencia_${this.filtro.desde}${this.filtro.hasta !== this.filtro.desde ? '_' + this.filtro.hasta : ''}`;
  }

  private filasHoy() {
    return this.hoyFiltrados.map(c => ({
      colaborador: c.nombre, equipo: c.departamento, turno: this.turnoTexto(c.turno), funciones: c.funciones.join(', '),
      programado: c.entradaProgramada ? `${c.entradaProgramada} - ${c.salidaProgramada ?? ''}` : '',
      entrada: c.entrada ?? '', salida: c.salida ?? '', diferencia: this.llegada(c.minutosDiferencia), estado: this.etiquetaEstado(c.estado)
    }));
  }

  private filasPeriodo() {
    return this.colaboradoresFiltrados.map(c => ({
      colaborador: c.nombre, equipo: c.departamento || '', ingreso: c.ingreso ? fechaCorta(c.ingreso) : '', activo: c.activo ? 'Sí' : 'No',
      marcados: c.diasMarcados ?? 0, programados: c.programados, aTiempo: c.aTiempo, tardanzas: c.tardanzas, minTarde: c.minutosRetraso,
      faltas: c.faltas, salidasAuto: c.salidasAutomaticas, puntualidad: c.puntualidad ?? '', asistencia: c.asistencia ?? '',
      entradaProm: c.entradaPromedio ?? '', salidaProm: c.salidaPromedio ?? '', llegadaProm: c.llegadaPromedio ?? '',
      horasExtra: c.minutosExtra ? Math.round((c.minutosExtra / 60) * 10) / 10 : 0, sinHorario: c.diasSinHorario ?? 0, tendencia: c.tendencia ?? ''
    }));
  }

  private readonly COLUMNAS_HOY = [
    { header: 'Colaborador', dataKey: 'colaborador' }, { header: 'Equipo', dataKey: 'equipo' }, { header: 'Turno', dataKey: 'turno' },
    { header: 'Funciones', dataKey: 'funciones' }, { header: 'Programado', dataKey: 'programado' }, { header: 'Entrada', dataKey: 'entrada' },
    { header: 'Salida', dataKey: 'salida' }, { header: 'Diferencia', dataKey: 'diferencia' }, { header: 'Estado', dataKey: 'estado' }
  ];
  private readonly COLUMNAS_PERIODO = [
    { header: 'Colaborador', dataKey: 'colaborador' }, { header: 'Equipo', dataKey: 'equipo' }, { header: 'Ingreso', dataKey: 'ingreso' },
    { header: 'Activo', dataKey: 'activo' }, { header: 'Días marcados', dataKey: 'marcados' }, { header: 'Días programados', dataKey: 'programados' },
    { header: 'A tiempo', dataKey: 'aTiempo' }, { header: 'Tardanzas', dataKey: 'tardanzas' }, { header: 'Minutos tarde', dataKey: 'minTarde' },
    { header: 'Faltas', dataKey: 'faltas' }, { header: 'Salidas automáticas', dataKey: 'salidasAuto' }, { header: 'Puntualidad (%)', dataKey: 'puntualidad' },
    { header: 'Asistencia (%)', dataKey: 'asistencia' }, { header: 'Entrada promedio', dataKey: 'entradaProm' }, { header: 'Salida promedio', dataKey: 'salidaProm' },
    { header: 'Llegada promedio (min)', dataKey: 'llegadaProm' }, { header: 'Horas extra', dataKey: 'horasExtra' },
    { header: 'Días sin horario', dataKey: 'sinHorario' }, { header: 'Tendencia (pts)', dataKey: 'tendencia' }
  ];

  exportar() {
    const hoy = !!this.datos?.hoy;
    const columnas = hoy ? this.COLUMNAS_HOY : this.COLUMNAS_PERIODO;
    const filas = (hoy ? this.filasHoy() : this.filasPeriodo()).map(f =>
      Object.fromEntries(columnas.map(c => [c.header, (f as Record<string, unknown>)[c.dataKey]])));
    this.exportService.exportToExcel(filas, this.nombreArchivo, hoy ? 'Hoy' : 'Colaboradores');
  }

  exportarPdf() {
    if (!this.datos) return;
    const hoy = !!this.datos.hoy;
    const k = this.datos.kpis;
    const titulo = hoy
      ? `Asistencia de hoy ${this.fecha(this.datos.hasta)} · ${this.datos.hoy!.kpis.aTiempo} a tiempo, ${this.datos.hoy!.kpis.tardanzas} tardanzas, ${this.datos.hoy!.kpis.faltas} faltas, ${this.datos.hoy!.kpis.porLlegar} por llegar`
      : `Asistencia ${this.fecha(this.datos.desde)} al ${this.fecha(this.datos.hasta)} · puntualidad ${this.pct(k.puntualidad)}, asistencia ${this.pct(k.asistencia)}, ${k.tardanzas} tardanzas, ${k.faltas} faltas`;
    this.exportService.exportToPDF(hoy ? this.filasHoy() : this.filasPeriodo(), hoy ? this.COLUMNAS_HOY : this.COLUMNAS_PERIODO,
      { title: titulo + (this.chips.length ? ' · ' + this.chips.map(c => c.texto).join(', ') : ''), filename: this.nombreArchivo, orientation: 'landscape' });
  }

  // ---------- Formato ----------
  delta(actual: number | null, anterior: number | null): number | null {
    return actual === null || anterior === null || anterior === undefined ? null : Math.round((actual - anterior) * 10) / 10;
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
  pct(p: number | null | undefined) { return p === null || p === undefined ? '—' : `${p} %`; }
  minutos(m: number | null) { return minutosTexto(m); }
  llegada(d: number | null) { return llegadaTexto(d); }
  fecha(iso: string) { return fechaCorta(iso); }
  turnoTexto(t: string | null | undefined) { return t === 'tarde' ? 'Tarde' : t === 'manana' ? 'Mañana' : '—'; }
  nombreFuncion(codigo: string) { return this.funciones.find(f => f.codigo === codigo)?.nombre ?? ''; }
  colorEstado(e: string) { return estadoAsistencia(e).color; }
  iconoEstado(e: string) { return estadoAsistencia(e).icono; }
  etiquetaEstado(e: string) { return estadoAsistencia(e).etiqueta; }
}
