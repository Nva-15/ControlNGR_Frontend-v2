import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { LoginRequest } from '../../interfaces/auth';
import { LogoComponent } from '../shared/logo/logo.component';
import { mensajeError } from '../../utils/format';

@Component({
  selector: 'app-login',
  imports: [FormsModule, LogoComponent],
  templateUrl: './login.html'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  credentials: LoginRequest = { username: '', password: '' };
  isLoading = false;
  errorMessage = '';
  infoMessage = '';
  showPassword = false;
  anio = new Date().getFullYear();

  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      this.irAInicio();
      return;
    }
    if (this.route.snapshot.queryParamMap.get('expirada')) {
      this.infoMessage = 'Su sesión expiró. Ingrese nuevamente.';
    }
  }

  onSubmit() {
    if (!this.credentials.username || !this.credentials.password) return;
    this.isLoading = true;
    this.errorMessage = '';
    this.infoMessage = '';

    this.authService.login(this.credentials).subscribe({
      next: () => {
        this.isLoading = false;
        this.irAInicio();
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.status === 0
          ? 'No se pudo conectar con el servidor.'
          : mensajeError(error, 'Credenciales inválidas.');
      }
    });
  }

  private irAInicio() {
    if (this.authService.debeCambiarPassword()) {
      this.router.navigate(['/cambiar-password']);
    } else {
      this.router.navigate([this.authService.isAdmin() ? '/admin' : '/dashboard']);
    }
  }
}
