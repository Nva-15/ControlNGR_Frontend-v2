import { Component, OnInit, inject } from '@angular/core';
import { EmpleadosService } from '../../services/empleados';
import { EmpleadoResponse } from '../../interfaces/empleado';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { rolBadge, rolLabel, ROLES } from '../../utils/roles';

interface Nivel {
  titulo: string;
  personas: EmpleadoResponse[];
}

interface Cumple {
  emp: EmpleadoResponse;
  fecha: Date;
  esHoy: boolean;
}

/** Organigrama por jerarquia de roles y equipos por departamento, con cumpleaños de la semana. */
@Component({
  selector: 'app-organigrama',
  standalone: true,
  imports: [AvatarComponent, ModalComponent],
  templateUrl: './organigrama.html'
})
export class OrganigramaComponent implements OnInit {
  private empService = inject(EmpleadosService);

  cargando = true;
  niveles: Nivel[] = [];
  equipos: { departamento: string; personas: EmpleadoResponse[] }[] = [];
  cumpleanos: Cumple[] = [];
  seleccionado: EmpleadoResponse | null = null;

  readonly rolLabel = rolLabel;
  readonly rolBadge = rolBadge;

  ngOnInit() {
    this.empService.getEmpleados().subscribe({
      next: (data) => {
        const activos = data.filter(e => e.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.construir(activos);
        this.calcularCumpleanos(activos);
        this.cargando = false;
      },
      error: () => this.cargando = false
    });
  }

  private construir(empleados: EmpleadoResponse[]) {
    const de = (...roles: string[]) => empleados.filter(e => roles.includes((e.rol || '').toLowerCase()));
    this.niveles = [
      { titulo: 'Dirección', personas: de(ROLES.DIRECTOR) },
      { titulo: 'Gerencia', personas: de(ROLES.GERENTE) },
      { titulo: 'Jefatura', personas: de(ROLES.JEFE) },
      { titulo: 'Supervisión y gestión', personas: de(ROLES.SUPERVISOR, ROLES.GESTOR) },
    ].filter(n => n.personas.length);

    const liderazgo = new Set(this.niveles.flatMap(n => n.personas.map(p => p.id)));
    const porDepto = new Map<string, EmpleadoResponse[]>();
    for (const e of empleados) {
      if (liderazgo.has(e.id)) continue;
      const clave = e.departamentoNombre || 'Sin departamento';
      porDepto.set(clave, [...(porDepto.get(clave) || []), e]);
    }
    this.equipos = [...porDepto.entries()]
      .map(([departamento, personas]) => ({ departamento, personas }))
      .sort((a, b) => a.departamento.localeCompare(b.departamento));
  }

  private calcularCumpleanos(empleados: EmpleadoResponse[]) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(hoy);
    limite.setDate(hoy.getDate() + 7);
    this.cumpleanos = empleados
      .filter(e => e.cumpleanos)
      .map(e => {
        const [, m, d] = e.cumpleanos!.substring(0, 10).split('-').map(Number);
        let fecha = new Date(hoy.getFullYear(), m - 1, d);
        if (fecha < hoy) fecha = new Date(hoy.getFullYear() + 1, m - 1, d);
        return { emp: e, fecha, esHoy: fecha.getTime() === hoy.getTime() };
      })
      .filter(c => c.fecha <= limite)
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }

  fechaCumple(c: Cumple): string {
    return c.esHoy ? '¡Hoy!' : c.fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  antiguedad(ingreso?: string): string {
    if (!ingreso) return '—';
    const [y, m, d] = ingreso.substring(0, 10).split('-').map(Number);
    const inicio = new Date(y, m - 1, d);
    const hoy = new Date();
    let anios = hoy.getFullYear() - inicio.getFullYear();
    let meses = hoy.getMonth() - inicio.getMonth();
    if (hoy.getDate() < inicio.getDate()) meses--;
    if (meses < 0) { anios--; meses += 12; }
    const partes = [];
    if (anios > 0) partes.push(`${anios} año${anios !== 1 ? 's' : ''}`);
    if (meses > 0) partes.push(`${meses} mes${meses !== 1 ? 'es' : ''}`);
    return partes.join(' y ') || 'Menos de un mes';
  }

  fechaLarga(iso?: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
  }
}
