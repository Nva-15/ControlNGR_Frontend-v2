import { Component, Input, inject } from '@angular/core';
import { ApiConfigService } from '../../../services/api-config.service';
import { fotoUrl, iniciales } from '../../../utils/format';

/** Foto de perfil con iniciales como respaldo (sin servicios externos). */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (url && !fallo) {
      <img [src]="url" [alt]="nombre" class="avatar" [style.width.px]="tamano" [style.height.px]="tamano" (error)="fallo = true" />
    } @else {
      <span class="avatar" [style.width.px]="tamano" [style.height.px]="tamano" [style.font-size.px]="tamano * 0.38">{{ ini }}</span>
    }
  `
})
export class AvatarComponent {
  private api = inject(ApiConfigService);
  @Input() nombre?: string | null = '';
  @Input() tamano = 36;
  @Input() set foto(valor: string | null | undefined) {
    this.url = fotoUrl(this.api.baseUrl, valor);
    this.fallo = false;
  }
  url: string | null = null;
  fallo = false;

  get ini() {
    return iniciales(this.nombre);
  }
}
