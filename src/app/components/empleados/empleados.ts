import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { EmpleadosService } from '../../services/empleados';
import { AuthService } from '../../services/auth';
import { ExportService } from '../../services/export';
import { NotificationService } from '../../services/notification.service';
import { ApiConfigService } from '../../services/api-config.service';
import { EmpleadoResponse } from '../../interfaces/empleado';
import { ModalComponent } from '../shared/modal/modal.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { fechaCorta, hoyIso, mensajeError } from '../../utils/format';
import { rolBadge, rolLabel } from '../../utils/roles';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, ModalComponent, AvatarComponent],
  templateUrl: './empleados.html'
})
export class EmpleadosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private empService = inject(EmpleadosService);
  auth = inject(AuthService);
  private exportService = inject(ExportService);
  private notification = inject(NotificationService);
  private http = inject(HttpClient);
  private api = inject(ApiConfigService);

  empleados: EmpleadoResponse[] = [];
  departamentos: { id: number; nombre: string }[] = [];
  roles: { codigo: string; nombre: string; nivel: number }[] = [];
  cargando = true;

  // Filtros
  busqueda = '';
  filtroDepartamento: number | '' = '';
  filtroRol = '';
  filtroEstado: 'activos' | 'inactivos' | 'todos' = 'activos';

  // Formulario
  formAbierto = false;
  editando: EmpleadoResponse | null = null;
  form: FormGroup = this.crearForm();
  guardando = false;
  fotoArchivo: File | null = null;
  fotoPreview: string | null = null;

  // Restablecer contraseña
  resetDe: EmpleadoResponse | null = null;
  resetClave = '';

  readonly fechaCorta = fechaCorta;
  readonly rolLabel = rolLabel;
  readonly rolBadge = rolBadge;

  niveles = [
    { value: 'jefe', label: 'Jefatura / Gerencia' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'hd', label: 'Help Desk' },
    { value: 'noc', label: 'NOC' },
    { value: 'bo', label: 'Back Office' },
    { value: 'asistente', label: 'Asistente' },
  ];

  ngOnInit() {
    this.cargar();
    this.empService.departamentos().subscribe(d => this.departamentos = d);
    this.empService.roles().subscribe(r => this.roles = r);
  }

  get puedeCrear(): boolean {
    return this.auth.puedeGestionarAcceso();
  }

  cargar() {
    this.empService.getEmpleados().subscribe({
      next: d => { this.empleados = d.sort((a, b) => a.nombre.localeCompare(b.nombre)); this.cargando = false; },
      error: e => { this.cargando = false; this.notification.error(mensajeError(e)); }
    });
  }

  get filtrados(): EmpleadoResponse[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.empleados.filter(e =>
      (this.filtroEstado === 'todos' || (this.filtroEstado === 'activos') === !!e.activo) &&
      (!this.filtroDepartamento || e.departamentoId === this.filtroDepartamento) &&
      (!this.filtroRol || e.rol === this.filtroRol) &&
      (!q || e.nombre.toLowerCase().includes(q) || e.dni.includes(q) || (e.cargo || '').toLowerCase().includes(q)));
  }

  // ==================== PERMISOS ====================

  puedeEditar(e: EmpleadoResponse) { return this.auth.puedeEditarEmpleado({ id: e.id, rol: e.rol }); }

  esPropio(e: EmpleadoResponse) { return e.id === this.auth.empleado()?.id; }

  puedeAdministrar(e: EmpleadoResponse) { return !this.esPropio(e) && this.auth.puedeEditarEmpleado({ rol: e.rol }); }

  // ==================== FORMULARIO ====================

  private crearForm(): FormGroup {
    const hoy = hoyIso();
    return this.fb.group({
      tipoDoc: ['DNI'],
      dni: ['', [Validators.required, Validators.pattern(/^\d{8}$/)]],
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      cargo: ['', [Validators.required, Validators.maxLength(100)]],
      departamentoId: [null as number | null],
      nivel: ['tecnico', Validators.required],
      rol: ['tecnico', Validators.required],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      cumpleanos: [''],
      ingreso: [hoy, Validators.required],
      username: [''],
      password: [''],
      hobby: ['', Validators.maxLength(255)],
      descripcion: ['', Validators.maxLength(500)],
      activo: [true],
      usuarioActivo: [true],
    });
  }

  cambiarTipoDoc() {
    const ctrl = this.form.get('dni')!;
    const patron = this.form.value.tipoDoc === 'CE' ? /^\d{9,12}$/ : /^\d{8}$/;
    ctrl.setValidators([Validators.required, Validators.pattern(patron)]);
    ctrl.updateValueAndValidity();
  }

  nuevo() {
    this.editando = null;
    this.form = this.crearForm();
    this.fotoArchivo = null;
    this.fotoPreview = null;
    this.formAbierto = true;
  }

  editar(e: EmpleadoResponse) {
    this.editando = e;
    this.form = this.crearForm();
    this.form.patchValue({
      tipoDoc: e.dni.length === 8 ? 'DNI' : 'CE',
      dni: e.dni, nombre: e.nombre, cargo: e.cargo, departamentoId: e.departamentoId ?? null,
      nivel: e.nivel || 'tecnico', rol: e.rol, email: e.email || '', cumpleanos: e.cumpleanos || '',
      ingreso: e.ingreso || '', username: e.username || '', hobby: e.hobby || '', descripcion: e.descripcion || '',
      activo: !!e.activo, usuarioActivo: !!e.usuarioActivo
    });
    this.cambiarTipoDoc();
    this.form.get('dni')!.disable();
    this.form.get('tipoDoc')!.disable();
    if (!this.puedeCrear) {
      this.form.get('rol')!.disable();
      this.form.get('username')!.disable();
    }
    this.fotoArchivo = null;
    this.fotoPreview = null;
    this.formAbierto = true;
  }

  invalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  seleccionarFoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.notification.error('Use una imagen JPG, PNG, GIF o BMP de hasta 5 MB.');
      return;
    }
    this.fotoArchivo = file;
    const reader = new FileReader();
    reader.onload = () => this.fotoPreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  guardar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notification.warning('Revise los campos marcados.');
      return;
    }
    const v = this.form.getRawValue();
    const datos: any = {
      nombre: v.nombre.trim(), cargo: v.cargo.trim(), nivel: v.nivel, departamentoId: v.departamentoId,
      email: v.email?.trim().toLowerCase() || undefined, cumpleanos: v.cumpleanos || undefined, ingreso: v.ingreso,
      hobby: v.hobby?.trim() || '', descripcion: v.descripcion?.trim() || '',
      activo: v.activo, usuarioActivo: v.usuarioActivo
    };
    if (this.puedeCrear) {
      datos.rol = v.rol;
      if (v.username?.trim()) datos.username = v.username.trim();
    }

    this.guardando = true;
    const peticion = this.editando
      ? this.empService.updateEmpleado(this.editando.id!, datos)
      : this.empService.createEmpleado({ ...datos, dni: v.dni.trim(), password: v.password?.trim() || undefined });

    peticion.subscribe({
      next: (res: any) => {
        const id = this.editando?.id ?? res?.id;
        if (this.fotoArchivo && id) {
          this.subirFoto(id);
        } else {
          this.finalizarGuardado();
        }
      },
      error: e => {
        this.guardando = false;
        this.notification.error(mensajeError(e, 'No se pudo guardar el empleado'));
      }
    });
  }

  private subirFoto(id: number) {
    const form = new FormData();
    form.append('archivo', this.fotoArchivo!);
    this.http.post<any>(`${this.api.apiUrl}/imagenes/upload/${id}`, form).subscribe({
      next: () => this.finalizarGuardado(),
      error: e => {
        this.notification.warning(mensajeError(e, 'El empleado se guardó, pero la foto no se pudo subir.'));
        this.finalizarGuardado();
      }
    });
  }

  private finalizarGuardado() {
    const nuevo = !this.editando;
    this.guardando = false;
    this.formAbierto = false;
    this.notification.success(nuevo
      ? 'Empleado registrado. Su usuario es el DNI y deberá cambiar la contraseña al ingresar.'
      : 'Empleado actualizado.');
    this.cargar();
  }

  // ==================== ACCIONES ====================

  async cambiarEstado(e: EmpleadoResponse) {
    const activar = !e.activo;
    const ok = await this.notification.confirm({
      title: activar ? 'Activar empleado' : 'Desactivar empleado',
      message: activar ? `${e.nombre} podrá volver a ingresar al sistema.` : `${e.nombre} no podrá ingresar ni marcar asistencia.`,
      confirmText: activar ? 'Activar' : 'Desactivar', type: activar ? 'success' : 'warning'
    });
    if (!ok) return;
    this.empService.cambiarEstadoUsuario(e.id!, activar).subscribe({
      next: () => { this.notification.success('Estado actualizado.'); this.cargar(); },
      error: err => this.notification.error(mensajeError(err))
    });
  }

  async eliminar(e: EmpleadoResponse) {
    const ok = await this.notification.confirm({
      title: 'Eliminar empleado',
      message: `Se eliminará a ${e.nombre} de forma permanente. Si tiene registros asociados, mejor desactívelo.`,
      confirmText: 'Eliminar', type: 'danger'
    });
    if (!ok) return;
    this.empService.deleteEmpleado(e.id!).subscribe({
      next: () => { this.notification.success('Empleado eliminado.'); this.cargar(); },
      error: err => this.notification.error(mensajeError(err))
    });
  }

  abrirReset(e: EmpleadoResponse) {
    this.resetDe = e;
    this.resetClave = '';
  }

  confirmarReset() {
    if (!this.resetDe) return;
    this.empService.cambiarPasswordAdmin(this.resetDe.id!, this.resetClave).subscribe({
      next: () => { this.notification.success('Contraseña restablecida. Deberá cambiarla al ingresar.'); this.resetDe = null; },
      error: e => this.notification.error(mensajeError(e))
    });
  }

  // ==================== EXPORTAR ====================

  private filas() {
    return this.filtrados.map(e => ({
      Nombre: e.nombre, DNI: e.dni, Cargo: e.cargo, Departamento: e.departamentoNombre || '',
      Rol: rolLabel(e.rol), Correo: e.email || '', Ingreso: fechaCorta(e.ingreso), Cumpleaños: fechaCorta(e.cumpleanos),
      Estado: e.activo ? 'Activo' : 'Inactivo'
    }));
  }

  exportarExcel() { this.exportService.exportToExcel(this.filas(), `empleados_${hoyIso()}`, 'Empleados'); }

  exportarPDF() {
    const cols = ['Nombre', 'DNI', 'Cargo', 'Departamento', 'Rol', 'Correo', 'Ingreso', 'Estado'].map(c => ({ header: c, dataKey: c }));
    this.exportService.exportToPDF(this.filas(), cols, { title: 'Empleados', filename: `empleados_${hoyIso()}` });
  }
}
