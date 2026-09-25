import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';

/**
 * Agrega el token a las llamadas de la API y reacciona a:
 *  - 401: sesion vencida o invalida -> login
 *  - 403 con debeCambiarPassword -> pantalla de cambio de contraseña
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const esApi = req.url.includes('/api/');
  const esLogin = req.url.endsWith('/auth/login');

  const peticion = token && esApi && !esLogin
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      if (esApi && !esLogin) {
        if (error.status === 401) {
          auth.logout();
          router.navigate(['/login'], { queryParams: { expirada: 1 } });
        } else if (error.status === 403 && error.error?.debeCambiarPassword) {
          router.navigate(['/cambiar-password']);
        }
      }
      return throwError(() => error);
    })
  );
};
