import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../shared/modal/modal.component';
import { DiaTurnoPayload, TurnoSemanaPayload } from '../../services/horarios';
import { FuncionTurno } from '../../interfaces/horario';
import {
  CONFIG_TURNOS_DEFECTO, ConfigTurnos, entradaSugerida, refrigerioSugerido, salidaSugerida, textoJornada
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
}

type Estado = 'normal' | 'descanso' | 'otro';
type Turno = 'manana' | 'tarde';

interface Fila {
  dia: DiaEditorTurno;
  marcado: boolean;
  estado: Estado;
  turno: Turno;
  entrada: string;
  salida: string;
  almInicio: string;
  almFin: string;
  funciones: string[];
}

/**
 * Turnos de varios días de una persona: cada día con su propio turno (mañana/tarde), horas y funciones,
 * o de descanso. Marcando varios días se les aplica el mismo turno de una vez. La salida se calcula sola
 * (entrada + jornada) y se puede cambiar. Solo se permite un día de descanso.
 */
@Component({
  selector: 'app-editor-turno',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal [abierto]="abierto" [titulo]="titulo" [subtitulo]="subtitulo" icono="bi-calendar-week"
               tamano="xl" [cerrarAlClicFuera]="false" (cerrar)="cerrar.emit()">
      <div class="space-y-4" data-editor-turno>
        <!-- Barra para los días marcados -->
        <div class="rounded-xl border border-stone-200 bg-stone-50 p-3" data-barra-marcados>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
            <label class="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" class="checkbox" [checked]="todosMarcados" [indeterminate]="algunoMarcado && !todosMarcados"
                     (change)="marcarTodos($any($event.target).checked)" data-marcar-todos />
              {{ marcados.length ? marcados.length + ' día(s) marcado(s)' : 'Marque días para darles el mismo turno' }}
            </label>
            @if (marcados.length) {
              <div class="inline-flex rounded-lg border border-stone-200 bg-superficie p-0.5">
                @for (t of turnos; track t.valor) {
                  <button type="button" class="rounded-md px-3 py-1 text-sm" [attr.data-masivo-turno]="t.valor"
                          [class]="masivo.turno === t.valor ? 'bg-vino-700 text-white' : 'text-stone-600 hover:bg-stone-100'"
                          (click)="masivoTurno(t.valor)">{{ t.texto }}</button>
                }
              </div>
              <div class="flex items-center gap-1 text-sm">
                <input type="time" class="input w-32 py-1!" [(ngModel)]="masivo.entrada" (ngModelChange)="masivo.salida = salidaDe(masivo.entrada, masivo.turno)" aria-label="Entrada" data-masivo-entrada />
                <span class="text-stone-400">→</span>
                <input type="time" class="input w-32 py-1!" [(ngModel)]="masivo.salida" aria-label="Salida" data-masivo-salida />
              </div>
              <div class="flex flex-wrap gap-1">
                @for (f of funcionesActivas; track f.codigo) {
                  <button type="button" class="rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset" [title]="f.nombre"
                          [class]="masivo.funciones.includes(f.codigo) ? 'bg-sky-700 text-white ring-sky-700' : 'text-stone-600 ring-stone-300 hover:bg-stone-100'"
                          (click)="alternarFuncion(masivo.funciones, f.codigo)">{{ f.codigo }}</button>
                }
              </div>
              <div class="ml-auto flex gap-2">
                <button type="button" class="btn-primary btn-sm" (click)="aplicarMarcados()" [disabled]="!masivo.entrada || !masivo.salida" data-aplicar-marcados>
                  Aplicar a {{ marcados.length }}
                </button>
                <button type="button" class="btn-secondary btn-sm" (click)="descansoMarcados()" data-descanso-marcados>
                  <i class="bi bi-moon-stars"></i> Descanso
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Un renglón por día -->
        <div class="divide-y divide-stone-100 rounded-xl border border-stone-200">
          @for (f of filas; track f.dia.clave) {
            <div class="p-3" [attr.data-fila]="f.dia.clave" [attr.data-estado]="f.dia.bloqueado ? 'bloqueado' : f.estado"
                 [class.bg-stone-50]="f.dia.bloqueado">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <input type="checkbox" class="checkbox" [(ngModel)]="f.marcado" [disabled]="!!f.dia.bloqueado" [attr.aria-label]="'Marcar ' + f.dia.etiqueta" data-marcar />
                <span class="w-20 text-sm font-semibold text-stone-800">{{ f.dia.etiqueta }}</span>

                @if (f.dia.bloqueado) {
                  <span class="badge-gray"><i class="bi bi-lock-fill"></i> {{ f.dia.etiquetaTipo }} · por solicitud aprobada</span>
                } @else {
                  <div class="inline-flex rounded-lg border border-stone-200 p-0.5">
                    <button type="button" class="rounded-md px-2.5 py-1 text-xs" data-trabaja
                            [class]="f.estado === 'normal' ? 'bg-vino-700 text-white' : 'text-stone-600 hover:bg-stone-100'"
                            (click)="trabaja(f)"><i class="bi bi-briefcase"></i> Trabaja</button>
                    <button type="button" class="rounded-md px-2.5 py-1 text-xs" data-descansa
                            [class]="f.estado === 'descanso' ? 'bg-stone-600 text-white' : 'text-stone-600 hover:bg-stone-100'"
                            (click)="f.estado = 'descanso'"><i class="bi bi-moon-stars"></i> Descansa</button>
                  </div>

                  @if (f.estado === 'normal') {
                    <div class="inline-flex rounded-lg border border-stone-200 p-0.5">
                      @for (t of turnos; track t.valor) {
                        <button type="button" class="rounded-md px-2.5 py-1 text-xs" [attr.data-turno]="t.valor"
                                [class]="f.turno === t.valor ? 'bg-vino-100 font-semibold text-vino-800' : 'text-stone-600 hover:bg-stone-100'"
                                (click)="cambiarTurno(f, t.valor)">{{ t.texto }}</button>
                      }
                    </div>
                    <div class="flex items-center gap-1">
                      <input type="time" class="input w-30 py-1!" [(ngModel)]="f.entrada" (ngModelChange)="recalcular(f)" [attr.aria-label]="'Entrada ' + f.dia.etiqueta" data-entrada />
                      <span class="text-stone-400">→</span>
                      <input type="time" class="input w-30 py-1!" [(ngModel)]="f.salida" [attr.aria-label]="'Salida ' + f.dia.etiqueta" data-salida />
                    </div>
                    <div class="flex flex-wrap gap-1" data-funciones>
                      @for (fn of funcionesDe(f); track fn.codigo) {
                        <button type="button" class="rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset" [title]="fn.nombre"
                                [attr.data-funcion]="fn.codigo"
                                [class]="f.funciones.includes(fn.codigo) ? 'bg-sky-700 text-white ring-sky-700' : 'text-stone-500 ring-stone-300 hover:bg-stone-100'"
                                (click)="alternarFuncion(f.funciones, fn.codigo)">{{ fn.codigo }}</button>
                      }
                    </div>
                  } @else if (f.estado === 'otro') {
                    <span class="badge-oro">{{ f.dia.etiquetaTipo }}</span>
                    <span class="text-xs text-stone-500">se mantiene si no lo cambia</span>
                  }
                }
              </div>
              @if (!f.dia.bloqueado && f.estado === 'normal') {
                <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs text-stone-500">
                  @if (f.turno === 'manana') {
                    <span class="flex items-center gap-1">Refrigerio
                      <input type="time" class="input w-28 px-2! py-0.5! text-xs" [(ngModel)]="f.almInicio" (ngModelChange)="moverRefrigerio(f)" [attr.aria-label]="'Inicio de refrigerio ' + f.dia.etiqueta" data-alm-ini />
                      –
                      <input type="time" class="input w-28 px-2! py-0.5! text-xs" [(ngModel)]="f.almFin" [attr.aria-label]="'Fin de refrigerio ' + f.dia.etiqueta" data-alm-fin />
                    </span>
                  }
                  <span data-jornada>{{ jornada(f) }}</span>
                </div>
              }
            </div>
          }
        </div>

        @if (descansos > config.maxDescansos) {
          <p class="alert-danger" data-error-descansos><i class="bi bi-exclamation-triangle"></i>
            Solo se permite {{ config.maxDescansos }} día de descanso por semana; hay {{ descansos }}. Cambie alguno a "Trabaja".</p>
        }

        @if (mostrarGuardarBase) {
          <label class="flex items-start gap-2 rounded-lg border border-stone-200 p-3 text-sm">
            <input type="checkbox" class="checkbox mt-0.5" [(ngModel)]="guardarComoBase" data-guardar-base />
            <span><b>Guardar también como horario base</b><br>
              <span class="text-xs text-stone-500">Se usa para los colaboradores nuevos en semanas futuras y para completar días sin horario.</span></span>
          </label>
        }
      </div>

      <div footer class="flex w-full flex-wrap items-center gap-2">
        @if (textoUnDia) {
          <button type="button" class="btn-ghost btn-sm mr-auto" (click)="editarUnDia.emit()" data-editar-un-dia>
            <i class="bi bi-pencil"></i> {{ textoUnDia }}
          </button>
        }
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
  @Input() config: ConfigTurnos = CONFIG_TURNOS_DEFECTO;
  @Input() funciones: FuncionTurno[] = [];
  @Input() mostrarGuardarBase = false;
  @Input() guardarBaseInicial = false;
  @Input() guardando = false;
  @Input() textoGuardar = 'Guardar semana';
  /** Si se indica, muestra el enlace para editar un solo día (formulario de un día). */
  @Input() textoUnDia = '';
  /** Días que se abren ya marcados (p. ej. el día en que se hizo clic). */
  @Input() marcadosIniciales: string[] = [];
  @Output() guardar = new EventEmitter<TurnoSemanaPayload>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() editarUnDia = new EventEmitter<void>();

  readonly turnos: { valor: Turno; texto: string }[] = [
    { valor: 'manana', texto: 'Mañana' },
    { valor: 'tarde', texto: 'Tarde' }
  ];

  filas: Fila[] = [];
  masivo = { turno: 'manana' as Turno, entrada: '', salida: '', funciones: [] as string[] };
  guardarComoBase = false;

  ngOnChanges(cambios: SimpleChanges) {
    if (cambios['abierto'] && this.abierto) this.iniciar();
  }

  private iniciar() {
    this.filas = this.dias.map(d => this.filaDe(d));
    this.guardarComoBase = this.guardarBaseInicial;
    const referencia = this.filas.find(f => this.marcadosIniciales.includes(f.dia.clave) && f.estado === 'normal')
      ?? this.filas.find(f => f.estado === 'normal' && !f.dia.bloqueado);
    this.masivo = referencia
      ? { turno: referencia.turno, entrada: referencia.entrada, salida: referencia.salida, funciones: [...referencia.funciones] }
      : { turno: 'manana', entrada: this.config.entradaMananaSugerida, salida: this.salidaDe(this.config.entradaMananaSugerida, 'manana'), funciones: [] };
  }

  private filaDe(d: DiaEditorTurno): Fila {
    const estado: Estado = !d.tipo || d.tipo === 'normal' ? 'normal' : d.tipo === 'descanso' ? 'descanso' : 'otro';
    const turno: Turno = d.turno === 'tarde' ? 'tarde' : 'manana';
    const fila: Fila = {
      dia: d, marcado: !d.bloqueado && this.marcadosIniciales.includes(d.clave), estado, turno,
      entrada: (d.horaEntrada || '').substring(0, 5), salida: (d.horaSalida || '').substring(0, 5),
      almInicio: (d.horaAlmuerzoInicio || '').substring(0, 5), almFin: (d.horaAlmuerzoFin || '').substring(0, 5),
      funciones: [...(d.funciones || [])]
    };
    // Día laboral aún sin horas (sin horario base): se propone el turno sugerido
    if (!fila.entrada) this.sugerir(fila, turno);
    else if (turno === 'manana' && !fila.almInicio) this.refrigerio(fila);
    return fila;
  }

  get funcionesActivas(): FuncionTurno[] {
    return this.funciones.filter(f => f.activo);
  }

  /** Activas más las inactivas que el día ya tenía (para poder quitarlas). */
  funcionesDe(f: Fila): FuncionTurno[] {
    return this.funciones.filter(fn => fn.activo || f.funciones.includes(fn.codigo));
  }

  get marcados(): Fila[] { return this.filas.filter(f => f.marcado); }
  get algunoMarcado(): boolean { return this.marcados.length > 0; }
  get todosMarcados(): boolean {
    const editables = this.filas.filter(f => !f.dia.bloqueado);
    return editables.length > 0 && editables.every(f => f.marcado);
  }

  get descansos(): number {
    return this.filas.filter(f => !f.dia.bloqueado && f.estado === 'descanso').length;
  }

  get puedeGuardar(): boolean {
    if (this.descansos > this.config.maxDescansos) return false;
    const editables = this.filas.filter(f => !f.dia.bloqueado && f.estado !== 'otro');
    if (!editables.length) return false;
    return editables.every(f => f.estado === 'descanso'
      || (!!f.entrada && !!f.salida && f.entrada !== f.salida && (f.turno === 'tarde' || !!f.almInicio === !!f.almFin)));
  }

  marcarTodos(valor: boolean) {
    this.filas.forEach(f => { if (!f.dia.bloqueado) f.marcado = valor; });
  }

  salidaDe(entrada: string, turno: Turno): string {
    return salidaSugerida(entrada, turno, this.config);
  }

  jornada(f: Fila): string {
    return textoJornada(f.entrada, f.salida, f.turno, f.almInicio, f.almFin);
  }

  trabaja(f: Fila) {
    if (f.estado !== 'normal') {
      f.estado = 'normal';
      if (!f.entrada) this.sugerir(f, f.turno);
    }
  }

  /** Al cambiar de turno se propone su entrada habitual (mañana 08:30, tarde 17:00) y se recalcula la salida. */
  cambiarTurno(f: Fila, turno: Turno) {
    if (f.turno === turno) return;
    this.sugerir(f, turno);
  }

  masivoTurno(turno: Turno) {
    if (this.masivo.turno === turno) return;
    this.masivo.turno = turno;
    this.masivo.entrada = entradaSugerida(turno, this.config);
    this.masivo.salida = this.salidaDe(this.masivo.entrada, turno);
  }

  private sugerir(f: Fila, turno: Turno) {
    f.turno = turno;
    f.entrada = entradaSugerida(turno, this.config);
    this.recalcular(f);
  }

  /** Salida = entrada + jornada del turno; refrigerio del turno mañana 4 h después de la entrada. */
  recalcular(f: Fila) {
    f.salida = this.salidaDe(f.entrada, f.turno);
    this.refrigerio(f);
  }

  private refrigerio(f: Fila) {
    if (f.turno === 'manana') {
      const r = refrigerioSugerido(f.entrada, this.config);
      f.almInicio = r.inicio;
      f.almFin = r.fin;
    } else {
      f.almInicio = '';
      f.almFin = '';
    }
  }

  /** Si mueve el inicio del refrigerio, el fin lo acompaña con la misma duración. */
  moverRefrigerio(f: Fila) {
    if (f.almInicio) f.almFin = refrigerioSugerido(f.almInicio, { ...this.config, refrigerioDespuesHoras: 0 }).fin;
  }

  alternarFuncion(lista: string[], codigo: string) {
    const i = lista.indexOf(codigo);
    if (i >= 0) lista.splice(i, 1); else lista.push(codigo);
  }

  aplicarMarcados() {
    for (const f of this.marcados) {
      f.estado = 'normal';
      f.turno = this.masivo.turno;
      f.entrada = this.masivo.entrada;
      f.salida = this.masivo.salida;
      f.funciones = [...this.masivo.funciones];
      this.refrigerio(f);
      f.marcado = false;
    }
  }

  descansoMarcados() {
    for (const f of this.marcados) {
      f.estado = 'descanso';
      f.marcado = false;
    }
  }

  enviar() {
    if (!this.puedeGuardar) return;
    const dias: DiaTurnoPayload[] = this.filas
      .filter(f => !f.dia.bloqueado && f.estado !== 'otro')
      .map(f => f.estado === 'descanso'
        ? { clave: f.dia.clave, tipoDia: 'descanso', turno: null, horaEntrada: null, horaSalida: null,
            horaAlmuerzoInicio: null, horaAlmuerzoFin: null, funciones: [] }
        : { clave: f.dia.clave, tipoDia: 'normal', turno: f.turno, horaEntrada: f.entrada, horaSalida: f.salida,
            horaAlmuerzoInicio: f.turno === 'manana' && f.almInicio ? f.almInicio : null,
            horaAlmuerzoFin: f.turno === 'manana' && f.almFin ? f.almFin : null,
            funciones: [...f.funciones] });
    this.guardar.emit({ dias, guardarComoBase: this.mostrarGuardarBase ? this.guardarComoBase : undefined });
  }
}
