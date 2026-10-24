import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Menú de acciones de una fila. Se abre flotando (position fixed) para que la tabla no lo recorte.
 * <app-menu-acciones etiqueta="Gestionar"> <button class="menu-item" (click)="...">...</button> </app-menu-acciones>
 */
@Component({
  selector: 'app-menu-acciones',
  standalone: true,
  template: `
    <button type="button" [class]="etiqueta ? 'btn-secondary btn-sm' : 'btn-icon'" [attr.aria-label]="etiqueta || 'Más acciones'"
            [title]="etiqueta || 'Más acciones'" aria-haspopup="menu" [attr.aria-expanded]="abierto" (click)="alternar($event)" data-menu>
      @if (etiqueta) { {{ etiqueta }} <i class="bi bi-chevron-down text-xs"></i> } @else { <i class="bi bi-three-dots"></i> }
    </button>
    @if (abierto) {
      <div role="menu" class="fixed z-50 min-w-52 overflow-hidden rounded-xl border border-stone-200 bg-superficie py-1 text-left shadow-lg"
           [style.top.px]="arriba" [style.bottom.px]="abajo" [style.right.px]="derecha" (click)="abierto = false">
        <ng-content></ng-content>
      </div>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    :host ::ng-deep .menu-item { display: flex; width: 100%; align-items: center; gap: .6rem; padding: .5rem .9rem; font-size: .875rem; color: var(--color-stone-700); }
    :host ::ng-deep .menu-item:hover { background: var(--color-stone-50); }
    :host ::ng-deep .menu-item.peligro { color: var(--color-red-700); }
    :host ::ng-deep .menu-item i { color: var(--color-stone-400); }
    :host ::ng-deep .menu-item.peligro i { color: var(--color-red-500); }
  `]
})
export class MenuAccionesComponent implements OnInit, OnDestroy {
  @Input() etiqueta = '';
  private el = inject(ElementRef<HTMLElement>);
  abierto = false;
  arriba: number | null = null;
  abajo: number | null = null;
  derecha = 0;

  alternar(evento: MouseEvent) {
    evento.stopPropagation();
    if (this.abierto) { this.abierto = false; return; }
    const r = (evento.currentTarget as HTMLElement).getBoundingClientRect();
    this.derecha = Math.max(8, window.innerWidth - r.right);
    // Si no cabe debajo, se abre hacia arriba
    const cabeDebajo = window.innerHeight - r.bottom > 240;
    this.arriba = cabeDebajo ? r.bottom + 4 : null;
    this.abajo = cabeDebajo ? null : window.innerHeight - r.top + 4;
    this.abierto = true;
    this.abiertoEn = performance.now();
  }

  @HostListener('document:click', ['$event'])
  fuera(evento: MouseEvent) {
    if (this.abierto && !this.el.nativeElement.contains(evento.target as Node)) this.abierto = false;
  }

  // Cualquier scroll (de la pagina o de una tabla) cierra el menu, que esta fijo en pantalla
  // (se ignora el scroll de los primeros instantes: el que lleva el boton a la vista al hacer clic)
  private abiertoEn = 0;
  private alDesplazar = () => { if (this.abierto && performance.now() - this.abiertoEn > 300) this.abierto = false; };
  ngOnInit() { document.addEventListener('scroll', this.alDesplazar, true); }
  ngOnDestroy() { document.removeEventListener('scroll', this.alDesplazar, true); }

  @HostListener('window:resize')
  @HostListener('document:keydown.escape')
  cerrar() { this.abierto = false; }
}
