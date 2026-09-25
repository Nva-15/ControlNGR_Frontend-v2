import { Component, Input } from '@angular/core';

/** Isotipo NGR + nombre del sistema. */
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <div class="flex items-center gap-3">
      <img src="logo-ngr.svg" alt="NGR" [style.width.px]="tamano" [style.height.px]="tamano" />
      @if (conTexto) {
        <div class="leading-tight">
          <p class="font-semibold tracking-tight" [class]="oscuro ? 'text-white' : 'text-stone-900'">Control NGR</p>
          <p class="text-xs" [class]="oscuro ? 'text-stone-400' : 'text-stone-500'">Gestión de personal</p>
        </div>
      }
    </div>
  `
})
export class LogoComponent {
  @Input() tamano = 36;
  @Input() conTexto = true;
  @Input() oscuro = false;
}
