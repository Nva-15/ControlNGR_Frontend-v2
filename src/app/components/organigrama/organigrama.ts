import { Component, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpleadosService } from '../../services/empleados';
import { EmpleadoResponse } from '../../interfaces/empleado';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { ModalComponent } from '../shared/modal/modal.component';
import { ROLES, rolBadge, rolLabel } from '../../utils/roles';
import { normalizar } from '../../utils/filtros';

/** Orden de los equipos: primero las áreas con más personal (Soporte, HD, NOC), debajo Back Office y Almacén. */
const ORDEN_EQUIPOS = ['soporte tecnico', 'hd', 'noc', 'back office', 'tiendas y almacen de sistemas'];

/** Color e ícono de cada área (los departamentos nuevos usan el estilo neutro). */
const ESTILO_EQUIPO: Record<string, { color: string; icono: string; titulo?: string }> = {
  'soporte tecnico': { color: '#9b1437', icono: 'bi-tools' },
  'hd': { color: '#2563eb', icono: 'bi-headset', titulo: 'HD · Help Desk' },
  'noc': { color: '#0f766e', icono: 'bi-broadcast' },
  'back office': { color: '#b45309', icono: 'bi-folder2-open' },
  'tiendas y almacen de sistemas': { color: '#7e22ce', icono: 'bi-box-seam' },
};
const ESTILO_NEUTRO = { color: '#78716c', icono: 'bi-building' };
const ALTA_DIRECCION: string[] = [ROLES.DIRECTOR, ROLES.GERENTE, ROLES.JEFE];

function ordenEquipo(departamento: string): number {
  const i = ORDEN_EQUIPOS.indexOf(normalizar(departamento).trim());
  return i === -1 ? ORDEN_EQUIPOS.length : i;
}

/** Líderes técnicos primero, luego por nombre. */
function porLiderazgo(a: EmpleadoResponse, b: EmpleadoResponse): number {
  const lt = (e: EmpleadoResponse) => /\(lt\)|lider tecnico/.test(normalizar(e.cargo)) ? 0 : 1;
  return lt(a) - lt(b) || a.nombre.localeCompare(b.nombre);
}

interface Nivel {
  titulo: string;
  personas: EmpleadoResponse[];
}

interface Equipo {
  departamento: string;
  titulo: string;
  color: string;
  icono: string;
  etiquetaLideres: string;
  lideres: EmpleadoResponse[];
  personas: EmpleadoResponse[];
}

interface Cumple {
  emp: EmpleadoResponse;
  fecha: Date;
  esHoy: boolean;
}

/**
 * Organigrama: dirección, gerencia y jefatura en una franja; debajo cada equipo con su supervisión
 * (o gestión) y su personal. Incluye buscador, vista de lista y cumpleaños de la semana.
 */
@Component({
  selector: 'app-organigrama',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, AvatarComponent, ModalComponent],
  templateUrl: './organigrama.html'
})
export class OrganigramaComponent implements OnInit {
  private empService = inject(EmpleadosService);

  cargando = true;
  niveles: Nivel[] = [];
  equipos: Equipo[] = [];
  cumpleanos: Cumple[] = [];
  seleccionado: EmpleadoResponse | null = null;

  vista: 'arbol' | 'lista' = 'arbol';
  busqueda = '';
  totalPersonas = 0;
  totalSupervisores = 0;

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
    const rol = (e: EmpleadoResponse) => (e.rol || '').toLowerCase();
    const deptoDe = (e: EmpleadoResponse) => e.departamentoNombre || 'Sin departamento';
    const deptosEquipo = new Set(empleados.filter(e => !ALTA_DIRECCION.includes(rol(e))).map(deptoDe));
    const almacen = [...deptosEquipo].find(d => normalizar(d).includes('almacen'));

    // Gestores y jefaturas que dirigen un equipo se muestran dentro de él, como "Gestión"
    const equipoQueGestiona = (e: EmpleadoResponse): string | null => {
      if (rol(e) === ROLES.GESTOR) return deptoDe(e);
      if (rol(e) !== ROLES.JEFE) return null;
      if (almacen && normalizar(e.cargo).includes('almacen')) return almacen;
      return deptosEquipo.has(deptoDe(e)) && ordenEquipo(deptoDe(e)) < ORDEN_EQUIPOS.length ? deptoDe(e) : null;
    };

    const de = (r: string) => empleados.filter(e => rol(e) === r && !equipoQueGestiona(e));
    this.niveles = [
      { titulo: 'Dirección', personas: de(ROLES.DIRECTOR) },
      { titulo: 'Gerencia', personas: de(ROLES.GERENTE) },
      { titulo: 'Jefatura', personas: de(ROLES.JEFE) },
    ].filter(n => n.personas.length);

    const enFranja = new Set(this.niveles.flatMap(n => n.personas.map(p => p.id)));
    const grupos = new Map<string, { lideres: EmpleadoResponse[]; personas: EmpleadoResponse[]; gestion: boolean; supervision: boolean }>();
    const grupo = (d: string) => {
      if (!grupos.has(d)) grupos.set(d, { lideres: [], personas: [], gestion: false, supervision: false });
      return grupos.get(d)!;
    };
    for (const e of empleados) {
      if (enFranja.has(e.id)) continue;
      const gestiona = equipoQueGestiona(e);
      if (gestiona) {
        const g = grupo(gestiona);
        g.lideres.push(e);
        g.gestion = true;
      } else if (rol(e) === ROLES.SUPERVISOR) {
        const g = grupo(deptoDe(e));
        g.lideres.push(e);
        g.supervision = true;
      } else {
        grupo(deptoDe(e)).personas.push(e);
      }
    }

    this.equipos = [...grupos.entries()]
      .map(([departamento, g]) => {
        const estilo = ESTILO_EQUIPO[normalizar(departamento).trim()];
        return {
          departamento,
          titulo: estilo?.titulo || departamento,
          color: (estilo || ESTILO_NEUTRO).color,
          icono: (estilo || ESTILO_NEUTRO).icono,
          etiquetaLideres: g.gestion && g.supervision ? 'Supervisión y gestión' : g.gestion ? 'Gestión' : 'Supervisión',
          lideres: g.lideres.sort((a, b) => a.nombre.localeCompare(b.nombre)),
          personas: g.personas.sort(porLiderazgo),
        };
      })
      .sort((a, b) => ordenEquipo(a.departamento) - ordenEquipo(b.departamento)
        || a.departamento.localeCompare(b.departamento));

    this.totalPersonas = empleados.length;
    this.totalSupervisores = empleados.filter(e => rol(e) === ROLES.SUPERVISOR).length;
  }

  // ---------- Búsqueda y vistas ----------

  private coincide(e: EmpleadoResponse): boolean {
    const q = normalizar(this.busqueda.trim());
    return !q || normalizar(e.nombre).includes(q) || normalizar(e.cargo).includes(q);
  }

  get nivelesVisibles(): Nivel[] {
    return this.niveles
      .map(n => ({ ...n, personas: n.personas.filter(p => this.coincide(p)) }))
      .filter(n => n.personas.length);
  }

  get equiposVisibles(): Equipo[] {
    return this.equipos
      .map(eq => ({ ...eq, lideres: eq.lideres.filter(p => this.coincide(p)), personas: eq.personas.filter(p => this.coincide(p)) }))
      .filter(eq => eq.lideres.length || eq.personas.length);
  }

  /** Primera fila: las tres áreas principales; debajo, el resto en tarjetas más anchas. */
  get filaPrincipal(): Equipo[] {
    return this.equiposVisibles.filter(eq => ordenEquipo(eq.departamento) < 3);
  }

  get filaSecundaria(): Equipo[] {
    return this.equiposVisibles.filter(eq => ordenEquipo(eq.departamento) >= 3);
  }

  /** Vista de lista: todos, en el orden del organigrama. */
  get lista(): { p: EmpleadoResponse; equipo: string; color: string }[] {
    const franja = this.nivelesVisibles.flatMap(n => n.personas.map(p => ({ p, equipo: n.titulo, color: '#78716c' })));
    const equipos = this.equiposVisibles.flatMap(eq =>
      [...eq.lideres, ...eq.personas].map(p => ({ p, equipo: eq.titulo, color: eq.color })));
    return [...franja, ...equipos];
  }

  get sinResultados(): boolean {
    return !this.nivelesVisibles.length && !this.equiposVisibles.length;
  }

  rolClase(r: string): string { return rolBadge(r); }
  rolTexto(r: string): string { return rolLabel(r); }

  // ---------- Cumpleaños y ficha ----------

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
    return c.esHoy ? '¡Hoy!' : c.fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' });
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
