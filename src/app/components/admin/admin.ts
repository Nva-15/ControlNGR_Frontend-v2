import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AdminSaldosComponent } from './secciones/saldos';
import { AdminRedComponent } from './secciones/red';
import { AdminFeriadosComponent } from './secciones/feriados';
import { AdminDepartamentosComponent } from './secciones/departamentos';
import { AdminRolesComponent } from './secciones/roles';
import { AdminCatalogosComponent } from './secciones/catalogos';
import { AdminFacialComponent } from './secciones/facial';
import { AdminAsistenciaComponent } from './secciones/asistencia';
import { AdminRespaldosComponent } from './secciones/respaldos';
import { AdminTurnosComponent } from './secciones/turnos';
import { AdminAprobacionComponent } from './secciones/aprobacion';

const SECCIONES: Record<string, { titulo: string; descripcion: string }> = {
  saldos: { titulo: 'Saldos y carga inicial', descripcion: 'Días de vacaciones y de compensación que se deben a cada empleado.' },
  facial: { titulo: 'Reconocimiento facial', descripcion: 'Modo de marcación por equipo (cámara o botón), rostros registrados y pruebas sin afectar la asistencia.' },
  asistencia: { titulo: 'Reglas de marcación', descripcion: 'Tolerancia de tardanza, anticipación para marcar la entrada y salida automática.' },
  turnos: { titulo: 'Turnos y funciones', descripcion: 'Funciones que cumple el personal en su turno (LT, SP...), jornada de cada turno y entradas sugeridas al armar horarios.' },
  red: { titulo: 'Segmentos de red', descripcion: 'Redes desde las que se permite marcar asistencia.' },
  feriados: { titulo: 'Feriados', descripcion: 'Feriados nacionales (sector privado). Trabajar un feriado abona días de compensación.' },
  departamentos: { titulo: 'Departamentos', descripcion: 'Áreas de la organización y sus responsables.' },
  roles: { titulo: 'Roles y aprobaciones', descripcion: 'Jerarquía de roles, quién registra solicitudes, quién marca asistencia y con horario, y quién aprueba a quién.' },
  aprobacion: { titulo: 'Aprobación automática', descripcion: 'Compensaciones que se aprueban solas por equipo: cupos, cobertura mínima y antelación.' },
  catalogos: { titulo: 'Tipos de solicitud', descripcion: 'Tipos de solicitud y motivos de licencia.' },
  respaldos: { titulo: 'Respaldos', descripcion: 'Copias de seguridad de la base de datos: automáticas (diarias, semanales o mensuales) o en el momento.' },
};

/** Panel maestro del administrador del sistema. */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    AdminSaldosComponent, AdminRedComponent, AdminFeriadosComponent,
    AdminDepartamentosComponent, AdminRolesComponent, AdminCatalogosComponent,
    AdminFacialComponent, AdminAsistenciaComponent, AdminRespaldosComponent, AdminAprobacionComponent,
    AdminTurnosComponent
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
      @case ('facial') { <app-admin-facial /> }
      @case ('asistencia') { <app-admin-asistencia /> }
      @case ('turnos') { <app-admin-turnos /> }
      @case ('red') { <app-admin-red /> }
      @case ('feriados') { <app-admin-feriados /> }
      @case ('departamentos') { <app-admin-departamentos /> }
      @case ('roles') { <app-admin-roles /> }
      @case ('aprobacion') { <app-admin-aprobacion /> }
      @case ('catalogos') { <app-admin-catalogos /> }
      @case ('respaldos') { <app-admin-respaldos /> }
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
