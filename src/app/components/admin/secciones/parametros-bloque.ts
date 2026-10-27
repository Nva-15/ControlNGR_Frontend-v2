import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { Parametro } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

/** Un parámetro del sistema mostrado en la sección a la que pertenece. */
export interface CampoParametro {
  clave: string;
  titulo: string;
  ayuda: string;
  /** Números: unidad que se muestra al lado (min, horas, días, MB). */
  unidad?: string;
  min?: number;
  max?: number;
  /** Números con decimales (paso); sin esto solo se aceptan enteros. */
  paso?: number;
  /** Sí/No: textos de las dos opciones. */
  si?: string;
  no?: string;
}

/**
 * Parámetros de una sección del panel (antes todos estaban juntos en "Parámetros").
 * <app-admin-parametros-bloque [campos]="[...]" />
 */
@Component({
  selector: 'app-admin-parametros-bloque',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (cargado) {
      <div class="card divide-y divide-stone-100" [class.mt-6]="separado" data-parametros>
        @for (c of visibles; track c.clave) {
          <div class="p-5" [attr.data-parametro]="c.clave">
            <div class="grid items-center gap-4 md:grid-cols-[1fr_12rem_auto]">
              <div>
                <p class="font-medium text-stone-900">{{ c.titulo }}</p>
                <p class="text-xs text-stone-500">{{ c.ayuda }}</p>
              </div>
              @switch (tipo(c)) {
                @case ('BOOLEANO') {
                  <select class="select" [(ngModel)]="valores[c.clave]" [name]="c.clave">
                    <option value="true">{{ c.si || 'Sí' }}</option>
                    <option value="false">{{ c.no || 'No' }}</option>
                  </select>
                }
                @case ('FECHA') { <input type="date" class="input" [(ngModel)]="valores[c.clave]" [name]="c.clave" /> }
                @case ('HORA') { <input type="time" class="input" [(ngModel)]="valores[c.clave]" [name]="c.clave" /> }
                @default {
                  <div class="flex items-center gap-2">
                    <input type="number" class="input" [min]="c.min ?? 0" [max]="c.max ?? null" [step]="c.paso || 1"
                           [(ngModel)]="valores[c.clave]" [name]="c.clave" />
                    @if (c.unidad) { <span class="text-sm text-stone-500">{{ c.unidad }}</span> }
                  </div>
                }
              }
              <button class="btn-primary btn-sm" data-guardar
                      [disabled]="guardando === c.clave || !valido(c) || '' + valores[c.clave] === actuales[c.clave]"
                      (click)="guardar(c)">Guardar</button>
            </div>
            @if (!valido(c)) {
              <p class="field-error mt-2">
                @if (c.paso) { Ingrese un número entre {{ c.min }} y {{ c.max }}. } @else { Ingrese un número entero entre {{ c.min ?? 0 }} y {{ c.max }}. }
              </p>
            }
          </div>
        }
      </div>
    }
  `
})
export class AdminParametrosBloqueComponent implements OnInit {
  @Input({ required: true }) campos: CampoParametro[] = [];
  /** Margen superior cuando va debajo de otra tarjeta. */
  @Input() separado = true;
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  private parametros = new Map<string, Parametro>();
  valores: Record<string, string> = {};
  actuales: Record<string, string> = {};
  guardando: string | null = null;
  cargado = false;

  ngOnInit() {
    this.admin.parametros().subscribe({
      next: ps => {
        ps.forEach(p => this.parametros.set(p.clave, p));
        for (const c of this.campos) {
          const v = this.parametros.get(c.clave)?.valor ?? '';
          this.actuales[c.clave] = v;
          this.valores[c.clave] = v;
        }
        this.cargado = true;
      },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  /** Solo los que existen en el sistema. */
  get visibles() { return this.campos.filter(c => this.parametros.has(c.clave)); }

  tipo(c: CampoParametro) { return this.parametros.get(c.clave)?.tipoDato || 'TEXTO'; }

  valido(c: CampoParametro): boolean {
    if (this.tipo(c) !== 'NUMERO') return this.valores[c.clave] !== '';
    const v = this.valores[c.clave];
    const n = Number(v);
    if (v === '' || v === null || v === undefined || Number.isNaN(n)) return false;
    if (!c.paso && !Number.isInteger(n)) return false;
    return n >= (c.min ?? 0) && (c.max === undefined || n <= c.max);
  }

  guardar(c: CampoParametro) {
    if (!this.valido(c)) return;
    this.guardando = c.clave;
    const valor = this.tipo(c) === 'NUMERO' ? String(Number(this.valores[c.clave])) : String(this.valores[c.clave]);
    this.admin.actualizarParametro(c.clave, valor).subscribe({
      next: p => {
        this.guardando = null;
        this.actuales[c.clave] = p.valor;
        this.valores[c.clave] = p.valor;
        this.notification.success(`${c.titulo}: guardado.`);
      },
      error: e => { this.guardando = null; this.notification.error(mensajeError(e)); }
    });
  }
}
