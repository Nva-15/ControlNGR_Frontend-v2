import { Injectable, signal } from '@angular/core';

/** Modo claro / oscuro. La clase inicial la aplica public/tema.js antes de pintar la página. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly oscuro = signal(document.documentElement.classList.contains('dark'));

  alternar(): void {
    const oscuro = !this.oscuro();
    this.oscuro.set(oscuro);
    document.documentElement.classList.toggle('dark', oscuro);
    try { localStorage.setItem('tema', oscuro ? 'oscuro' : 'claro'); } catch { /* sin almacenamiento */ }
  }
}
