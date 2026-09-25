import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { MainLayoutComponent } from './layouts/main-layout/main-layout';
import {
  adminGuard, authGuard, cambioPasswordGuard, gestionGuard, inicioGuard, personalGuard
} from './guards/auth-guard';

// Las pantallas se cargan bajo demanda para que el inicio sea rapido
export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Iniciar sesión · Control NGR' },
  {
    path: 'cambiar-password',
    loadComponent: () => import('./components/cambiar-password/cambiar-password').then(m => m.CambiarPasswordComponent),
    canActivate: [cambioPasswordGuard],
    title: 'Cambiar contraseña · Control NGR'
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [inicioGuard], children: [] },

      // Personal
      { path: 'dashboard', canActivate: [personalGuard], title: 'Inicio · Control NGR',
        loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent) },
      { path: 'perfil', canActivate: [personalGuard], title: 'Mi perfil · Control NGR',
        loadComponent: () => import('./components/perfil/perfil').then(m => m.PerfilComponent) },
      { path: 'saldos', canActivate: [personalGuard], title: 'Mis saldos · Control NGR',
        loadComponent: () => import('./components/saldos/saldos').then(m => m.SaldosComponent) },
      { path: 'solicitudes', canActivate: [personalGuard], title: 'Solicitudes · Control NGR',
        loadComponent: () => import('./components/solicitudes/solicitudes').then(m => m.SolicitudesComponent) },
      { path: 'eventos', canActivate: [personalGuard], title: 'Eventos · Control NGR',
        loadComponent: () => import('./components/eventos/eventos').then(m => m.EventosComponent) },
      { path: 'eventos/:id/estadisticas', canActivate: [personalGuard, gestionGuard], title: 'Resultados · Control NGR',
        loadComponent: () => import('./components/evento-estadisticas/evento-estadisticas').then(m => m.EventoEstadisticasComponent) },
      { path: 'horarios', title: 'Horarios · Control NGR',
        loadComponent: () => import('./components/horarios/horarios').then(m => m.HorariosComponent) },
      { path: 'organigrama', title: 'Organigrama · Control NGR',
        loadComponent: () => import('./components/organigrama/organigrama').then(m => m.OrganigramaComponent) },

      // Gestion
      { path: 'empleados', canActivate: [gestionGuard], title: 'Empleados · Control NGR',
        loadComponent: () => import('./components/empleados/empleados').then(m => m.EmpleadosComponent) },
      { path: 'reportes', canActivate: [personalGuard, gestionGuard], title: 'Reportes · Control NGR',
        loadComponent: () => import('./components/reportes/reportes').then(m => m.ReportesComponent) },

      // Panel maestro
      { path: 'admin', pathMatch: 'full', redirectTo: 'admin/saldos' },
      { path: 'admin/:seccion', canActivate: [adminGuard], title: 'Panel maestro · Control NGR',
        loadComponent: () => import('./components/admin/admin').then(m => m.AdminComponent) },
    ]
  },
  { path: '**', redirectTo: '' }
];
