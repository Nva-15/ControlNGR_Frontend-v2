import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth';

/** Requiere sesion y que ya se haya cambiado la contraseña inicial. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (auth.debeCambiarPassword()) return router.createUrlTree(['/cambiar-password']);
  return true;
};

/** Solo para el usuario que debe cambiar su contraseña. */
export const cambioPasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return true;
};

/** Pantallas del personal (el admin del sistema va a su panel). */
export const personalGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? router.createUrlTree(['/admin']) : true;
};

/** Panel maestro: solo rol admin. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() ? true : router.createUrlTree(['/dashboard']);
};

/** Pantallas de gestion (gerencia, supervisores, gestor) y admin. */
export const gestionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAdmin() || auth.isGestion() ? true : router.createUrlTree(['/dashboard']);
};

/** Pagina inicial segun el rol. */
export const inicioGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  return router.createUrlTree([auth.isAdmin() ? '/admin' : '/dashboard']);
};
