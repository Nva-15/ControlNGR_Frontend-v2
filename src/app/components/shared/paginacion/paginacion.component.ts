import { Component, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';

/** Pie de una lista paginada en el servidor: "1–20 de 312" y Anterior / Siguiente. */
@Component({
  selector: 'app-paginacion',
  standalone: true,
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-2 text-xs text-stone-500" data-paginacion>
      <span>
        @if (total) { {{ desde }}–{{ hasta }} de {{ total }} {{ unidad }} } @else { Sin resultados }
      </span>
      @if (paginas > 1) {
        <div class="flex items-center gap-1">
          <button type="button" class="btn-ghost btn-sm" data-anterior [disabled]="pagina === 0 || cargando" (click)="ir(pagina - 1)">
            <i class="bi bi-chevron-left"></i> Anterior
          </button>
          <span class="px-2 tabular-nums">{{ pagina + 1 }} / {{ paginas }}</span>
          <button type="button" class="btn-ghost btn-sm" data-siguiente [disabled]="pagina >= paginas - 1 || cargando" (click)="ir(pagina + 1)">
            Siguiente <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      }
    </div>
  `
})
export class PaginacionComponent {
  @Input() total = 0;
  @Input() pagina = 0;
  @Input() tamano = 20;
  @Input() unidad = '';
  @Input() cargando = false;
  @Output() cambiar = new EventEmitter<number>();

  get paginas() { return Math.max(1, Math.ceil(this.total / this.tamano)); }
  get desde() { return this.total ? this.pagina * this.tamano + 1 : 0; }
  get hasta() { return Math.min(this.total, (this.pagina + 1) * this.tamano); }

  private el = inject(ElementRef<HTMLElement>);

  /** Cambia de página y vuelve al inicio de la lista. */
  ir(p: number) {
    if (p < 0 || p >= this.paginas) return;
    this.cambiar.emit(p);
    const lista = (this.el.nativeElement as HTMLElement).closest('.card, section') as HTMLElement | null;
    if (lista && lista.getBoundingClientRect().top < 0) lista.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}
