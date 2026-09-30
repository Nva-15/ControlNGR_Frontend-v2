import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HerramientasService } from '../../services/herramientas';
import { EmpleadosService } from '../../services/empleados';
import { NotificationService } from '../../services/notification.service';
import { Herramienta, HerramientaRequest } from '../../interfaces/herramienta';
import { RolPersonal } from '../../interfaces/admin';
import { ModalComponent } from '../shared/modal/modal.component';
import { enlaceSeguro, mensajeError } from '../../utils/format';
import { normalizar } from '../../utils/filtros';
import { rolLabel } from '../../utils/roles';

interface Formulario {
  id: number | null;
  titulo: string;
  descripcion: string;
  url: string;
  todosLosRoles: boolean;
  roles: string[];
  logo: string | null;
  logoCambiado: boolean;
}

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/gif'];
const MAX_LOGO_MB = 2;

/** "+ Herramientas": accesos a las herramientas web del equipo, visibles por rol. */
@Component({
  selector: 'app-herramientas',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Herramientas</h1>
        <p class="page-subtitle">Accesos directos a las herramientas web del equipo.</p>
      </div>
      @if (puedeGestionar) {
        <button type="button" class="btn-primary" data-nueva-herramienta (click)="nueva()"><i class="bi bi-plus-lg"></i> Nueva herramienta</button>
      }
    </div>

    @if (herramientas.length) {
      <div class="mb-5 flex flex-wrap items-center gap-3">
        <div class="relative min-w-56 flex-1">
          <i class="bi bi-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"></i>
          <input class="input pl-9!" placeholder="Buscar herramienta" [(ngModel)]="busqueda" aria-label="Buscar herramienta" />
        </div>
        @if (puedeGestionar) {
          <select class="select w-72" [(ngModel)]="filtroRol" aria-label="Filtrar por rol">
            <option value="">Visible para: todos los roles</option>
            @for (r of roles; track r.codigo) { <option [value]="r.codigo">Visible para: {{ r.nombre }}</option> }
          </select>
        }
        @if (busqueda || filtroRol) { <button type="button" class="btn-ghost btn-sm" (click)="busqueda = ''; filtroRol = ''"><i class="bi bi-x-lg"></i> Limpiar</button> }
      </div>
    }

    @if (cargando) {
      <div class="flex justify-center py-16"><span class="spinner"></span></div>
    } @else if (!herramientas.length) {
      <div class="card"><div class="empty-state">
        <i class="bi bi-grid-3x3-gap text-4xl"></i>
        <p>{{ puedeGestionar ? 'Aún no hay herramientas. Agregue la primera con "Nueva herramienta".' : 'Aún no hay herramientas disponibles para su rol.' }}</p>
      </div></div>
    } @else if (!filtradas.length) {
      <div class="card"><div class="empty-state"><i class="bi bi-funnel text-3xl"></i><p>No hay herramientas con esos filtros.</p></div></div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (h of filtradas; track h.id) {
          <article class="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md" data-herramienta>
            <div class="flex items-start gap-4">
              <div class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-superficie">
                @if (h.logo) {
                  <img [src]="h.logo" [alt]="'Logo de ' + h.titulo" class="size-12 object-contain" />
                } @else {
                  <span class="text-xl font-semibold text-vino-700">{{ inicial(h.titulo) }}</span>
                }
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="truncate font-semibold" [title]="h.titulo">{{ h.titulo }}</h3>
                <p class="truncate text-xs text-stone-400" [title]="h.url">{{ dominio(h.url) }}</p>
                @if (puedeGestionar) {
                  <div class="mt-1.5 flex flex-wrap gap-1">
                    @if (h.todosLosRoles) { <span class="badge-green"><i class="bi bi-people"></i> Todos</span> }
                    @else { @for (r of h.roles || []; track r) { <span class="badge-gray">{{ nombreRol(r) }}</span> } }
                  </div>
                }
              </div>
            </div>
            <p class="mt-3 flex-1 text-sm text-stone-600">{{ h.descripcion || 'Sin descripción.' }}</p>
            <div class="mt-4 flex items-center gap-1">
              @if (enlace(h.url); as url) {
                <a class="btn-primary btn-sm" [href]="url" target="_blank" rel="noopener noreferrer" data-ingresar>
                  Ingresar <i class="bi bi-box-arrow-up-right"></i>
                </a>
              }
              <span class="flex-1"></span>
              @if (puedeGestionar) {
                <button type="button" class="btn-icon accion-editar" title="Editar" aria-label="Editar herramienta" (click)="editar(h)"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="btn-icon accion-eliminar" title="Eliminar" aria-label="Eliminar herramienta" (click)="eliminar(h)"><i class="bi bi-trash"></i></button>
              }
            </div>
          </article>
        }
      </div>
    }

    <app-modal [abierto]="!!form" [titulo]="form?.id ? 'Editar herramienta' : 'Nueva herramienta'" icono="bi-grid-3x3-gap"
               tamano="lg" (cerrar)="form = null">
      @if (form; as f) {
        <div class="space-y-4">
          <div class="flex items-center gap-4">
            <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-superficie">
              @if (f.logo) { <img [src]="f.logo" alt="Logo" class="size-14 object-contain" data-logo-preview /> }
              @else { <i class="bi bi-image text-2xl text-stone-300"></i> }
            </div>
            <div class="space-y-1">
              <div class="flex flex-wrap gap-2">
                <label class="btn-secondary btn-sm cursor-pointer">
                  <i class="bi bi-upload"></i> {{ f.logo ? 'Cambiar logo' : 'Subir logo' }}
                  <input type="file" class="hidden" accept="image/png,image/jpeg,image/gif" data-logo-input (change)="elegirLogo($event)" />
                </label>
                @if (f.logo) { <button type="button" class="btn-ghost btn-sm" (click)="f.logo = null; f.logoCambiado = true">Quitar</button> }
              </div>
              <p class="field-help">Opcional. PNG, JPG o GIF de hasta {{ maxLogoMb }} MB; se ajusta a 128×128.</p>
            </div>
          </div>
          <div>
            <label class="label" for="h-titulo">Título</label>
            <input id="h-titulo" class="input" maxlength="100" [(ngModel)]="f.titulo" placeholder="Ej.: Nagios" />
          </div>
          <div>
            <label class="label" for="h-url">Enlace</label>
            <input id="h-url" class="input font-mono text-sm!" maxlength="500" [(ngModel)]="f.url" placeholder="https://nagios.ngr.local/" />
          </div>
          <div>
            <label class="label" for="h-desc">Descripción</label>
            <textarea id="h-desc" class="textarea" rows="2" maxlength="500" [(ngModel)]="f.descripcion" placeholder="Para qué sirve la herramienta"></textarea>
          </div>
          <div>
            <p class="label">Visible para</p>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" class="checkbox" [(ngModel)]="f.todosLosRoles" data-todos-roles /> <span>Todos los roles</span>
            </label>
            @if (!f.todosLosRoles) {
              <div class="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-stone-200 p-3 sm:grid-cols-3">
                @for (r of roles; track r.codigo) {
                  <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" class="checkbox" [checked]="f.roles.includes(r.codigo)" (change)="alternarRol(r.codigo)" [attr.data-rol]="r.codigo" />
                    <span>{{ r.nombre }}</span>
                  </label>
                }
              </div>
              <p class="field-help">Jefaturas, supervisores y gestores ven todas las herramientas para administrarlas.</p>
            }
          </div>
        </div>
      }
      <div footer class="flex gap-2">
        <button type="button" class="btn-secondary" (click)="form = null">Cancelar</button>
        <button type="button" class="btn-primary" data-guardar-herramienta [disabled]="guardando" (click)="guardar()">Guardar</button>
      </div>
    </app-modal>
  `
})
export class HerramientasComponent implements OnInit {
  private service = inject(HerramientasService);
  private empleados = inject(EmpleadosService);
  private notification = inject(NotificationService);

  herramientas: Herramienta[] = [];
  roles: RolPersonal[] = [];
  puedeGestionar = false;
  cargando = true;
  guardando = false;
  busqueda = '';
  filtroRol = '';
  form: Formulario | null = null;
  readonly maxLogoMb = MAX_LOGO_MB;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.service.listar().subscribe({
      next: r => {
        this.herramientas = r.herramientas;
        this.cargando = false;
        if (r.puedeGestionar && !this.puedeGestionar) {
          this.empleados.roles().subscribe(roles => this.roles = roles);
        }
        this.puedeGestionar = r.puedeGestionar;
      },
      error: e => { this.cargando = false; this.notification.error(mensajeError(e), 'Herramientas'); }
    });
  }

  get filtradas(): Herramienta[] {
    const q = normalizar(this.busqueda.trim());
    return this.herramientas.filter(h =>
      (!q || normalizar(h.titulo).includes(q) || normalizar(h.descripcion).includes(q) || normalizar(h.url).includes(q)) &&
      (!this.filtroRol || h.todosLosRoles || (h.roles || []).includes(this.filtroRol)));
  }

  enlace(url: string): string | null { return enlaceSeguro(url); }

  dominio(url: string): string {
    try { return new URL(url).host; } catch { return url; }
  }

  inicial(titulo: string): string { return (titulo || '?').trim().charAt(0).toUpperCase(); }

  nombreRol(codigo: string): string {
    return this.roles.find(r => r.codigo === codigo)?.nombre || rolLabel(codigo);
  }

  nueva() {
    this.form = { id: null, titulo: '', descripcion: '', url: 'https://', todosLosRoles: true, roles: [], logo: null, logoCambiado: false };
  }

  editar(h: Herramienta) {
    this.form = {
      id: h.id, titulo: h.titulo, descripcion: h.descripcion || '', url: h.url, todosLosRoles: h.todosLosRoles,
      roles: [...(h.roles || [])], logo: h.logo || null, logoCambiado: false
    };
  }

  alternarRol(codigo: string) {
    const f = this.form;
    if (!f) return;
    f.roles = f.roles.includes(codigo) ? f.roles.filter(r => r !== codigo) : [...f.roles, codigo];
  }

  elegirLogo(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || !this.form) return;
    if (!TIPOS_LOGO.includes(archivo.type)) { this.notification.warning('El logo debe ser una imagen PNG, JPG o GIF.'); return; }
    if (archivo.size > MAX_LOGO_MB * 1024 * 1024) { this.notification.warning(`El logo no debe superar ${MAX_LOGO_MB} MB.`); return; }
    const lector = new FileReader();
    lector.onload = () => {
      if (this.form) { this.form.logo = String(lector.result); this.form.logoCambiado = true; }
    };
    lector.readAsDataURL(archivo);
  }

  guardar() {
    const f = this.form;
    if (!f) return;
    if (!f.titulo.trim()) { this.notification.warning('Indique el título.'); return; }
    if (!enlaceSeguro(f.url)) { this.notification.warning('El enlace debe empezar con http:// o https://'); return; }
    if (!f.todosLosRoles && !f.roles.length) { this.notification.warning('Elija al menos un rol o marque "Todos los roles".'); return; }
    const datos: HerramientaRequest = {
      titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), url: f.url.trim(),
      todosLosRoles: f.todosLosRoles, roles: f.todosLosRoles ? [] : f.roles
    };
    if (f.logoCambiado || !f.id) datos.logo = f.logo;
    this.guardando = true;
    const peticion = f.id ? this.service.actualizar(f.id, datos) : this.service.crear(datos);
    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.notification.success(f.id ? 'Herramienta actualizada.' : 'Herramienta agregada.');
        this.form = null;
        this.cargar();
      },
      error: e => { this.guardando = false; this.notification.error(mensajeError(e)); }
    });
  }

  async eliminar(h: Herramienta) {
    const ok = await this.notification.confirm({
      title: 'Eliminar herramienta', message: `Se quitará el acceso a "${h.titulo}" para todos.`,
      confirmText: 'Eliminar', type: 'danger'
    });
    if (!ok) return;
    this.service.eliminar(h.id).subscribe({
      next: () => { this.notification.success('Herramienta eliminada.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
