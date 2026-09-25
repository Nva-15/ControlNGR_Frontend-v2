import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';
import { LogoComponent } from '../shared/logo/logo.component';
import { mensajeError } from '../../utils/format';

/** Cambio obligatorio de contraseña (primer ingreso o contraseña restablecida). */
@Component({
  selector: 'app-cambiar-password',
  imports: [FormsModule, LogoComponent],
  templateUrl: './cambiar-password.html'
})
export class CambiarPasswordComponent {
  auth = inject(AuthService);
  router = inject(Router);
  private notification = inject(NotificationService);

  actual = '';
  nueva = '';
  confirmar = '';
  mostrar = false;
  guardando = false;
  error = '';

  get usuario() { return this.auth.usuario(); }
  get nombre() { return this.auth.empleado()?.nombre || this.usuario?.username || ''; }
  get obligatorio() { return this.auth.debeCambiarPassword(); }

  get reglas() {
    return [
      { ok: this.nueva.length >= 8, texto: 'Al menos 8 caracteres' },
      { ok: /[A-Za-z]/.test(this.nueva), texto: 'Contiene letras' },
      { ok: /\d/.test(this.nueva), texto: 'Contiene números' },
      { ok: !!this.nueva && this.nueva !== this.actual, texto: 'Distinta a la actual' },
      { ok: !!this.nueva && this.nueva === this.confirmar, texto: 'Las contraseñas coinciden' },
    ];
  }

  get valido() {
    return !!this.actual && this.reglas.every(r => r.ok);
  }

  guardar() {
    if (!this.valido || this.guardando) return;
    this.guardando = true;
    this.error = '';
    this.auth.cambiarPassword(this.actual, this.nueva, this.confirmar).subscribe({
      next: () => {
        this.guardando = false;
        this.notification.success('Su contraseña fue actualizada.', 'Listo');
        this.router.navigate([this.auth.isAdmin() ? '/admin' : '/dashboard']);
      },
      error: (e) => {
        this.guardando = false;
        this.error = mensajeError(e, 'No se pudo cambiar la contraseña');
      }
    });
  }

  salir() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
