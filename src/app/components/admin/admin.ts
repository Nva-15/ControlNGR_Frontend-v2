import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AdminSaldosComponent } from './secciones/saldos';
import { AdminUsuariosComponent } from './secciones/usuarios';
import { AdminRedComponent } from './secciones/red';
import { AdminFeriadosComponent } from './secciones/feriados';
import { AdminDepartamentosComponent } from './secciones/departamentos';
import { AdminRolesComponent } from './secciones/roles';
import { AdminCatalogosComponent } from './secciones/catalogos';
import { AdminParametrosComponent } from './secciones/parametros';

const SECCIONES: Record<string, { titulo: string; descripcion: string }> = {
  saldos: { titulo: 'Saldos y carga inicial', descripcion: 'Días de vacaciones y de compensación que se deben a cada empleado.' },
  usuarios: { titulo: 'Usuarios y accesos', descripcion: 'Roles, activación y restablecimiento de contraseñas.' },
  red: { titulo: 'Segmentos de red', descripcion: 'Redes desde las que se permite marcar asistencia.' },
  feriados: { titulo: 'Feriados', descripcion: 'Feriados nacionales (sector privado). Trabajar un feriado abona días de compensación.' },
  departamentos: { titulo: 'Departamentos', descripcion: 'Áreas de la organización y sus responsables.' },
  roles: { titulo: 'Roles y aprobaciones', descripcion: 'Jerarquía de roles y quién aprueba las solicitudes de quién.' },
  catalogos: { titulo: 'Tipos de solicitud', descripcion: 'Tipos de solicitud y motivos de licencia.' },
  parametros: { titulo: 'Parámetros', descripcion: 'Valores que controlan las reglas del sistema.' },
};

/** Panel maestro del administrador del sistema. */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    AdminSaldosComponent, AdminUsuariosComponent, AdminRedComponent, AdminFeriadosComponent,
    AdminDepartamentosComponent, AdminRolesComponent, AdminCatalogosComponent, AdminParametrosComponent
  ],
  template: `
    <div class="page-header">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-vino-700">Panel maestro</p>
        <h1 class="page-title">{{ info().titulo }}</h1>
        <p class="page-subtitle">{{ info().descripcion }}</p>
      </div>
    </div>
    @switch (seccion()) {
      @case ('saldos') { <app-admin-saldos /> }
      @case ('usuarios') { <app-admin-usuarios /> }
      @case ('red') { <app-admin-red /> }
      @case ('feriados') { <app-admin-feriados /> }
      @case ('departamentos') { <app-admin-departamentos /> }
      @case ('roles') { <app-admin-roles /> }
      @case ('catalogos') { <app-admin-catalogos /> }
      @case ('parametros') { <app-admin-parametros /> }
      @default { <div class="card"><div class="empty-state">Sección no encontrada.</div></div> }
    }
  `
})
export class AdminComponent {
  private route = inject(ActivatedRoute);
  seccion = toSignal(this.route.paramMap.pipe(map(p => p.get('seccion') || 'saldos')), { initialValue: 'saldos' });
  info() {
    return SECCIONES[this.seccion()] || { titulo: 'Panel maestro', descripcion: '' };
  }
}
