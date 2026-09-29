import { Component, inject } from '@angular/core';
import { TemaService } from '../../../services/tema';

@Component({
  selector: 'app-boton-tema',
  standalone: true,
  template: `
    <button type="button" class="btn-icon" (click)="tema.alternar()"
            [attr.aria-label]="tema.oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
            [title]="tema.oscuro() ? 'Modo claro' : 'Modo oscuro'">
      <i class="bi text-lg" [class]="tema.oscuro() ? 'bi-sun' : 'bi-moon-stars'"></i>
    </button>
  `
})
export class BotonTemaComponent {
  tema = inject(TemaService);
}
