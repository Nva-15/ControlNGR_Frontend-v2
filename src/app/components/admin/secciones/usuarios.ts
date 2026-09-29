import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { TipoUsuario, UsuarioAdmin } from '../../../interfaces/admin';
import { ModalComponent } from '../../shared/modal/modal.component';
import { mensajeError } from '../../../utils/format';
import { rolBadge } from '../../../utils/roles';
import { normalizar, opciones } from '../../../utils/filtros';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative min-w-48 flex-1">
        <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
        <input class="input pl-9!" placeholder="Buscar usuario o nombre" [(ngModel)]="busqueda" />
      </div>
      <select class="select w-64" [(ngModel)]="filtroDepartamento" aria-label="Filtrar por departamento">
        <option value="">Todos los departamentos</option>
        @for (d of departamentos; track d) { <option [value]="d">{{ d }}</option> }
      </select>
      <select class="select w-44" [(ngModel)]="filtroRol" aria-label="Filtrar por rol">
        <option value="">Todos los roles</option>
        @for (r of roles; track r[0]) { <option [value]="r[0]">{{ r[1] }}</option> }
      </select>
      <select class="select w-40" [(ngModel)]="filtroEstado" aria-label="Filtrar por estado">
        <option value="todos">Todos los estados</option>
        <option value="activos">Activos</option>
        <option value="inactivos">Inactivos</option>
      </select>
      @if (hayFiltros) { <button class="btn-ghost btn-sm" (click)="limpiarFiltros()"><i class="bi bi-x-lg"></i> Limpiar</button> }
      <a routerLink="/empleados" class="btn-primary"><i class="bi bi-person-plus"></i> Registrar empleado</a>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Usuario</th><th>Empleado</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th class="text-right">Acciones</th></tr></thead>
          <tbody>
            @for (u of filtrados; track u.id) {
              <tr>
                <td class="font-mono text-xs">{{ u.username }}</td>
                <td class="min-w-56"><p class="font-medium">{{ u.empleadoNombre || 'Cuenta del sistema' }}</p><p class="text-xs text-stone-500">{{ u.departamento }}</p></td>
                <td>
                  @if (u.rol === 'admin') { <span class="badge-gray">{{ u.rolNombre }}</span> }
                  @else {
                    <select class="select w-48 py-1! text-xs!" [ngModel]="u.rol" (ngModelChange)="cambiarRol(u, $event)">
                      @for (t of rolesPersonal; track t.codigo) { <option [value]="t.codigo">{{ t.nombre }}</option> }
                    </select>
                  }
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <span [class]="u.activo ? 'badge-green' : 'badge-red'">{{ u.activo ? 'Activo' : 'Inactivo' }}</span>
                    @if (u.debeCambiarPassword) { <span class="badge-amber">Cambio de clave pendiente</span> }
                  </div>
                </td>
                <td class="whitespace-nowrap text-xs text-stone-500">{{ u.ultimoAcceso ? u.ultimoAcceso.replace('T', ' ').substring(0, 16) : 'Nunca' }}</td>
                <td>
                  <div class="flex flex-nowrap justify-end gap-1">
                    <button class="btn-icon accion-clave" title="Restablecer contraseña" aria-label="Restablecer contraseña" (click)="abrirReset(u)"><i class="bi bi-key"></i></button>
                    @if (u.rol !== 'admin') {
                      @if (u.activo) {
                        <button class="btn-icon accion-rechazar" title="Desactivar acceso" aria-label="Desactivar acceso" (click)="cambiarEstado(u)"><i class="bi bi-person-dash"></i></button>
                      } @else {
                        <button class="btn-icon accion-aprobar" title="Activar acceso" aria-label="Activar acceso" (click)="cambiarEstado(u)"><i class="bi bi-person-check"></i></button>
                      }
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!filtrados.length) { <div class="empty-state"><i class="bi bi-funnel text-3xl"></i><p>No hay usuarios con esos filtros.</p></div> }
      <p class="border-t border-stone-100 px-4 py-2 text-xs text-stone-500">{{ filtrados.length }} de {{ usuarios.length }} usuarios</p>
    </div>

    <app-modal [abierto]="!!reset" titulo="Restablecer contraseña" [subtitulo]="reset?.u?.empleadoNombre || reset?.u?.username || ''" (cerrar)="reset = null">
      @if (reset; as r) {
        <p class="mb-4 text-sm text-stone-600">Entregue esta contraseña temporal al usuario. Deberá cambiarla en su próximo ingreso.</p>
        <label class="label">Contraseña temporal</label>
        <div class="flex gap-2">
          <input class="input font-mono" [(ngModel)]="r.clave" />
          <button class="btn-secondary" (click)="r.clave = generarClave()" title="Generar"><i class="bi bi-shuffle"></i></button>
        </div>
        <p class="field-help">Mínimo 8 caracteres, con letras y números.</p>
      }
      <div footer class="flex gap-2">
        <button class="btn-secondary" (click)="reset = null">Cancelar</button>
        <button class="btn-primary" (click)="confirmarReset()">Restablecer</button>
      </div>
    </app-modal>
  `
})
export class AdminUsuariosComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);

  usuarios: UsuarioAdmin[] = [];
  rolesPersonal: TipoUsuario[] = [];
  busqueda = '';
  filtroDepartamento = '';
  filtroRol = '';
  filtroEstado: 'activos' | 'inactivos' | 'todos' = 'todos';
  departamentos: string[] = [];
  roles: [string, string][] = [];
  reset: { u: UsuarioAdmin; clave: string } | null = null;
  readonly rolBadge = rolBadge;

  ngOnInit() {
    this.cargar();
    this.admin.tiposUsuario().subscribe(t => this.rolesPersonal = t.filter(x => !x.esSistema));
  }

  cargar() {
    this.admin.usuarios().subscribe(u => {
      this.usuarios = u.sort((a, b) => (a.empleadoNombre || '').localeCompare(b.empleadoNombre || ''));
      this.departamentos = opciones(this.usuarios, x => x.departamento);
      const nombres = new Map(this.usuarios.map(x => [x.rol, x.rolNombre] as [string, string]));
      this.roles = [...nombres].sort((a, b) => a[1].localeCompare(b[1]));
    });
  }

  get filtrados() {
    const q = normalizar(this.busqueda.trim());
    return this.usuarios.filter(u =>
      (!q || normalizar(u.username).includes(q) || normalizar(u.empleadoNombre).includes(q)) &&
      (!this.filtroDepartamento || u.departamento === this.filtroDepartamento) &&
      (!this.filtroRol || u.rol === this.filtroRol) &&
      (this.filtroEstado === 'todos' || (this.filtroEstado === 'activos') === u.activo));
  }

  get hayFiltros() { return !!(this.busqueda.trim() || this.filtroDepartamento || this.filtroRol || this.filtroEstado !== 'todos'); }

  limpiarFiltros() { this.busqueda = ''; this.filtroDepartamento = ''; this.filtroRol = ''; this.filtroEstado = 'todos'; }

  async cambiarRol(u: UsuarioAdmin, rol: string) {
    const anterior = u.rol;
    const ok = await this.notification.confirm({
      title: 'Cambiar rol', message: `¿Asignar el rol "${rol}" a ${u.empleadoNombre}? Cambia sus permisos y quién aprueba sus solicitudes.`,
      confirmText: 'Cambiar rol'
    });
    if (!ok) { u.rol = anterior; this.usuarios = [...this.usuarios]; return; }
    this.admin.cambiarRol(u.id, rol).subscribe({
      next: () => { this.notification.success('Rol actualizado.'); this.cargar(); },
      error: e => { this.notification.error(mensajeError(e)); this.cargar(); }
    });
  }

  async cambiarEstado(u: UsuarioAdmin) {
    const ok = await this.notification.confirm({
      title: u.activo ? 'Desactivar acceso' : 'Activar acceso',
      message: u.activo ? `${u.empleadoNombre} no podrá ingresar al sistema.` : `${u.empleadoNombre} podrá ingresar nuevamente.`,
      confirmText: u.activo ? 'Desactivar' : 'Activar', type: u.activo ? 'danger' : 'success'
    });
    if (!ok) return;
    this.admin.cambiarEstadoUsuario(u.id, !u.activo).subscribe({
      next: () => { this.notification.success('Estado actualizado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  generarClave(): string {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const arr = new Uint32Array(10);
    crypto.getRandomValues(arr);
    let clave = Array.from(arr.slice(0, 7), n => letras[n % letras.length]).join('');
    return clave + String(arr[7] % 1000).padStart(3, '0');
  }

  abrirReset(u: UsuarioAdmin) {
    this.reset = { u, clave: this.generarClave() };
  }

  confirmarReset() {
    if (!this.reset) return;
    const { u, clave } = this.reset;
    this.admin.restablecerPassword(u.id, clave).subscribe({
      next: () => { this.reset = null; this.notification.success('Contraseña restablecida.', 'Listo'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
