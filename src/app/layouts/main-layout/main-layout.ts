import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { Router, RouterLink, RouterOutlet, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../../services/auth';
import { NotificacionesService } from '../../services/notificaciones';
import { NotificacionResumen } from '../../interfaces/notificacion';
import { LogoComponent } from '../../components/shared/logo/logo.component';
import { AvatarComponent } from '../../components/shared/avatar/avatar.component';

interface ItemMenu {
  ruta: string;
  texto: string;
  icono: string;
  badge?: () => number;
}

interface GrupoMenu {
  titulo?: string;
  items: ItemMenu[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet, RouterLinkActive, LogoComponent, AvatarComponent],
  templateUrl: './main-layout.html'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private router = inject(Router);
  private notificacionesService = inject(NotificacionesService);

  menuMovilAbierto = false;
  menuUsuarioAbierto = false;
  resumen: NotificacionResumen | null = null;
  private subs: Subscription[] = [];
  private refreshInterval: any;

  usuario = this.auth.usuario;
  empleado = this.auth.empleado;
  nombre = computed(() => this.empleado()?.nombre || this.usuario()?.username || '');

  grupos: GrupoMenu[] = [];

  ngOnInit() {
    this.grupos = this.construirMenu();

    this.subs.push(this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.menuMovilAbierto = false;
      this.menuUsuarioAbierto = false;
    }));

    if (!this.auth.isAdmin()) {
      this.subs.push(this.notificacionesService.resumen$.subscribe(r => this.resumen = r));
      this.notificacionesService.cargarResumen().subscribe();
      this.refreshInterval = setInterval(() => this.notificacionesService.cargarResumen().subscribe(), 30000);
    }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private construirMenu(): GrupoMenu[] {
    if (this.auth.isAdmin()) {
      return [
        {
          titulo: 'Panel maestro',
          items: [
            { ruta: '/admin/saldos', texto: 'Saldos y carga inicial', icono: 'bi-wallet2' },
            { ruta: '/admin/usuarios', texto: 'Usuarios y accesos', icono: 'bi-person-lock' },
            { ruta: '/admin/red', texto: 'Segmentos de red', icono: 'bi-router' },
            { ruta: '/admin/feriados', texto: 'Feriados', icono: 'bi-calendar-heart' },
            { ruta: '/admin/departamentos', texto: 'Departamentos', icono: 'bi-building' },
            { ruta: '/admin/roles', texto: 'Roles y aprobaciones', icono: 'bi-diagram-2' },
            { ruta: '/admin/catalogos', texto: 'Tipos de solicitud', icono: 'bi-list-check' },
            { ruta: '/admin/parametros', texto: 'Parámetros', icono: 'bi-sliders' },
          ]
        },
        {
          titulo: 'Datos del sistema',
          items: [
            { ruta: '/empleados', texto: 'Empleados', icono: 'bi-people' },
            { ruta: '/horarios', texto: 'Horarios', icono: 'bi-calendar-week' },
            { ruta: '/organigrama', texto: 'Organigrama', icono: 'bi-diagram-3' },
          ]
        }
      ];
    }

    const grupos: GrupoMenu[] = [
      {
        items: [
          { ruta: '/dashboard', texto: 'Inicio', icono: 'bi-house' },
          { ruta: '/solicitudes', texto: 'Solicitudes', icono: 'bi-send-check', badge: () => this.badgeSolicitudes() },
          { ruta: '/saldos', texto: 'Mis saldos', icono: 'bi-wallet2' },
          { ruta: '/horarios', texto: 'Horarios', icono: 'bi-calendar-week' },
          { ruta: '/eventos', texto: 'Eventos', icono: 'bi-megaphone', badge: () => this.resumen?.eventosSinResponder || 0 },
          { ruta: '/organigrama', texto: 'Organigrama', icono: 'bi-diagram-3' },
        ]
      }
    ];
    if (this.auth.isGestion()) {
      grupos.push({
        titulo: 'Gestión',
        items: [
          { ruta: '/empleados', texto: 'Empleados', icono: 'bi-people' },
          { ruta: '/reportes', texto: 'Reportes de asistencia', icono: 'bi-bar-chart-line' },
        ]
      });
    }
    return grupos;
  }

  private badgeSolicitudes(): number {
    if (!this.resumen) return 0;
    return this.resumen.solicitudesPendientes || 0;
  }

  logout() {
    this.notificacionesService.limpiar();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
