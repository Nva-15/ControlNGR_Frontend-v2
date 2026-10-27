import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../shared/modal/modal.component';
import { TurnoSemanaPayload } from '../../services/horarios';
import { CONFIG_TURNOS_DEFECTO, ConfigTurnos, refrigerioSugerido, salidaSugerida, textoJornada } from '../../utils/turnos';

/** Un día que se puede marcar como laboral o descanso (o que está bloqueado por una solicitud). */
export interface DiaEditorTurno {
  /** Fecha AAAA-MM-DD (semana) o lunes...domingo (horario base). */
  clave: string;
  /** "Lun 26/10" o "Lunes". */
  etiqueta: string;
  /** Tipo de día actual: normal, descanso, vacaciones, permiso... */
  tipo: string;
  /** Días por solicitud aprobada: se muestran pero no se cambian. */
  bloqueado?: boolean;
  /** Texto del tipo actual cuando no es laboral ni descanso (p. ej. "Permiso"). */
  etiquetaTipo?: string;
}

export interface TurnoInicial {
  turno: 'manana' | 'tarde';
  horaEntrada: string;
  horaSalida: string;
  horaAlmuerzoInicio: string;
  horaAlmuerzoFin: string;
}

type Estado = 'normal' | 'descanso' | 'otro';

/**
 * Arma el turno de varios días a la vez: qué días trabaja y cuáles descansa, turno mañana/tarde y horas.
 * La salida (y el refrigerio del turno mañana) se calcula sola al cambiar la entrada o el turno, y se puede cambiar.
 */
@Component({
  selector: 'app-editor-turno',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal [abierto]="abierto" [titulo]="titulo" [subtitulo]="subtitulo" icono="bi-calendar-week"
               tamano="lg" [cerrarAlClicFuera]="false" (cerrar)="cerrar.emit()">
      <div class="space-y-5" data-editor-turno>
        <div>
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="label mb-0">Días que trabaja</p>
            <span class="text-xs text-stone-500">Clic para cambiar entre <b>trabaja</b> y <b>descansa</b></span>
          </div>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
            @for (d of dias; track d.clave) {
              <button type="button" class="flex h-16 flex-col items-center justify-center rounded-lg text-xs font-medium ring-1 ring-inset transition"
                      [attr.data-dia]="d.clave" [attr.data-estado]="d.bloqueado ? 'bloqueado' : estados[d.clave]"
                      [class]="claseDia(d)" [disabled]="d.bloqueado"
                      [title]="d.bloqueado ? 'Asignado por solicitud aprobada: no se cambia aquí' : ''"
                      (click)="alternar(d)">
                <span>{{ d.etiqueta }}</span>
                @if (d.bloqueado) {
                  <span class="mt-1 flex items-center gap-1"><i class="bi bi-lock-fill"></i>{{ d.etiquetaTipo }}</span>
                } @else if (estados[d.clave] === 'normal') {
                  <span class="mt-1"><i class="bi bi-briefcase"></i> Trabaja</span>
                } @else if (estados[d.clave] === 'descanso') {
                  <span class="mt-1"><i class="bi bi-moon-stars"></i> Descansa</span>
                } @else {
                  <span class="mt-1">{{ d.etiquetaTipo }}</span>
                }
              </button>
            }
          </div>
          @if (hayOtros) {
            <p class="field-help mt-2">Los días con otro tipo (permiso, vacaciones registradas a mano...) se mantienen si no los cambia.</p>
          }
        </div>

        @if (hayLaborales) {
          <div>
            <p class="label">Turno</p>
            <div class="inline-flex rounded-lg border border-stone-200 p-1">
              @for (t of turnos; track t.valor) {
                <button type="button" class="rounded-md px-4 py-1.5 text-sm" [attr.data-turno]="t.valor"
                        [class]="turno === t.valor ? 'bg-vino-700 text-white' : 'text-stone-600 hover:bg-stone-100'"
                        (click)="cambiarTurno(t.valor)">{{ t.texto }}</button>
              }
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="et-entrada">Entrada</label>
              <input id="et-entrada" type="time" class="input" [(ngModel)]="horaEntrada" (ngModelChange)="recalcular()" />
            </div>
            <div>
              <label class="label" for="et-salida">Salida</label>
              <input id="et-salida" type="time" class="input" [(ngModel)]="horaSalida" />
              <p class="field-help">Se calcula sola: entrada + {{ jornadaHoras }} h. Puede cambiarla.</p>
            </div>
            @if (turno === 'manana') {
              <div>
                <label class="label" for="et-alm-ini">Inicio de refrigerio</label>
                <input id="et-alm-ini" type="time" class="input" [(ngModel)]="horaAlmuerzoInicio" (ngModelChange)="ajustarFinRefrigerio()" />
              </div>
              <div>
                <label class="label" for="et-alm-fin">Fin de refrigerio</label>
                <input id="et-alm-fin" type="time" class="input" [(ngModel)]="horaAlmuerzoFin" />
              </div>
            }
          </div>
          @if (jornada) {
            <p class="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700" data-jornada>
              <i class="bi bi-clock"></i> Jornada: <b>{{ jornada }}</b>
            </p>
          }
          @if (horariosDistintos) {
            <p class="alert-info"><i class="bi bi-info-circle"></i> Estos días tenían horas distintas. Al guardar, todos los días que trabaja quedan con este turno; para un día diferente use "Editar solo un día".</p>
          }
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
  @Input() inicial: TurnoInicial | null = null;
  @Input() config: ConfigTurnos = CONFIG_TURNOS_DEFECTO;
  @Input() horariosDistintos = false;
  @Input() mostrarGuardarBase = false;
  @Input() guardarBaseInicial = false;
  @Input() guardando = false;
  @Input() textoGuardar = 'Guardar semana';
  /** Si se indica, muestra el enlace para editar un solo día (formulario de un día). */
  @Input() textoUnDia = '';
  @Output() guardar = new EventEmitter<TurnoSemanaPayload>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() editarUnDia = new EventEmitter<void>();

  readonly turnos: { valor: 'manana' | 'tarde'; texto: string }[] = [
    { valor: 'manana', texto: 'Mañana' },
    { valor: 'tarde', texto: 'Tarde' }
  ];

  estados: { [clave: string]: Estado } = {};
  turno: 'manana' | 'tarde' = 'manana';
  horaEntrada = '08:00';
  horaSalida = '';
  horaAlmuerzoInicio = '';
  horaAlmuerzoFin = '';
  guardarComoBase = false;

  ngOnChanges(cambios: SimpleChanges) {
    if (cambios['abierto'] && this.abierto) {
      this.iniciar();
    }
  }

  private iniciar() {
    this.estados = {};
    for (const d of this.dias) {
      this.estados[d.clave] = d.tipo === 'normal' || !d.tipo ? 'normal' : d.tipo === 'descanso' ? 'descanso' : 'otro';
    }
    this.guardarComoBase = this.guardarBaseInicial;
    const i = this.inicial;
    if (i?.horaEntrada) {
      this.turno = i.turno === 'tarde' ? 'tarde' : 'manana';
      this.horaEntrada = i.horaEntrada.substring(0, 5);
      this.horaSalida = (i.horaSalida || salidaSugerida(this.horaEntrada, this.turno, this.config)).substring(0, 5);
      const r = refrigerioSugerido(this.horaEntrada, this.config);
      this.horaAlmuerzoInicio = (i.horaAlmuerzoInicio || r.inicio).substring(0, 5);
      this.horaAlmuerzoFin = (i.horaAlmuerzoFin || r.fin).substring(0, 5);
    } else {
      this.turno = 'manana';
      this.horaEntrada = '08:00';
      this.recalcular();
    }
  }

  get hayLaborales(): boolean {
    return this.dias.some(d => !d.bloqueado && this.estados[d.clave] === 'normal');
  }

  get hayOtros(): boolean {
    return this.dias.some(d => !d.bloqueado && this.estados[d.clave] === 'otro');
  }

  get jornadaHoras(): number {
    return this.turno === 'tarde' ? this.config.jornadaTardeHoras : this.config.jornadaMananaHoras;
  }

  get jornada(): string {
    return textoJornada(this.horaEntrada, this.horaSalida, this.turno, this.horaAlmuerzoInicio, this.horaAlmuerzoFin);
  }

  get puedeGuardar(): boolean {
    const editables = this.dias.filter(d => !d.bloqueado && this.estados[d.clave] !== 'otro');
    if (!editables.length) return false;
    if (!this.hayLaborales) return true;
    if (!this.horaEntrada || !this.horaSalida || this.horaEntrada === this.horaSalida) return false;
    if (this.turno === 'manana' && !!this.horaAlmuerzoInicio !== !!this.horaAlmuerzoFin) return false;
    return true;
  }

  claseDia(d: DiaEditorTurno): string {
    if (d.bloqueado) return 'cursor-not-allowed bg-stone-100 text-stone-400 ring-stone-200';
    switch (this.estados[d.clave]) {
      case 'normal': return 'bg-vino-700 text-white ring-vino-700 hover:bg-vino-800';
      case 'descanso': return 'bg-stone-200 text-stone-700 ring-stone-300 hover:bg-stone-300';
      default: return 'bg-oro-100 text-oro-800 ring-oro-200 hover:bg-oro-200';
    }
  }

  alternar(d: DiaEditorTurno) {
    if (d.bloqueado) return;
    this.estados[d.clave] = this.estados[d.clave] === 'normal' ? 'descanso' : 'normal';
  }

  cambiarTurno(turno: 'manana' | 'tarde') {
    if (this.turno === turno) return;
    this.turno = turno;
    this.recalcular();
  }

  /** Al cambiar la entrada o el turno: salida = entrada + jornada; refrigerio = entrada + 4 h (turno mañana). */
  recalcular() {
    this.horaSalida = salidaSugerida(this.horaEntrada, this.turno, this.config);
    if (this.turno === 'manana') {
      const r = refrigerioSugerido(this.horaEntrada, this.config);
      this.horaAlmuerzoInicio = r.inicio;
      this.horaAlmuerzoFin = r.fin;
    }
  }

  /** Si mueve el inicio del refrigerio, el fin lo acompaña con la misma duración. */
  ajustarFinRefrigerio() {
    if (!this.horaAlmuerzoInicio) return;
    this.horaAlmuerzoFin = refrigerioSugerido(this.horaAlmuerzoInicio, { ...this.config, refrigerioDespuesHoras: 0 }).fin;
  }

  enviar() {
    if (!this.puedeGuardar) return;
    const dias: TurnoSemanaPayload['dias'] = {};
    for (const d of this.dias) {
      const e = this.estados[d.clave];
      if (!d.bloqueado && (e === 'normal' || e === 'descanso')) dias[d.clave] = e;
    }
    const laboral = this.hayLaborales;
    const manana = this.turno === 'manana';
    this.guardar.emit({
      turno: this.turno,
      horaEntrada: laboral ? this.horaEntrada : null,
      horaSalida: laboral ? this.horaSalida : null,
      horaAlmuerzoInicio: laboral && manana && this.horaAlmuerzoInicio ? this.horaAlmuerzoInicio : null,
      horaAlmuerzoFin: laboral && manana && this.horaAlmuerzoFin ? this.horaAlmuerzoFin : null,
      dias,
      guardarComoBase: this.mostrarGuardarBase ? this.guardarComoBase : undefined
    });
  }
}
