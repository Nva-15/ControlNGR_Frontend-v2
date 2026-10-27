import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../shared/modal/modal.component';
import { DiaTurnoPayload, TurnoSemanaPayload } from '../../services/horarios';
import { FuncionTurno } from '../../interfaces/horario';
import {
  CONFIG_TURNOS_DEFECTO, ConfigTurnos, duracionMinutos, entradaSugerida, formatoHoras, refrigerioSugerido,
  salidaSugerida, textoJornada
} from '../../utils/turnos';

/** Un día que se edita: lo que tiene hoy (tipo, turno, horas y funciones). */
export interface DiaEditorTurno {
  /** Fecha AAAA-MM-DD (semana) o lunes...domingo (horario base). */
  clave: string;
  /** "Lun 26/10" o "Lunes". */
  etiqueta: string;
  /** Tipo de día actual: normal, descanso, vacaciones, permiso... */
  tipo: string;
  /** Días por solicitud aprobada: se muestran pero no se cambian. */
  bloqueado?: boolean;
  /** Texto del tipo actual (p. ej. "Vacaciones"). */
  etiquetaTipo?: string;
  turno?: string;
  horaEntrada?: string;
  horaSalida?: string;
  horaAlmuerzoInicio?: string;
  horaAlmuerzoFin?: string;
  funciones?: string[];
  /** Si la fecha es feriado, su nombre: permite "Descanso feriado". */
  feriado?: string;
}

/** Un turno que se ofrece como ficha (los más usados por el equipo). */
export interface PlantillaTurno {
  turno?: string;
  horaEntrada?: string;
  horaSalida?: string;
  horaAlmuerzoInicio?: string;
  horaAlmuerzoFin?: string;
  funciones?: string[];
}

type Estado = 'normal' | 'descanso' | 'feriado' | 'otro';

/** Una entrada desde esta hora se toma como turno tarde (se puede cambiar a mano). */
const HORA_TARDE = '13:00';
type Turno = 'manana' | 'tarde';

interface Fila {
  dia: DiaEditorTurno;
  estado: Estado;
  turno: Turno;
  entrada: string;
  salida: string;
  almInicio: string;
  almFin: string;
  funciones: string[];
}

/** Ficha que se "pinta" sobre los días. */
interface Ficha {
  tipo: 'normal' | 'descanso' | 'feriado';
  turno: Turno;
  entrada: string;
  salida: string;
  almInicio: string;
  almFin: string;
  funciones: string[];
}

/**
 * Turnos de una semana (o del horario base) en pocos toques: se elige una ficha de turno (los más usados
 * por el equipo, Descanso, Feriado u otro turno) y se tocan o arrastran los días. El lápiz de cada día
 * permite ajustarlo solo. La salida y el refrigerio se calculan solos. Máximo un día de descanso.
 */
@Component({
  selector: 'app-editor-turno',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal [abierto]="abierto" [titulo]="titulo" [subtitulo]="subtitulo" icono="bi-calendar-week"
               tamano="xl" [cerrarAlClicFuera]="false" (cerrar)="cerrar.emit()">
      <div class="space-y-5" data-editor-turno>
        <!-- 1. Fichas de turno -->
        <div>
          <p class="mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold text-stone-600">
            <span>1. Elija un turno</span>
            <span class="font-normal text-stone-400">los más usados en el equipo</span>
          </p>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Turno a aplicar">
            @for (f of fichas; track $index) {
              <button type="button" role="radio" [attr.aria-checked]="esSeleccionada(f)" data-ficha [attr.data-ficha-clave]="claveFicha(f)"
                      class="flex min-w-28 flex-col rounded-xl border-[1.5px] px-3 py-2 text-left transition"
                      [class]="claseFicha(f)" (click)="elegir(f)">
                @if (f.tipo === 'normal') {
                  <span class="text-sm font-bold tabular-nums text-stone-900">{{ f.entrada }} – {{ f.salida }}</span>
                  <span class="flex items-center gap-1 text-[11px] text-stone-500">{{ f.turno === 'tarde' ? 'Tarde' : 'Mañana' }} · {{ horas(f) }}
                    @for (c of f.funciones; track c) { <span class="rounded-full bg-sky-700 px-1.5 text-[10px] font-bold text-white">{{ c }}</span> }
                  </span>
                } @else if (f.tipo === 'descanso') {
                  <span class="text-sm font-bold text-stone-700"><i class="bi bi-moon-stars"></i> Descanso</span>
                  <span class="text-[11px] text-stone-500">{{ config.maxDescansos }} por semana</span>
                } @else {
                  <span class="text-sm font-bold text-teal-800"><i class="bi bi-calendar-heart"></i> Feriado</span>
                  <span class="text-[11px] text-teal-700">no cuenta como descanso</span>
                }
              </button>
            }
            <button type="button" class="flex min-w-28 items-center justify-center rounded-xl border-[1.5px] border-dashed border-vino-300 px-3 py-2 text-sm font-semibold text-vino-700 hover:bg-vino-50"
                    (click)="abrirNueva()" data-otro-turno><i class="bi bi-plus-lg mr-1"></i> Otro turno</button>
          </div>
        </div>

        <!-- 2. Días: tocar o arrastrar -->
        <div>
          <p class="mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold text-stone-600">
            <span>2. Toque los días</span>
            <span class="font-normal text-stone-400">toque o arrastre para varios · ✎ para ajustar uno</span>
          </p>
          <div class="grid select-none grid-cols-4 gap-2 sm:grid-cols-7" style="touch-action: none"
               (pointerdown)="iniciarArrastre($event)" (pointermove)="arrastrar($event)" data-dias>
            @for (f of filas; track f.dia.clave) {
              <div class="group relative flex min-h-28 flex-col rounded-xl border-[1.5px] p-2.5 transition" role="button" tabindex="0"
                   [attr.data-fila]="f.dia.clave" [attr.data-estado]="f.dia.bloqueado ? 'bloqueado' : f.estado"
                   [attr.aria-label]="f.dia.etiqueta + ': ' + resumen(f)" [attr.aria-disabled]="f.dia.bloqueado || null"
                   [class]="claseDia(f)" (keydown.enter)="aplicar(f)" (keydown.space)="aplicar(f); $event.preventDefault()">
                <span class="text-xs font-bold uppercase text-stone-700">{{ f.dia.etiqueta }}</span>
                @if (f.dia.feriado) {
                  <span class="truncate text-[10px] font-semibold text-teal-700" [title]="f.dia.feriado"><i class="bi bi-calendar-heart"></i> {{ f.dia.feriado }}</span>
                }
                <span class="mt-auto">
                  @if (f.dia.bloqueado) {
                    <span class="text-xs font-semibold text-oro-700"><i class="bi bi-lock-fill"></i> {{ f.dia.etiquetaTipo }}</span>
                  } @else if (f.estado === 'normal') {
                    <span class="block text-base font-bold tabular-nums text-stone-900">{{ f.entrada }}</span>
                    <span class="flex flex-wrap items-center gap-1 text-xs tabular-nums text-stone-500">{{ f.salida }}
                      @for (c of f.funciones; track c) { <span class="rounded-full bg-sky-700 px-1.5 text-[10px] font-bold text-white">{{ c }}</span> }
                    </span>
                  } @else if (f.estado === 'descanso') {
                    <span class="block break-words text-xs font-semibold sm:text-sm text-stone-600"><i class="bi bi-moon-stars"></i> Descanso</span>
                  } @else if (f.estado === 'feriado') {
                    <span class="block break-words text-xs font-semibold sm:text-sm text-teal-800"><i class="bi bi-calendar-heart"></i> Feriado</span>
                  } @else {
                    <span class="block break-words text-xs font-semibold sm:text-sm text-oro-800">{{ f.dia.etiquetaTipo }}</span>
                  }
                </span>
                @if (!f.dia.bloqueado) {
                  <button type="button" class="btn-icon absolute right-1 top-1 h-7 w-7 text-xs opacity-60 group-hover:opacity-100 focus:opacity-100"
                          [attr.aria-label]="'Ajustar ' + f.dia.etiqueta" data-ajustar (pointerdown)="$event.stopPropagation()" (click)="abrirAjuste(f)">
                    <i class="bi bi-pencil"></i></button>
                }
              </div>
            }
          </div>
          @if (aviso) { <p class="mt-2 text-xs font-medium text-red-700" data-aviso><i class="bi bi-exclamation-circle"></i> {{ aviso }}</p> }
          @if (descansos > config.maxDescansos) {
            <p class="alert-danger mt-2" data-error-descansos><i class="bi bi-exclamation-triangle"></i>
              Solo se permite {{ config.maxDescansos }} día de descanso por semana; hay {{ descansos }}. Asigne un turno a alguno.</p>
          }
        </div>

        <!-- Ajustar un día / crear otro turno -->
        @if (panel) {
          <div class="rounded-xl border border-stone-200 bg-stone-50 p-4" data-panel>
            <div class="mb-3 flex items-center justify-between">
              <p class="text-sm font-semibold text-stone-800">{{ panel.fila ? 'Ajustar ' + panel.fila.dia.etiqueta : 'Otro turno' }}</p>
              <button type="button" class="btn-icon h-7 w-7" aria-label="Cerrar" (click)="panel = null"><i class="bi bi-x-lg"></i></button>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              @if (panel.fila) {
                <div class="inline-flex rounded-lg border border-stone-200 bg-superficie p-0.5">
                  @for (t of tiposPanel; track t.valor) {
                    @if (t.valor !== 'feriado' || panel.fila.dia.feriado) {
                      <button type="button" class="rounded-md px-2.5 py-1 text-xs" [attr.data-panel-tipo]="t.valor"
                              [class]="panel.ficha.tipo === t.valor ? 'bg-vino-700 text-white' : 'text-stone-600 hover:bg-stone-100'"
                              (click)="panel.ficha.tipo = t.valor">{{ t.texto }}</button>
                    }
                  }
                </div>
              }
              @if (panel.ficha.tipo === 'normal') {
                <div class="inline-flex rounded-lg border border-stone-200 bg-superficie p-0.5">
                  @for (t of turnos; track t.valor) {
                    <button type="button" class="rounded-md px-2.5 py-1 text-xs" [attr.data-panel-turno]="t.valor"
                            [class]="panel.ficha.turno === t.valor ? 'bg-vino-100 font-semibold text-vino-800' : 'text-stone-600 hover:bg-stone-100'"
                            (click)="cambiarTurnoPanel(t.valor)">{{ t.texto }}</button>
                  }
                </div>
                <div class="flex items-center gap-1">
                  <input type="time" class="input w-30 py-1!" [(ngModel)]="panel.ficha.entrada" (ngModelChange)="entradaPanel()" aria-label="Entrada" data-panel-entrada />
                  <span class="text-stone-400">→</span>
                  <input type="time" class="input w-30 py-1!" [(ngModel)]="panel.ficha.salida" aria-label="Salida" data-panel-salida />
                </div>
                <div class="flex flex-wrap gap-1">
                  @for (fn of funcionesPara(panel.ficha); track fn.codigo) {
                    <button type="button" class="rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset" [title]="fn.nombre" [attr.data-panel-funcion]="fn.codigo"
                            [class]="panel.ficha.funciones.includes(fn.codigo) ? 'bg-sky-700 text-white ring-sky-700' : 'text-stone-500 ring-stone-300 hover:bg-stone-100'"
                            (click)="alternarFuncion(panel.ficha.funciones, fn.codigo)">{{ fn.codigo }}</button>
                  }
                </div>
              }
            </div>
            @if (panel.ficha.tipo === 'normal') {
              <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                @if (panel.ficha.turno === 'manana') {
                  <span class="flex items-center gap-1">Refrigerio
                    <input type="time" class="input w-28 px-2! py-0.5! text-xs" [(ngModel)]="panel.ficha.almInicio" (ngModelChange)="moverRefrigerio(panel.ficha)" aria-label="Inicio de refrigerio" />
                    –
                    <input type="time" class="input w-28 px-2! py-0.5! text-xs" [(ngModel)]="panel.ficha.almFin" aria-label="Fin de refrigerio" />
                  </span>
                }
                <span>{{ jornada(panel.ficha) }}</span>
              </div>
            }
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" class="btn-primary btn-sm" [disabled]="!fichaValida(panel.ficha)" (click)="confirmarPanel()" data-panel-aplicar>
                {{ panel.fila ? 'Aplicar a ' + panel.fila.dia.etiqueta : 'Agregar turno' }}</button>
              @if (panel.fila && permiteMasOpciones) {
                <button type="button" class="btn-ghost btn-sm" (click)="masOpciones()" data-mas-opciones>Permiso u otro tipo de día…</button>
              }
            </div>
          </div>
        }

        @if (mostrarGuardarBase) {
          <label class="flex items-start gap-2 rounded-lg border border-stone-200 p-3 text-sm">
            <input type="checkbox" class="checkbox mt-0.5" [(ngModel)]="guardarComoBase" data-guardar-base />
            <span><b>Guardar también como horario base</b><br>
              <span class="text-xs text-stone-500">Se usa para los colaboradores nuevos en semanas futuras y para completar días sin horario.</span></span>
          </label>
        }
      </div>

      <div footer class="flex w-full flex-wrap items-center justify-end gap-2">
        <button type="button" class="btn-secondary" (click)="cerrar.emit()">Cancelar</button>
        <button type="button" class="btn-primary" [disabled]="guardando || !puedeGuardar" (click)="enviar()" data-guardar-turno>
          {{ guardando ? 'Guardando...' : textoGuardar }}
        </button>
      </div>
    </app-modal>
  `
})
export class EditorTurnoComponent implements OnChanges {
  @Input() abierto = false;
  @Input() titulo = 'Editar semana';
  @Input() subtitulo = '';
  @Input() dias: DiaEditorTurno[] = [];
  /** Turnos más usados por el equipo (se ofrecen como fichas). */
  @Input() plantillas: PlantillaTurno[] = [];
  @Input() config: ConfigTurnos = CONFIG_TURNOS_DEFECTO;
  @Input() funciones: FuncionTurno[] = [];
  @Input() mostrarGuardarBase = false;
  @Input() guardarBaseInicial = false;
  @Input() guardando = false;
  @Input() textoGuardar = 'Guardar semana';
  /** Muestra en el ajuste de un día el enlace al formulario completo (permiso, otro tipo de día). */
  @Input() permiteMasOpciones = false;
  /** Día en que se hizo clic: su turno queda elegido al abrir. */
  @Input() diaInicial = '';
  @Output() guardar = new EventEmitter<TurnoSemanaPayload>();
  @Output() cerrar = new EventEmitter<void>();
  /** Abrir el formulario completo de un día (clave del día). */
  @Output() editarUnDia = new EventEmitter<string>();

  readonly turnos: { valor: Turno; texto: string }[] = [
    { valor: 'manana', texto: 'Mañana' },
    { valor: 'tarde', texto: 'Tarde' }
  ];
  readonly tiposPanel: { valor: Ficha['tipo']; texto: string }[] = [
    { valor: 'normal', texto: 'Trabaja' },
    { valor: 'descanso', texto: 'Descansa' },
    { valor: 'feriado', texto: 'Feriado' }
  ];

  filas: Fila[] = [];
  fichas: Ficha[] = [];
  seleccionada: Ficha | null = null;
  panel: { fila: Fila | null; ficha: Ficha } | null = null;
  aviso = '';
  guardarComoBase = false;
  private arrastrando = false;
  private avisoTimer: ReturnType<typeof setTimeout> | undefined;

  ngOnChanges(cambios: SimpleChanges) {
    if (cambios['abierto'] && this.abierto) this.iniciar();
  }

  private iniciar() {
    this.filas = this.dias.map(d => this.filaDe(d));
    this.guardarComoBase = this.guardarBaseInicial;
    this.panel = null;
    this.aviso = '';
    this.armarFichas();
    const clicada = this.filas.find(f => f.dia.clave === this.diaInicial && !f.dia.bloqueado && f.estado !== 'otro');
    this.seleccionada = (clicada && this.fichas.find(x => this.claveFicha(x) === this.claveFicha(this.fichaDeFila(clicada))))
      ?? this.fichas[0] ?? null;
  }

  /** Fichas: los turnos de la persona y del equipo (sin repetir), los sugeridos de mañana y tarde, Descanso y Feriado. */
  private armarFichas() {
    const vistas = new Set<string>();
    const normales: Ficha[] = [];
    const agregar = (f: Ficha) => {
      const k = this.claveFicha(f);
      if (!vistas.has(k) && f.entrada && f.salida) { vistas.add(k); normales.push(f); }
    };
    for (const f of this.filas) if (!f.dia.bloqueado && f.estado === 'normal' && f.dia.horaEntrada) agregar(this.fichaDeFila(f));
    for (const p of this.plantillas) agregar(this.fichaDePlantilla(p));
    const fichas = normales.slice(0, 6);
    for (const t of ['manana', 'tarde'] as Turno[]) {
      if (!fichas.some(f => f.turno === t)) fichas.push(this.fichaSugerida(t));
    }
    fichas.push(this.fichaVacia('descanso'));
    if (this.filas.some(f => f.dia.feriado)) fichas.push(this.fichaVacia('feriado'));
    this.fichas = fichas;
  }

  private filaDe(d: DiaEditorTurno): Fila {
    const estado: Estado = !d.tipo || d.tipo === 'normal' ? 'normal' : d.tipo === 'descanso' ? 'descanso'
      : d.tipo === 'descanso_feriado' && d.feriado ? 'feriado' : 'otro';
    const fila: Fila = {
      dia: d, estado, turno: d.turno === 'tarde' ? 'tarde' : 'manana',
      entrada: (d.horaEntrada || '').substring(0, 5), salida: (d.horaSalida || '').substring(0, 5),
      almInicio: (d.horaAlmuerzoInicio || '').substring(0, 5), almFin: (d.horaAlmuerzoFin || '').substring(0, 5),
      funciones: [...(d.funciones || [])]
    };
    // Día laboral aún sin horas (sin horario base): se propone el turno sugerido
    if (estado === 'normal' && !fila.entrada) Object.assign(fila, this.horasDe(this.fichaSugerida(fila.turno)));
    else if (fila.turno === 'manana' && fila.entrada && !fila.almInicio) this.refrigerio(fila);
    return fila;
  }

  private fichaDeFila(f: Fila): Ficha {
    if (f.estado === 'descanso' || f.estado === 'feriado') return this.fichaVacia(f.estado);
    return { tipo: 'normal', turno: f.turno, entrada: f.entrada, salida: f.salida, almInicio: f.almInicio, almFin: f.almFin, funciones: [...f.funciones] };
  }

  private fichaDePlantilla(p: PlantillaTurno): Ficha {
    const f: Ficha = {
      tipo: 'normal', turno: p.turno === 'tarde' ? 'tarde' : 'manana',
      entrada: (p.horaEntrada || '').substring(0, 5), salida: (p.horaSalida || '').substring(0, 5),
      almInicio: (p.horaAlmuerzoInicio || '').substring(0, 5), almFin: (p.horaAlmuerzoFin || '').substring(0, 5),
      funciones: [...(p.funciones || [])]
    };
    if (f.turno === 'manana' && !f.almInicio) this.refrigerio(f);
    return f;
  }

  private fichaSugerida(turno: Turno): Ficha {
    const f: Ficha = { tipo: 'normal', turno, entrada: entradaSugerida(turno, this.config), salida: '', almInicio: '', almFin: '', funciones: [] };
    this.recalcular(f);
    return f;
  }

  private fichaVacia(tipo: 'descanso' | 'feriado'): Ficha {
    return { tipo, turno: 'manana', entrada: '', salida: '', almInicio: '', almFin: '', funciones: [] };
  }

  private horasDe(f: Ficha) {
    return { turno: f.turno, entrada: f.entrada, salida: f.salida, almInicio: f.almInicio, almFin: f.almFin, funciones: [...f.funciones] };
  }

  claveFicha(f: Ficha): string {
    return f.tipo !== 'normal' ? f.tipo : `${f.turno}|${f.entrada}|${f.salida}|${[...f.funciones].sort().join(',')}`;
  }

  esSeleccionada(f: Ficha): boolean {
    return !!this.seleccionada && this.claveFicha(this.seleccionada) === this.claveFicha(f);
  }

  claseFicha(f: Ficha): string {
    const sel = this.esSeleccionada(f);
    const anillo = sel ? ' border-vino-700 ring-3 ring-vino-200' : '';
    if (f.tipo === 'descanso') return 'bg-stone-100 hover:bg-stone-200' + (sel ? anillo : ' border-stone-200');
    if (f.tipo === 'feriado') return 'bg-teal-50 hover:bg-teal-100' + (sel ? anillo : ' border-teal-200');
    return sel ? 'bg-vino-50' + anillo : 'border-stone-200 bg-superficie hover:bg-stone-50';
  }

  claseDia(f: Fila): string {
    if (f.dia.bloqueado) return 'cursor-not-allowed border-dashed border-stone-300 bg-stone-50';
    const coincide = !!this.seleccionada && f.estado !== 'otro'
      && this.claveFicha(this.seleccionada) === this.claveFicha(this.fichaDeFila(f));
    const borde = coincide ? 'border-vino-600 ring-3 ring-vino-100' : '';
    if (f.estado === 'descanso') return `cursor-pointer bg-stone-100 ${borde || 'border-stone-200 hover:border-stone-400'}`;
    if (f.estado === 'feriado') return `cursor-pointer bg-teal-50 ${borde || 'border-teal-200 hover:border-teal-400'}`;
    if (f.estado === 'otro') return 'cursor-pointer border-oro-200 bg-oro-50 hover:border-oro-400';
    return `cursor-pointer bg-superficie ${borde || 'border-stone-200 hover:border-stone-400'}`;
  }

  horas(f: Ficha): string {
    const total = duracionMinutos(f.entrada, f.salida);
    return total ? formatoHoras(total) : '';
  }

  resumen(f: Fila): string {
    if (f.dia.bloqueado) return f.dia.etiquetaTipo || '';
    if (f.estado === 'normal') return `${f.entrada} a ${f.salida}${f.funciones.length ? ' ' + f.funciones.join(' ') : ''}`;
    if (f.estado === 'descanso') return 'Descanso';
    if (f.estado === 'feriado') return 'Feriado';
    return f.dia.etiquetaTipo || '';
  }

  jornada(f: Ficha): string {
    return textoJornada(f.entrada, f.salida, f.turno, f.almInicio, f.almFin);
  }

  get descansos(): number {
    return this.filas.filter(f => !f.dia.bloqueado && f.estado === 'descanso').length;
  }

  get puedeGuardar(): boolean {
    if (this.descansos > this.config.maxDescansos) return false;
    const editables = this.filas.filter(f => !f.dia.bloqueado && f.estado !== 'otro');
    return editables.length > 0 && editables.every(f => f.estado !== 'normal' || this.fichaValida(this.fichaDeFila(f)));
  }

  fichaValida(f: Ficha): boolean {
    if (f.tipo !== 'normal') return true;
    return !!f.entrada && !!f.salida && f.entrada !== f.salida && (f.turno === 'tarde' || !!f.almInicio === !!f.almFin);
  }

  funcionesPara(f: Ficha): FuncionTurno[] {
    return this.funciones.filter(fn => fn.activo || f.funciones.includes(fn.codigo));
  }

  // ---------- Pintar días ----------

  elegir(f: Ficha) {
    this.seleccionada = f;
    this.panel = null;
  }

  /** Aplica la ficha elegida al día (respeta bloqueados, feriados y el máximo de descansos). */
  aplicar(f: Fila) {
    const ficha = this.seleccionada;
    if (!ficha || f.dia.bloqueado) return;
    if (ficha.tipo === 'feriado' && !f.dia.feriado) {
      this.avisar(`${f.dia.etiqueta} no es feriado.`);
      return;
    }
    if (ficha.tipo === 'descanso' && f.estado !== 'descanso' && this.descansos >= this.config.maxDescansos) {
      this.avisar(`Solo se permite ${this.config.maxDescansos} día de descanso por semana.`);
      return;
    }
    this.ponerFicha(f, ficha);
  }

  private ponerFicha(f: Fila, ficha: Ficha) {
    if (ficha.tipo === 'normal') {
      f.estado = 'normal';
      Object.assign(f, this.horasDe(ficha));
    } else {
      f.estado = ficha.tipo;
    }
  }

  iniciarArrastre(e: PointerEvent) {
    const fila = this.filaEn(e.target);
    if (!fila) return;
    this.arrastrando = true;
    this.aplicar(fila);
  }

  arrastrar(e: PointerEvent) {
    if (!this.arrastrando) return;
    const fila = this.filaEn(document.elementFromPoint(e.clientX, e.clientY));
    if (fila) this.aplicar(fila);
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  terminarArrastre() {
    this.arrastrando = false;
  }

  private filaEn(objetivo: EventTarget | Element | null): Fila | undefined {
    const el = (objetivo as Element | null)?.closest?.('[data-fila]');
    const clave = el?.getAttribute('data-fila');
    return clave ? this.filas.find(f => f.dia.clave === clave) : undefined;
  }

  private avisar(texto: string) {
    this.aviso = texto;
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso = '', 3500);
  }

  // ---------- Ajustar un día / otro turno ----------

  abrirAjuste(f: Fila) {
    const ficha = f.estado === 'otro' ? this.fichaSugerida(f.turno) : this.fichaDeFila(f);
    if (ficha.tipo !== 'normal' && !ficha.entrada) Object.assign(ficha, this.horasDe(this.fichaSugerida('manana')), { tipo: ficha.tipo });
    this.panel = { fila: f, ficha };
  }

  abrirNueva() {
    this.panel = { fila: null, ficha: this.fichaSugerida('manana') };
  }

  /** Al escribir la entrada se deduce el turno (desde las 13:00, tarde) y se recalcula la salida. */
  entradaPanel() {
    const f = this.panel?.ficha;
    if (!f) return;
    if (f.entrada) f.turno = f.entrada >= HORA_TARDE ? 'tarde' : 'manana';
    this.recalcular(f);
  }

  cambiarTurnoPanel(turno: Turno) {
    if (!this.panel || this.panel.ficha.turno === turno) return;
    this.panel.ficha.turno = turno;
    this.panel.ficha.entrada = entradaSugerida(turno, this.config);
    this.recalcular(this.panel.ficha);
  }

  confirmarPanel() {
    if (!this.panel || !this.fichaValida(this.panel.ficha)) return;
    const { fila, ficha } = this.panel;
    if (fila) {
      if (ficha.tipo === 'descanso' && fila.estado !== 'descanso' && this.descansos >= this.config.maxDescansos) {
        this.avisar(`Solo se permite ${this.config.maxDescansos} día de descanso por semana.`);
        return;
      }
      this.ponerFicha(fila, ficha);
    } else {
      // Otro turno: se agrega como ficha y queda elegido para tocar los días
      const k = this.claveFicha(ficha);
      const existente = this.fichas.find(x => this.claveFicha(x) === k);
      if (!existente) this.fichas.splice(this.fichas.findIndex(x => x.tipo !== 'normal'), 0, ficha);
      this.seleccionada = existente ?? ficha;
    }
    this.panel = null;
  }

  masOpciones() {
    const clave = this.panel?.fila?.dia.clave;
    if (clave) this.editarUnDia.emit(clave);
  }

  /** Salida = entrada + jornada del turno; refrigerio del turno mañana 4 h después de la entrada. */
  recalcular(f: Ficha) {
    f.salida = salidaSugerida(f.entrada, f.turno, this.config);
    this.refrigerio(f);
  }

  private refrigerio(f: { turno: Turno; entrada: string; almInicio: string; almFin: string }) {
    if (f.turno === 'manana' && f.entrada) {
      const r = refrigerioSugerido(f.entrada, this.config);
      f.almInicio = r.inicio;
      f.almFin = r.fin;
    } else {
      f.almInicio = '';
      f.almFin = '';
    }
  }

  /** Si mueve el inicio del refrigerio, el fin lo acompaña con la misma duración. */
  moverRefrigerio(f: Ficha) {
    if (f.almInicio) f.almFin = refrigerioSugerido(f.almInicio, { ...this.config, refrigerioDespuesHoras: 0 }).fin;
  }

  alternarFuncion(lista: string[], codigo: string) {
    const i = lista.indexOf(codigo);
    if (i >= 0) lista.splice(i, 1); else lista.push(codigo);
  }

  enviar() {
    if (!this.puedeGuardar) return;
    const dias: DiaTurnoPayload[] = this.filas
      .filter(f => !f.dia.bloqueado && f.estado !== 'otro')
      .map(f => f.estado !== 'normal'
        ? { clave: f.dia.clave, tipoDia: f.estado === 'feriado' ? 'descanso_feriado' : 'descanso', turno: null, horaEntrada: null,
            horaSalida: null, horaAlmuerzoInicio: null, horaAlmuerzoFin: null, funciones: [] }
        : { clave: f.dia.clave, tipoDia: 'normal', turno: f.turno, horaEntrada: f.entrada, horaSalida: f.salida,
            horaAlmuerzoInicio: f.turno === 'manana' && f.almInicio ? f.almInicio : null,
            horaAlmuerzoFin: f.turno === 'manana' && f.almFin ? f.almFin : null,
            funciones: [...f.funciones] });
    this.guardar.emit({ dias, guardarComoBase: this.mostrarGuardarBase ? this.guardarComoBase : undefined });
  }
}
