import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Ventana modal reutilizable.
 * <app-modal [abierto]="x" titulo="..." (cerrar)="x=false"> contenido <div footer>botones</div> </app-modal>
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (abierto) {
      <div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <div class="fixed inset-0 bg-stone-950/50 backdrop-blur-[2px]" (click)="cerrarSiPermite()"></div>
        <div class="relative my-8 w-full rounded-2xl bg-white shadow-2xl" [class]="anchos[tamano]" role="dialog" aria-modal="true">
          <div class="flex items-start justify-between gap-4 border-b border-stone-100 px-6 py-4">
            <div class="min-w-0">
              <h3 class="flex items-center gap-2 text-base font-semibold text-stone-900">
                @if (icono) { <i class="bi text-vino-700" [class]="icono"></i> }
                {{ titulo }}
              </h3>
              @if (subtitulo) { <p class="mt-0.5 text-xs text-stone-500">{{ subtitulo }}</p> }
            </div>
            <button type="button" class="btn-icon" (click)="cerrar.emit()" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="max-h-[70vh] overflow-y-auto px-6 py-5">
            <ng-content></ng-content>
          </div>
          <div class="flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-stone-100 bg-stone-50 px-6 py-4 empty:hidden">
            <ng-content select="[footer]"></ng-content>
          </div>
        </div>
      </div>
    }
  `
})
export class ModalComponent {
  @Input() abierto = false;
  @Input() titulo = '';
  @Input() subtitulo = '';
  @Input() icono = '';
  @Input() tamano: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  /** Si es false, hacer clic fuera no cierra (formularios largos). */
  @Input() cerrarAlClicFuera = true;
  @Output() cerrar = new EventEmitter<void>();

  anchos = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  cerrarSiPermite() {
    if (this.cerrarAlClicFuera) this.cerrar.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.abierto) this.cerrar.emit();
  }
}
