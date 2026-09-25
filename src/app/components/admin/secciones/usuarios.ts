import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { TipoUsuario, UsuarioAdmin } from '../../../interfaces/admin';
import { ModalComponent } from '../../shared/modal/modal.component';
import { mensajeError } from '../../../utils/format';
import { rolBadge } from '../../../utils/roles';

@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <div class="relative min-w-64 flex-1">
        <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
        <input class="input pl-9!" placeholder="Buscar usuario o nombre" [(ngModel)]="busqueda" />
      </div>
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
                <td><p class="font-medium">{{ u.empleadoNombre || 'Cuenta del sistema' }}</p><p class="text-xs text-stone-500">{{ u.departamento }}</p></td>
                <td>
                  @if (u.rol === 'admin') { <span class="badge-gray">{{ u.rolNombre }}</span> }
                  @else {
                    <select class="select w-40 py-1! text-xs!" [ngModel]="u.rol" (ngModelChange)="cambiarRol(u, $event)">
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
                <td class="text-xs text-stone-500">{{ u.ultimoAcceso ? u.ultimoAcceso.replace('T', ' ').substring(0, 16) : 'Nunca' }}</td>
                <td>
                  <div class="flex justify-end gap-1">
                    <button class="btn-ghost btn-sm" (click)="abrirReset(u)"><i class="bi bi-key"></i> Restablecer clave</button>
                    @if (u.rol !== 'admin') {
                      <button class="btn-ghost btn-sm" (click)="cambiarEstado(u)">
                        <i class="bi" [class]="u.activo ? 'bi-person-dash' : 'bi-person-check'"></i> {{ u.activo ? 'Desactivar' : 'Activar' }}
                      </button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
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
  reset: { u: UsuarioAdmin; clave: string } | null = null;
  readonly rolBadge = rolBadge;

  ngOnInit() {
    this.cargar();
    this.admin.tiposUsuario().subscribe(t => this.rolesPersonal = t.filter(x => !x.esSistema));
  }

  cargar() {
    this.admin.usuarios().subscribe(u => this.usuarios = u.sort((a, b) => (a.empleadoNombre || '').localeCompare(b.empleadoNombre || '')));
  }

  get filtrados() {
    const q = this.busqueda.trim().toLowerCase();
    return q ? this.usuarios.filter(u => u.username.includes(q) || (u.empleadoNombre || '').toLowerCase().includes(q)) : this.usuarios;
  }

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
