import { Component, Input, OnChanges } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FichaAsistencia } from '../../interfaces/reportes-asistencia';
import { ESTADOS_ASISTENCIA, estadoAsistencia, etiquetaMes, fechaCorta, llegadaTexto, minutosTexto } from '../../utils/estados-asistencia';

interface Celda { fecha: string; estado: string; x: number; y: number; }
interface Anio { anio: number; celdas: Celda[]; meses: { x: number; texto: string }[]; }

/**
 * Ficha de asistencia de un colaborador: indicadores, calendario día por día, puntualidad por mes y últimas
 * marcaciones. Solo muestra sus propios datos (se usa también para "Mi récord").
 */
@Component({
  selector: 'app-ficha-asistencia',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (datos) {
      <div class="space-y-5" data-ficha>
        <section class="card flex flex-wrap items-center gap-4 p-5">
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-vino-100 text-lg font-bold text-vino-800">{{ iniciales }}</div>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-stone-900">{{ datos.empleado.nombre }}
              @if (!datos.empleado.activo) { <span class="badge-gray ml-1 align-middle">Cesado</span> }
            </h2>
            <p class="text-sm text-stone-500">
              {{ datos.empleado.cargo || 'Sin cargo' }} · {{ datos.empleado.departamento || 'Sin equipo' }}
              @if (datos.empleado.ingreso) { · Ingresó el {{ fecha(datos.empleado.ingreso) }} ({{ antiguedad }}) }
            </p>
          </div>
          <p class="text-sm text-stone-500">Período: <b class="text-stone-800">{{ fecha(datos.desde) }} al {{ fecha(datos.hasta) }}</b></p>
        </section>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-6" data-kpis-ficha>
          <div class="card p-4"><p class="stat-label">Días programados</p><p class="stat-value mt-1">{{ datos.kpis.programados | number }}</p>
            <p class="text-xs text-stone-500">días laborales del período</p></div>
          <div class="card p-4"><p class="stat-label">Puntualidad</p><p class="stat-value mt-1">{{ pct(datos.kpis.puntualidad) }}</p>
            <p class="text-xs text-stone-500">{{ datos.kpis.aTiempo | number }} días a tiempo</p></div>
          <div class="card p-4"><p class="stat-label">Tardanzas</p><p class="stat-value mt-1">{{ datos.kpis.tardanzas | number }}</p>
            <p class="text-xs text-stone-500">prom. {{ minutos(datos.kpis.promedioRetraso) }} · total {{ minutos(datos.kpis.minutosRetraso) }}</p></div>
          <div class="card p-4"><p class="stat-label">Faltas</p><p class="stat-value mt-1">{{ datos.kpis.faltas | number }}</p>
            <p class="text-xs text-stone-500">{{ datos.kpis.ultimaFalta ? 'última: ' + fecha(datos.kpis.ultimaFalta) : 'ninguna en el período' }}</p></div>
          <div class="card p-4"><p class="stat-label">Llegada promedio</p><p class="stat-value mt-1">{{ llegada(datos.kpis.llegadaPromedio) }}</p>
            <p class="text-xs text-stone-500">respecto a su turno</p></div>
          <div class="card p-4"><p class="stat-label">Ausencias justificadas</p><p class="stat-value mt-1">{{ totalAusencias | number }} días</p>
            <p class="text-xs text-stone-500">{{ textoAusencias || 'ninguna' }}</p></div>
        </div>

        <!-- Marcaciones: también sirven para los días sin horario -->
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-5" data-kpis-marcaciones>
          <div class="card p-4"><p class="stat-label">Días con marcación</p><p class="stat-value mt-1">{{ (datos.kpis.diasMarcados ?? 0) | number }}</p>
            <p class="text-xs text-stone-500">con entrada registrada</p></div>
          <div class="card p-4"><p class="stat-label">Entrada promedio</p><p class="stat-value mt-1">{{ datos.kpis.entradaPromedio || '—' }}</p>
            <p class="text-xs text-stone-500">hora a la que suele llegar</p></div>
          <div class="card p-4"><p class="stat-label">Salida promedio</p><p class="stat-value mt-1">{{ datos.kpis.salidaPromedio || '—' }}</p>
            <p class="text-xs text-stone-500">sin las salidas automáticas</p></div>
          <div class="card p-4"><p class="stat-label">Horas por día</p><p class="stat-value mt-1">{{ minutos(datos.kpis.minutosPorDia ?? null) }}</p>
            <p class="text-xs text-stone-500">promedio, días con salida</p></div>
          <div class="card p-4"><p class="stat-label">Salidas automáticas</p><p class="stat-value mt-1">{{ datos.kpis.salidasAutomaticas | number }}</p>
            <p class="text-xs text-stone-500">no marcó su salida</p></div>
        </div>
        @if (datos.kpis.diasSinHorario) {
          <p class="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900" data-aviso-sin-horario>
            <i class="bi bi-info-circle"></i> {{ datos.kpis.diasSinHorario }} día(s) marcó sin horario programado: se muestran como
            <b>Asistió (sin horario)</b> y no cuentan para puntualidad ni faltas.
          </p>
        }

        <section class="card p-5">
          <h3 class="card-title">Calendario</h3>
          <p class="mb-3 text-xs text-stone-500">Cada cuadro es un día · pase el mouse para ver el detalle</p>
          <div class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
            @for (l of leyenda; track l.texto) {
              <span class="flex items-center gap-1.5"><span class="inline-block h-3 w-3 rounded-sm" [style.background]="l.color"></span><i class="bi" [class]="l.icono"></i> {{ l.texto }}</span>
            }
          </div>
          <div class="space-y-4 overflow-x-auto" data-calendario>
            @for (a of anios; track a.anio) {
              <div>
                <p class="mb-1 text-xs font-semibold text-stone-500">{{ a.anio }}</p>
                <svg [attr.width]="ANCHO" height="118" class="block" role="img" [attr.aria-label]="'Asistencia de ' + a.anio">
                  @for (d of ['L', 'M', 'X', 'J', 'V', 'S', 'D']; track $index) {
                    <text x="0" [attr.y]="22 + $index * 13" font-size="9" fill="currentColor" class="text-stone-400">{{ d }}</text>
                  }
                  @for (c of a.celdas; track c.fecha) {
                    <rect [attr.x]="c.x" [attr.y]="c.y" width="10" height="10" rx="2" [attr.fill]="color(c.estado)" [attr.data-estado]="c.estado">
                      <title>{{ fecha(c.fecha) }} · {{ etiqueta(c.estado) }}</title>
                    </rect>
                  }
                  @for (m of a.meses; track m.x) {
                    <text [attr.x]="m.x" y="112" font-size="9" fill="currentColor" class="text-stone-500">{{ m.texto }}</text>
                  }
                </svg>
              </div>
            } @empty {
              <p class="text-sm text-stone-500">Sin días registrados en el período.</p>
            }
          </div>
        </section>

        <div class="grid gap-5 lg:grid-cols-2">
          <section class="card p-5">
            <h3 class="card-title">Puntualidad por mes</h3>
            <p class="mb-2 text-xs text-stone-500">% de días a tiempo sobre los días con entrada</p>
            @if (meses.length) {
              <svg viewBox="0 0 600 190" class="w-full" role="img" aria-label="Puntualidad por mes" data-linea>
                @for (g of [100, 90, 80, 70]; track g) {
                  <line x1="40" [attr.y1]="yPct(g)" x2="590" [attr.y2]="yPct(g)" stroke="currentColor" class="text-stone-200" stroke-width="1" />
                  <text x="0" [attr.y]="yPct(g) + 4" font-size="10" fill="currentColor" class="text-stone-500">{{ g }}%</text>
                }
                <polyline [attr.points]="puntosLinea" fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" />
                @for (m of meses; track m.mes; let i = $index) {
                  @if (m.puntualidad !== null) {
                    <circle [attr.cx]="xMes(i)" [attr.cy]="yPct(m.puntualidad)" r="4" fill="#2a78d6" stroke="var(--color-superficie, #fff)" stroke-width="2">
                      <title>{{ mesTexto(m.mes) }}: {{ m.puntualidad }}% · {{ m.tardanzas }} tardanza(s) · {{ m.faltas }} falta(s)</title>
                    </circle>
                  }
                  @if (mostrarEtiquetaMes(i)) {
                    <text [attr.x]="xMes(i)" y="186" font-size="10" text-anchor="middle" fill="currentColor" class="text-stone-500">{{ mesTexto(m.mes) }}</text>
                  }
                }
              </svg>
            } @else { <p class="text-sm text-stone-500">Sin datos.</p> }
          </section>

          <section class="card">
            <div class="card-header"><h3 class="card-title">Últimas marcaciones</h3></div>
            <div class="table-wrap">
              <table class="table text-sm">
                <thead><tr><th>Fecha</th><th>Programado</th><th>Entrada</th><th>Salida</th><th>Estado</th></tr></thead>
                <tbody>
                  @for (u of datos.ultimas; track u.fecha) {
                    <tr>
                      <td class="whitespace-nowrap">{{ fecha(u.fecha) }}</td>
                      <td class="whitespace-nowrap tabular-nums text-stone-600">
                        @if (u.entradaProgramada) { {{ u.entradaProgramada }}–{{ u.salidaProgramada }}
                          @for (fn of u.funciones; track fn) { <span class="ml-0.5 text-[10px] font-semibold text-sky-700">({{ fn }})</span> }
                        } @else { — }
                      </td>
                      <td class="tabular-nums">{{ u.entrada || '—' }}</td>
                      <td class="tabular-nums">{{ u.salida || '—' }} @if (u.salidaAutomatica) { <span class="badge-gray ml-1">auto</span> }</td>
                      <td class="whitespace-nowrap"><i class="bi" [class]="icono(u.estado)"></i> {{ etiqueta(u.estado) }}
                        @if (u.minutosRetraso) { <span class="text-xs text-stone-500">({{ u.minutosRetraso }} min)</span> }</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5"><div class="empty-state">Sin marcaciones en el período.</div></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    }
  `
})
export class FichaAsistenciaComponent implements OnChanges {
  @Input() datos: FichaAsistencia | null = null;

  readonly ANCHO = 22 + 54 * 13;
  anios: Anio[] = [];
  meses: FichaAsistencia['porMes'] = [];
  readonly leyenda = [
    { texto: 'A tiempo', ...this.pick('a_tiempo') },
    { texto: 'Tardanza', ...this.pick('tardanza') },
    { texto: 'Falta', ...this.pick('falta') },
    { texto: 'Vacaciones, licencias y permisos', ...this.pick('vacaciones') },
    { texto: 'Descanso o feriado', ...this.pick('descanso') },
    { texto: 'Asistió (sin horario)', ...this.pick('asistio') }
  ];

  private pick(e: string) {
    const x = ESTADOS_ASISTENCIA[e];
    return { color: x.color, icono: x.icono };
  }

  ngOnChanges() {
    this.meses = this.datos?.porMes ?? [];
    this.anios = this.armarCalendario(this.datos?.calendario ?? []);
  }

  /** Un bloque por año: columnas = semanas (lunes a domingo), filas = días. */
  private armarCalendario(dias: { fecha: string; estado: string }[]): Anio[] {
    const porAnio = new Map<number, Anio>();
    for (const d of dias) {
      const f = new Date(d.fecha + 'T00:00:00');
      const anio = f.getFullYear();
      let a = porAnio.get(anio);
      if (!a) { a = { anio, celdas: [], meses: [] }; porAnio.set(anio, a); }
      const primero = new Date(anio, 0, 1);
      const desfase = (primero.getDay() + 6) % 7; // lunes = 0
      const diaDelAnio = Math.round((f.getTime() - primero.getTime()) / 86400000);
      const semana = Math.floor((diaDelAnio + desfase) / 7);
      const fila = (f.getDay() + 6) % 7;
      a.celdas.push({ fecha: d.fecha, estado: d.estado, x: 22 + semana * 13, y: 13 + fila * 13 });
    }
    for (const a of porAnio.values()) {
      const desfase = (new Date(a.anio, 0, 1).getDay() + 6) % 7;
      for (let m = 0; m < 12; m++) {
        const dia = Math.round((new Date(a.anio, m, 1).getTime() - new Date(a.anio, 0, 1).getTime()) / 86400000);
        a.meses.push({ x: 22 + Math.floor((dia + desfase) / 7) * 13, texto: etiquetaMes(`${a.anio}-${String(m + 1).padStart(2, '0')}`).split(' ')[0] });
      }
    }
    return [...porAnio.values()].sort((x, y) => y.anio - x.anio);
  }

  get iniciales(): string {
    return (this.datos?.empleado.nombre || '').split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  get antiguedad(): string {
    const ingreso = this.datos?.empleado.ingreso;
    if (!ingreso) return '';
    const i = new Date(ingreso + 'T00:00:00'), h = new Date();
    let meses = (h.getFullYear() - i.getFullYear()) * 12 + h.getMonth() - i.getMonth();
    if (h.getDate() < i.getDate()) meses--;
    const a = Math.floor(meses / 12), m = meses % 12;
    return [a ? `${a} año${a > 1 ? 's' : ''}` : '', m ? `${m} mes${m > 1 ? 'es' : ''}` : ''].filter(Boolean).join(' ') || 'menos de un mes';
  }

  get totalAusencias(): number {
    return Object.values(this.datos?.kpis.ausencias ?? {}).reduce((a, b) => a + b, 0);
  }

  get textoAusencias(): string {
    return Object.entries(this.datos?.kpis.ausencias ?? {}).map(([k, v]) => `${this.etiqueta(k).toLowerCase()} ${v}`).join(' · ');
  }

  get puntosLinea(): string {
    return this.meses.map((m, i) => m.puntualidad === null ? null : `${this.xMes(i)},${this.yPct(m.puntualidad)}`)
      .filter(Boolean).join(' ');
  }

  xMes(i: number): number {
    const n = Math.max(this.meses.length - 1, 1);
    return this.meses.length === 1 ? 315 : 50 + (i * 530) / n;
  }

  /** Escala 60 % – 100 % (la puntualidad rara vez baja de ahí; los valores menores quedan en el borde). */
  yPct(p: number): number {
    const v = Math.max(60, Math.min(100, p));
    return 10 + (100 - v) * 4;
  }

  mostrarEtiquetaMes(i: number): boolean {
    const paso = Math.ceil(this.meses.length / 12);
    return i % paso === 0 || i === this.meses.length - 1;
  }

  color(e: string) { return estadoAsistencia(e).color; }
  etiqueta(e: string) { return estadoAsistencia(e).etiqueta; }
  icono(e: string) { return estadoAsistencia(e).icono; }
  fecha(iso: string | null) { return fechaCorta(iso); }
  minutos(m: number | null) { return minutosTexto(m); }
  llegada(d: number | null) { return llegadaTexto(d); }
  mesTexto(m: string) { return etiquetaMes(m); }
  pct(p: number | null) { return p === null ? '—' : `${p} %`; }
}
