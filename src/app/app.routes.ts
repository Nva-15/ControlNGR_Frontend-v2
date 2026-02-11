import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { SolicitudesComponent } from './components/solicitudes/solicitudes';
import { authGuard } from './guards/auth-guard';
import { MainLayoutComponent } from './layouts/main-layout/main-layout';
import { EmpleadosComponent } from './components/empleados/empleados';
import { OrganigramaComponent } from './components/organigrama/organigrama';
import { HorariosComponent } from './components/horarios/horarios';
import { ReportesComponent } from './components/reportes/reportes';
import { EventosComponent } from './components/eventos/eventos';
import { EventoEstadisticasComponent } from './components/evento-estadisticas/evento-estadisticas';

export const routes: Routes = [
  { 
    path: 'login', 
    component: LoginComponent, 
    title: 'Login - Control NGR' 
  },
  { 
    path: '', 
    redirectTo: 'dashboard', 
    pathMatch: 'full' 
  },
  { 
    path: 'dashboard', 
    component: DashboardComponent, 
    title: 'Dashboard - Control NGR'
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [      
      { 
        path: 'solicitudes', 
        component: SolicitudesComponent, 
        title: 'Solicitudes - Control NGR'
      },
      { 
        path: 'empleados', 
        component: EmpleadosComponent, 
        title: 'Gestión de Empleados'
      },
      {
        path: 'organigrama',
        component: OrganigramaComponent,
        title: 'Organigrama'
      },
      {
        path: 'horarios',
        component: HorariosComponent,
        title: 'Gestion de Horarios'
      },
      {
        path: 'reportes',
        component: ReportesComponent,
        title: 'Reportes de Asistencia'
      },
      {
        path: 'eventos',
        component: EventosComponent,
        title: 'Gestion de Eventos'
      },
      {
        path: 'eventos/:id/estadisticas',
        component: EventoEstadisticasComponent,
        title: 'Estadisticas del Evento'
      },
    ]
  },
  { 
    path: '**', 
    redirectTo: '/login' 
  }
];