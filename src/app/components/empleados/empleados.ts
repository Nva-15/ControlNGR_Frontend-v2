import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EmpleadosService } from '../../services/empleados';
import { AuthService } from '../../services/auth';
import { ExportService } from '../../services/export';
import { EmpleadoResponse } from '../../interfaces/empleado';
import { NotificationService } from '../../services/notification.service';
import { ApiConfigService } from '../../services/api-config.service';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './empleados.html',
  styleUrls: ['./empleados.css']
})
export class EmpleadosComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  fb = inject(FormBuilder);
  empService = inject(EmpleadosService);
  authService = inject(AuthService);
  exportService = inject(ExportService);
  http = inject(HttpClient);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);
  notification = inject(NotificationService);
  apiConfig = inject(ApiConfigService);

  empForm: FormGroup;

  empleados: EmpleadoResponse[] = [];
  empleadosFiltrados: EmpleadoResponse[] = [];

  vista: 'lista' | 'formulario' = 'lista';
  isEditing = false;
  isLoading = false;
  mensaje = '';
  mensajeError = '';
  filtroBusqueda = '';

  tipoDocumento: 'DNI' | 'CE' = 'DNI';
  fotoPreview: string | ArrayBuffer | null = null;
  fotoFile: File | null = null;
  fotoActual: string | null = null;

  fechaHoy = '';

  mostrarModalEliminar = false;
  empleadoAEliminar: EmpleadoResponse | null = null;

  roles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'tecnico', label: 'Tecnico' },
    { value: 'hd', label: 'HD' },
    { value: 'noc', label: 'NOC' }
  ];

  niveles = [
    { value: 'jefe', label: 'Jefe/Gerente' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'tecnico', label: 'Tecnico' },
    { value: 'hd', label: 'HD' },
    { value: 'bo', label: 'Back Office (BO)' },
    { value: 'noc', label: 'NOC' }
  ];

  empleadoOriginal: any = null;
  formHasChanges = false;
  private intervaloAutoRefresh: any;

  constructor() {
    this.fechaHoy = new Date().toISOString().split('T')[0];
    this.empForm = this.initForm();
  }

  ngOnInit() {
    this.cargarEmpleados();
    this.setupListeners();
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 5000);
  }

  ngOnDestroy() {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || this.vista !== 'lista' || this.mostrarModalEliminar) return;
    this.empService.getEmpleados().subscribe({
      next: (data) => {
        this.empleados = data;
        this.filtrar();
      }
    });
  }

  initForm(): FormGroup {
    return this.fb.group({
      id: [null],
      tipoDoc: ['DNI'],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]*$/), Validators.minLength(8), Validators.maxLength(8)]],
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      cumpleanos: [this.fechaHoy, Validators.required],
      ingreso: [this.fechaHoy, Validators.required],
      hobby: ['', Validators.maxLength(255)],
      descripcion: ['', Validators.maxLength(500)],
      cargo: ['', [Validators.required, Validators.maxLength(100)]],
      nivel: ['tecnico', Validators.required],
      username: ['', Validators.required],
      password: ['', [Validators.minLength(6)]],
      rol: ['tecnico', Validators.required],
      email: ['', [Validators.email, Validators.maxLength(100)]],
      foto: ['img/perfil.png'],
      usuarioActivo: [true],
      activo: [true]
    });
  }

  setupListeners() {
    this.empForm.get('dni')?.valueChanges.subscribe(value => {
      if (value && !this.isEditing) {
        this.empForm.patchValue({
          username: value,
          email: `${value}@ngr.com.pe`
        }, { emitEvent: false });
      }
    });

    this.empForm.get('tipoDoc')?.valueChanges.subscribe(tipo => {
      this.tipoDocumento = tipo;
      const dniControl = this.empForm.get('dni');
      dniControl?.setValue('');

      if (tipo === 'DNI') {
        dniControl?.setValidators([
          Validators.required,
          Validators.pattern(/^[0-9]*$/),
          Validators.minLength(8),
          Validators.maxLength(8)
        ]);
      } else {
        dniControl?.setValidators([
          Validators.required,
          Validators.pattern(/^[0-9]*$/),
          Validators.minLength(11),
          Validators.maxLength(11)
        ]);
      }
      dniControl?.updateValueAndValidity();
    });

    this.empForm.valueChanges.subscribe(() => {
      this.checkFormChanges();
    });
  }

  checkFormChanges() {
    if (!this.isEditing || !this.empleadoOriginal) {
      this.formHasChanges = false;
      return;
    }

    const formValue = this.empForm.getRawValue();

    const safeStr = (val: any): string => (val || '').toString().trim();
    const safeLower = (val: any): string => safeStr(val).toLowerCase();

    const cambioNombre = safeStr(formValue.nombre) !== safeStr(this.empleadoOriginal.nombre);
    const cambioCargo = safeStr(formValue.cargo) !== safeStr(this.empleadoOriginal.cargo);
    const cambioNivel = safeStr(formValue.nivel) !== safeStr(this.empleadoOriginal.nivel);
    const cambioRol = safeStr(formValue.rol) !== safeStr(this.empleadoOriginal.rol);
    const cambioCumple = safeStr(formValue.cumpleanos) !== safeStr(this.empleadoOriginal.cumpleanos);
    const cambioIngreso = safeStr(formValue.ingreso) !== safeStr(this.empleadoOriginal.ingreso);
    const cambioHobby = safeStr(formValue.hobby) !== safeStr(this.empleadoOriginal.hobby);
    const cambioDesc = safeStr(formValue.descripcion) !== safeStr(this.empleadoOriginal.descripcion);
    const cambioEmail = safeLower(formValue.email) !== safeLower(this.empleadoOriginal.email);
    const cambioUsername = safeStr(formValue.username) !== safeStr(this.empleadoOriginal.username);
    const cambioPassword = formValue.password && safeStr(formValue.password).length >= 6;
    const cambioUsuarioActivo = formValue.usuarioActivo !== this.empleadoOriginal.usuarioActivo;
    const cambioActivo = formValue.activo !== this.empleadoOriginal.activo;
    const cambioFoto = this.fotoFile !== null;

    const cambiosDetectados = cambioNombre || cambioCargo || cambioNivel || cambioRol ||
      cambioCumple || cambioIngreso || cambioHobby || cambioDesc || cambioEmail ||
      cambioUsername || cambioPassword || cambioUsuarioActivo || cambioActivo || cambioFoto;

    this.formHasChanges = cambiosDetectados;
    this.cdr.detectChanges();
  }

  guardar() {
    if (this.isEditing) {
      const errores = this.getFormValidationErrors();
      const passwordValue = this.empForm.get('password')?.value;
      if (errores.password && (!passwordValue || passwordValue.length === 0)) {
        delete errores.password;
      }

      if (Object.keys(errores).length > 0) {
        this.empForm.markAllAsTouched();
        this.mostrarError('Por favor, complete todos los campos requeridos correctamente.');
        return;
      }
    } else if (this.empForm.invalid) {
      this.empForm.markAllAsTouched();
      this.mostrarError('Por favor, complete todos los campos requeridos correctamente.');
      return;
    }

    this.isLoading = true;
    this.mensajeError = '';

    const formValue = this.empForm.getRawValue();

    if (this.isEditing && formValue.id) {
      this.actualizarEmpleado(formValue);
    } else {
      this.crearEmpleado(formValue);
    }
  }

  private getFormValidationErrors(): any {
    const errors: any = {};
    Object.keys(this.empForm.controls).forEach(key => {
      const control = this.empForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  private crearEmpleado(formValue: any) {
    const empleadoData = this.prepararPayloadCreacion(formValue);

    this.empService.createEmpleado(empleadoData).subscribe({
      next: (response) => {
        if (this.fotoFile && response.id) {
          this.subirImagenBackend(response.id, this.fotoFile);
        } else {
          this.procesarExito('Empleado creado exitosamente');
        }
      },
      error: (e) => this.procesarError(e, 'Error al crear empleado')
    });
  }

  private actualizarEmpleado(formValue: any) {
    const empleadoData = this.prepararPayloadEdicion(formValue);

    if (Object.keys(empleadoData).length === 0 && !this.fotoFile) {
      this.isLoading = false;
      this.mostrarMsg('No se detectaron cambios para actualizar');
      return;
    }

    if (Object.keys(empleadoData).length > 0) {
      this.empService.updateEmpleado(formValue.id, empleadoData).subscribe({
        next: () => {
          if (this.fotoFile) {
            this.subirImagenBackend(formValue.id, this.fotoFile);
          } else {
            this.procesarExito('Empleado actualizado correctamente');
          }
        },
        error: (e) => this.procesarError(e, 'Error al actualizar empleado')
      });
    } else if (this.fotoFile) {
      this.subirImagenBackend(formValue.id, this.fotoFile);
    }
  }

  private subirImagenBackend(empleadoId: number, file: File) {
    const formData = new FormData();
    formData.append('archivo', file);

    this.http.post(`${this.apiConfig.apiUrl}/imagenes/upload/${empleadoId}`, formData, {
      headers: {
        'Authorization': `Bearer ${this.authService.getToken()}`
      }
    }).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.procesarExito(this.isEditing ?
            'Empleado e imagen actualizados correctamente' :
            'Empleado creado exitosamente');
        } else if (response.error) {
          // Error en la respuesta pero con status 200
          this.procesarError({ error: { error: response.error } }, 'Error al subir imagen');
        }
      },
      error: (e) => {
        // Error HTTP (400, 500, etc.)
        const errorMsg = e.error?.error || e.error?.message || 'Error al subir la imagen';
        this.isLoading = false;
        this.mostrarError(errorMsg);
      }
    });
  }

  private prepararPayloadCreacion(formValue: any): any {
    return {
      dni: formValue.dni,
      nombre: formValue.nombre.trim(),
      cargo: formValue.cargo.trim(),
      nivel: formValue.nivel,
      rol: formValue.rol,
      usuarioActivo: formValue.usuarioActivo,
      activo: formValue.activo,
      cumpleanos: formValue.cumpleanos,
      ingreso: formValue.ingreso,
      hobby: formValue.hobby?.trim() || '',
      descripcion: formValue.descripcion?.trim() || '',
      username: formValue.username?.trim() || formValue.dni,
      email: formValue.email?.trim().toLowerCase() || `${formValue.dni}@ngr.com.pe`,
      foto: 'img/perfil.png',
      password: formValue.password?.trim() || 'password'
    };
  }

  private prepararPayloadEdicion(formValue: any): any {
    if (!this.empleadoOriginal) return {};

    const payload: any = {};
    const original = this.empleadoOriginal;

    if (formValue.nombre.trim() !== original.nombre) {
      payload.nombre = formValue.nombre.trim();
    }

    if (formValue.cargo.trim() !== original.cargo) {
      payload.cargo = formValue.cargo.trim();
    }

    if (formValue.nivel !== original.nivel) {
      payload.nivel = formValue.nivel;
    }

    if (formValue.rol !== original.rol && this.authService.isAdmin()) {
      payload.rol = formValue.rol;
    }

    if (formValue.usuarioActivo !== original.usuarioActivo) {
      payload.usuarioActivo = formValue.usuarioActivo;
    }

    if (formValue.activo !== original.activo) {
      payload.activo = formValue.activo;
    }

    if (formValue.cumpleanos !== original.cumpleanos) {
      payload.cumpleanos = formValue.cumpleanos;
    }

    if (formValue.ingreso !== original.ingreso) {
      payload.ingreso = formValue.ingreso;
    }

    const hobby = formValue.hobby?.trim() ?? '';
    const descripcion = formValue.descripcion?.trim() ?? '';
    const email = formValue.email?.trim().toLowerCase();

    const originalHobby = original.hobby ?? '';
    if (hobby !== originalHobby) {
      payload.hobby = hobby;
    }

    const originalDescripcion = original.descripcion ?? '';
    if (descripcion !== originalDescripcion) {
      payload.descripcion = descripcion;
    }

    if (email !== (original.email || '')) {
      payload.email = email || null;
    }

    const username = formValue.username?.trim();
    if (username && username !== original.username) {
      payload.username = username;
    }

    const password = formValue.password?.trim();
    if (password && password.length >= 6) {
      payload.password = password;
    }

    if (formValue.foto &&
        formValue.foto !== 'img/perfil.png' &&
        formValue.foto !== original.foto) {
      payload.foto = formValue.foto;
    }

    return payload;
  }

  private procesarExito(mensaje: string) {
    this.isLoading = false;
    this.mostrarMsg(mensaje);
    this.cambiarVista('lista');
    this.empleadoOriginal = null;
    this.formHasChanges = false;
  }

  private procesarError(error: any, mensajeBase: string) {
    this.isLoading = false;
    const errorMsg = error.error?.error || error.message || 'Error desconocido';
    this.mostrarError(`${mensajeBase}: ${errorMsg}`);
  }

  puedeEditarEmpleado(empleado: EmpleadoResponse): boolean {
    const userRole = this.authService.getUserRole();

    if (userRole === 'admin') {
      return true;
    }

    if (userRole === 'supervisor') {
      const currentUser = this.authService.getCurrentEmpleado();
      const esMiPerfil = currentUser && currentUser.id === empleado.id;

      if (esMiPerfil) {
        return true;
      }

      const empleadoRol = empleado.rol?.toLowerCase();
      const rolesPermitidos = ['tecnico', 'hd', 'noc'];
      return rolesPermitidos.includes(empleadoRol || '');
    }

    return false;
  }

  getTooltipEdicion(empleado: EmpleadoResponse): string {
    if (this.isLoading) return 'Espere...';

    if (!this.puedeEditarEmpleado(empleado)) {
      const userRole = this.authService.getUserRole();
      const empleadoRol = empleado.rol?.toLowerCase();

      if (userRole === 'supervisor') {
        if (empleadoRol === 'admin') {
          return 'No puede editar administradores';
        }
        if (empleadoRol === 'supervisor') {
          return 'No puede editar otros supervisores';
        }
      }
      return 'No tiene permisos para editar este usuario';
    }

    return 'Editar empleado';
  }

  puedeEliminarEmpleado(empleado: EmpleadoResponse): boolean {
    const userRole = this.authService.getUserRole();

    if (userRole === 'admin') {
      return true;
    }

    if (userRole === 'supervisor') {
      const currentUser = this.authService.getCurrentEmpleado();
      const esMiPerfil = currentUser && currentUser.id === empleado.id;

      if (esMiPerfil) {
        return false;
      }

      const empleadoRol = empleado.rol?.toLowerCase();
      if (empleadoRol === 'admin' || empleadoRol === 'supervisor') {
        return false;
      }

      const rolesPermitidos = ['tecnico', 'hd', 'noc'];
      return rolesPermitidos.includes(empleadoRol || '');
    }

    return false;
  }

  puedeCambiarEstadoEmpleado(empleado: EmpleadoResponse): boolean {
    const userRole = this.authService.getUserRole();

    if (userRole === 'admin') {
      return true;
    }

    if (userRole === 'supervisor') {
      const currentUser = this.authService.getCurrentEmpleado();
      const esMiPerfil = currentUser && currentUser.id === empleado.id;

      if (esMiPerfil) {
        return false;
      }

      const empleadoRol = empleado.rol?.toLowerCase();
      if (empleadoRol === 'admin' || empleadoRol === 'supervisor') {
        return false;
      }

      const rolesPermitidos = ['tecnico', 'hd', 'noc'];
      return rolesPermitidos.includes(empleadoRol || '');
    }

    return false;
  }

  getTooltipEliminar(empleado: EmpleadoResponse): string {
    if (this.isLoading) return 'Espere...';

    if (!this.puedeEliminarEmpleado(empleado)) {
      const userRole = this.authService.getUserRole();
      const currentUser = this.authService.getCurrentEmpleado();
      const esMiPerfil = currentUser && currentUser.id === empleado.id;
      const empleadoRol = empleado.rol?.toLowerCase();

      if (userRole === 'supervisor') {
        if (esMiPerfil) {
          return 'No puede eliminarse a si mismo';
        }
        if (empleadoRol === 'admin') {
          return 'No puede eliminar administradores';
        }
        if (empleadoRol === 'supervisor') {
          return 'No puede eliminar otros supervisores';
        }
      }
      return 'No tiene permisos para eliminar este usuario';
    }

    return 'Eliminar usuario permanentemente';
  }

  getTooltipEstado(empleado: EmpleadoResponse): string {
    if (this.isLoading) return 'Espere...';

    if (!this.puedeCambiarEstadoEmpleado(empleado)) {
      const userRole = this.authService.getUserRole();
      const currentUser = this.authService.getCurrentEmpleado();
      const esMiPerfil = currentUser && currentUser.id === empleado.id;
      const empleadoRol = empleado.rol?.toLowerCase();

      if (userRole === 'supervisor') {
        if (esMiPerfil) {
          return 'No puede cambiar su propio estado';
        }
        if (empleadoRol === 'admin') {
          return 'No puede cambiar estado de administradores';
        }
        if (empleadoRol === 'supervisor') {
          return 'No puede cambiar estado de otros supervisores';
        }
      }
      return 'No tiene permisos para cambiar el estado';
    }

    return empleado.usuarioActivo ? 'Desactivar usuario' : 'Activar usuario';
  }

  puedeCambiarEstadoEnFormulario(): boolean {
    if (!this.isEditing || !this.empleadoOriginal) {
      return true;
    }

    const userRole = this.authService.getUserRole();

    if (userRole === 'admin') {
      return true;
    }

    if (userRole === 'supervisor') {
      const currentUser = this.authService.getCurrentEmpleado();
      const esMiPerfil = currentUser && currentUser.id === this.empleadoOriginal.id;

      if (esMiPerfil) {
        return false;
      }

      const empleadoRol = this.empleadoOriginal.rol?.toLowerCase();
      if (empleadoRol === 'admin' || empleadoRol === 'supervisor') {
        return false;
      }

      return true;
    }

    return false;
  }

  getEstadoTooltipCompleto(empleado: EmpleadoResponse): string {
    const estados = [];

    if (empleado.usuarioActivo) {
      estados.push('Puede iniciar sesion');
    } else {
      estados.push('No puede iniciar sesion');
    }

    if (empleado.activo) {
      estados.push('Activo en empresa');
      estados.push('Aparece en organigrama');
    } else {
      estados.push('Inactivo en empresa');
      estados.push('Oculto en organigrama');
    }

    return estados.join('\n');
  }

  editar(emp: EmpleadoResponse) {
    if (!this.puedeGestionarEmpleados()) {
      this.mostrarError('No tiene permisos para editar empleados');
      return;
    }

    if (!this.puedeEditarEmpleado(emp)) {
      this.mostrarError('No tiene permisos para editar este tipo de usuario');
      return;
    }

    this.isEditing = true;
    this.vista = 'formulario';
    this.fotoPreview = null;
    this.fotoFile = null;
    this.formHasChanges = false;

    const tipo = (emp.dni.length > 8) ? 'CE' : 'DNI';
    this.tipoDocumento = tipo;

    this.empleadoOriginal = {
      id: emp.id,
      dni: emp.dni,
      nombre: emp.nombre,
      cargo: emp.cargo || '',
      nivel: emp.nivel || 'tecnico',
      rol: emp.rol || 'tecnico',
      usuarioActivo: emp.usuarioActivo ?? true,
      activo: emp.activo ?? true,
      cumpleanos: this.formatearFechaParaInput(emp.cumpleanos),
      ingreso: this.formatearFechaParaInput(emp.ingreso),
      hobby: emp.hobby || '',
      descripcion: emp.descripcion || '',
      username: emp.username || emp.dni,
      email: emp.email || `${emp.dni}@ngr.com.pe`,
      foto: emp.foto || 'img/perfil.png'
    };

    this.fotoActual = emp.foto || 'img/perfil.png';

    if (this.fotoActual && this.fotoActual !== 'img/perfil.png') {
      this.fotoPreview = this.getFotoUrl(this.fotoActual, emp.nombre);
    } else {
      this.fotoPreview = this.getAvatarPlaceholder(emp.nombre);
    }

    this.empForm.patchValue({
      id: emp.id,
      tipoDoc: tipo,
      dni: emp.dni,
      nombre: emp.nombre,
      cumpleanos: this.empleadoOriginal.cumpleanos,
      ingreso: this.empleadoOriginal.ingreso,
      hobby: emp.hobby || '',
      descripcion: emp.descripcion || '',
      cargo: emp.cargo || '',
      nivel: emp.nivel || 'tecnico',
      username: emp.username || emp.dni,
      password: '',
      rol: emp.rol || 'tecnico',
      email: emp.email || `${emp.dni}@ngr.com.pe`,
      foto: emp.foto || 'img/perfil.png',
      usuarioActivo: emp.usuarioActivo ?? true,
      activo: emp.activo ?? true
    }, { emitEvent: false });

    const passwordControl = this.empForm.get('password');
    if (passwordControl) {
      passwordControl.clearValidators();
      passwordControl.updateValueAndValidity({ emitEvent: false });
    }

    this.empForm.markAsPristine();
    this.empForm.markAsUntouched();
  }

  async cambiarEstado(id: number, nuevoEstado: boolean) {
    if (!this.puedeGestionarEmpleados()) {
      this.mostrarError('No tiene permisos para cambiar el estado de usuarios');
      return;
    }

    const accion = nuevoEstado ? 'activar' : 'desactivar';
    const tipo = nuevoEstado ? 'success' : 'warning';
    const confirmText = nuevoEstado
      ? 'Activar este usuario? Podra iniciar sesion y aparecera en el sistema.'
      : 'Desactivar este usuario? No podra iniciar sesion pero permanecera en registros.';

    const confirmado = await this.notification.confirm({
      title: nuevoEstado ? 'Activar usuario' : 'Desactivar usuario',
      message: confirmText,
      confirmText: nuevoEstado ? 'Si, activar' : 'Si, desactivar',
      cancelText: 'Cancelar',
      type: tipo as 'success' | 'warning'
    });

    if (!confirmado) {
      const index = this.empleados.findIndex(e => e.id === id);
      if (index !== -1) {
        this.empleados[index].usuarioActivo = !nuevoEstado;
        this.filtrar();
      }
      return;
    }

    this.isLoading = true;
    this.empService.cambiarEstadoUsuario(id, nuevoEstado).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.mostrarMsg(`Usuario ${accion}do correctamente`);
        const index = this.empleados.findIndex(e => e.id === id);
        if (index !== -1) {
          this.empleados[index].usuarioActivo = nuevoEstado;
          this.empleados[index].activo = nuevoEstado;
          this.filtrar();
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.handleError(error);
        const index = this.empleados.findIndex(e => e.id === id);
        if (index !== -1) {
          this.empleados[index].usuarioActivo = !nuevoEstado;
          this.filtrar();
        }
      }
    });
  }

  exportarExcel() {
    this.isLoading = true;
    this.empService.exportarEmpleados().subscribe({
      next: (response: any) => {
        const datos = response.datos || [];
        if (datos.length > 0) {
          this.exportService.exportToExcel(datos, 'empleados_ngr', 'Empleados');
        } else {
          this.notification.warning('No hay datos para exportar', 'Sin datos');
        }
        this.isLoading = false;
      },
      error: (e) => {
        this.notification.error('Error al exportar datos a Excel', 'Error');
        this.isLoading = false;
      }
    });
  }

  exportarPDF() {
    this.isLoading = true;
    this.empService.exportarEmpleados().subscribe({
      next: (response: any) => {
        const datos = response.datos || [];
        if (datos.length > 0) {
          const columnas = [
            { header: 'ID', dataKey: 'ID' },
            { header: 'DNI', dataKey: 'DNI' },
            { header: 'Nombre', dataKey: 'Nombre' },
            { header: 'Cargo', dataKey: 'Cargo' },
            { header: 'Nivel', dataKey: 'Nivel' },
            { header: 'Email', dataKey: 'Email' },
            { header: 'Usuario', dataKey: 'Usuario' },
            { header: 'Rol', dataKey: 'Rol' },
            { header: 'Estado', dataKey: 'Activo' }
          ];

          this.exportService.exportToPDF(datos, columnas, {
            title: 'Reporte de Empleados - NGR',
            filename: 'empleados_ngr'
          });
        } else {
          this.notification.warning('No hay datos para exportar', 'Sin datos');
        }
        this.isLoading = false;
      },
      error: (e) => {
        this.notification.error('Error al exportar datos a PDF', 'Error');
        this.isLoading = false;
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/bmp'];

      // Verificar tipo MIME
      if (!validTypes.includes(file.type)) {
        this.mostrarError('Solo se permiten imagenes JPG, PNG, GIF o BMP. WebP no es soportado.');
        event.target.value = '';
        return;
      }

      // Verificar extensión del archivo
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.webp')) {
        this.mostrarError('Formato WebP no soportado. Use JPG, PNG, GIF o BMP.');
        event.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.mostrarError('La imagen no debe superar los 5MB');
        event.target.value = '';
        return;
      }

      this.fotoFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.fotoPreview = e.target?.result || null;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);

      this.empForm.markAsDirty();
      this.checkFormChanges();
      this.cdr.detectChanges();
    }
  }

  cancelarSeleccionImagen() {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.fotoFile = null;
    this.fotoPreview = this.fotoActual ?
      this.getFotoUrl(this.fotoActual, this.empForm.get('nombre')?.value) :
      this.getAvatarPlaceholder(this.empForm.get('nombre')?.value);
    this.checkFormChanges();
    this.cdr.detectChanges();
  }

  private formatearFechaParaInput(fecha: string | undefined): string {
    if (!fecha) return this.fechaHoy;
    try {
      if (fecha.includes('/')) {
        const [day, month, year] = fecha.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      return fecha.split('T')[0];
    } catch {
      return this.fechaHoy;
    }
  }

  cargarEmpleados() {
    this.isLoading = true;
    this.empService.getEmpleados().subscribe({
      next: (data) => {
        this.empleados = data;
        this.filtrar();
        this.isLoading = false;
      },
      error: (error) => {
        this.mostrarError('Error al cargar la lista de empleados');
        this.isLoading = false;
      }
    });
  }

  eliminar(emp: EmpleadoResponse) {
    if (!this.puedeGestionarEmpleados()) {
      this.mostrarError('No tiene permisos para eliminar empleados');
      return;
    }

    this.empleadoAEliminar = emp;
    this.mostrarModalEliminar = true;
  }

  cancelarEliminar() {
    this.mostrarModalEliminar = false;
    this.empleadoAEliminar = null;
  }

  confirmarEliminar() {
    if (!this.empleadoAEliminar || !this.empleadoAEliminar.id) {
      this.cancelarEliminar();
      return;
    }

    this.isLoading = true;
    this.empService.deleteEmpleado(this.empleadoAEliminar.id).subscribe({
      next: (response) => {
        this.mostrarMsg('Usuario eliminado permanentemente');
        this.cancelarEliminar();
        this.cargarEmpleados();
      },
      error: (error) => {
        this.handleError(error);
        this.isLoading = false;
        this.cancelarEliminar();
      }
    });
  }

  filtrar() {
    const term = this.filtroBusqueda.toLowerCase().trim();
    if (!term) {
      this.empleadosFiltrados = [...this.empleados];
      return;
    }

    this.empleadosFiltrados = this.empleados.filter(e =>
      e.nombre.toLowerCase().includes(term) ||
      e.dni.includes(term) ||
      (e.email && e.email.toLowerCase().includes(term)) ||
      (e.cargo && e.cargo.toLowerCase().includes(term)) ||
      (e.username && e.username.toLowerCase().includes(term))
    );
  }

  cambiarVista(v: 'lista' | 'formulario') {
    this.vista = v;
    if (v === 'lista') {
      this.cargarEmpleados();
      this.isEditing = false;
      this.fotoPreview = null;
      this.fotoFile = null;
      this.fotoActual = null;
      this.empleadoOriginal = null;
      this.formHasChanges = false;
      this.empForm.reset(this.initForm().value);
      this.tipoDocumento = 'DNI';
      this.mensajeError = '';
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
    }
  }

  volverAlDashboard() {
    this.router.navigate(['/dashboard']);
  }

  mostrarMsg(msg: string) {
    this.notification.success(msg, 'Exitoso');
  }

  mostrarError(msg: string) {
    this.notification.error(msg, 'Error');
  }

  handleError(e: any) {
    const errorMsg = e.error?.error || e.message || 'Error desconocido';
    this.mostrarError(`Error: ${errorMsg}`);
  }

  esInvalido(campo: string): boolean {
    const control = this.empForm.get(campo);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  puedeGestionarEmpleados(): boolean {
    return this.authService.puedeGestionarEmpleados();
  }

  getFotoUrl(fotoPath: string | undefined, nombre: string): string {
    if (!fotoPath || fotoPath === 'img/perfil.png') {
      return this.getAvatarPlaceholder(nombre);
    }

    if (fotoPath.startsWith('http')) {
      return fotoPath;
    }

    return `${this.apiConfig.baseUrl}/${fotoPath}`;
  }

  handleImageError(event: any, nombre: string): void {
    event.target.src = this.getAvatarPlaceholder(nombre);
  }

  private getAvatarPlaceholder(nombre: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0d6efd&color=fff&size=150`;
  }

  getRolDisplay(rol: string): string {
    switch(rol?.toLowerCase()) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'tecnico': return 'Tecnico';
      case 'hd': return 'HD';
      case 'noc': return 'NOC';
      default: return rol || 'Sin rol';
    }
  }

  getNivelDisplay(nivel: string): string {
    switch(nivel?.toLowerCase()) {
      case 'jefe': return 'Jefe/Gerente';
      case 'supervisor': return 'Supervisor';
      case 'tecnico': return 'Tecnico';
      case 'hd': return 'HD';
      case 'bo': return 'Back Office';
      case 'noc': return 'NOC';
      default: return nivel || 'Sin nivel';
    }
  }

  isFormValid(): boolean {
    if (this.isLoading) return false;

    if (!this.isEditing) {
      return this.empForm.valid;
    }

    const tieneCambios = this.formHasChanges || this.fotoFile !== null;

    const nombreValido = this.empForm.get('nombre')?.valid ?? true;
    const cargoValido = this.empForm.get('cargo')?.valid ?? true;
    const nivelValido = this.empForm.get('nivel')?.valid ?? true;
    const dniValido = this.empForm.get('dni')?.valid ?? true;

    const passwordValue = this.empForm.get('password')?.value;
    const passwordValido = !passwordValue || passwordValue.length === 0 || passwordValue.length >= 6;

    return nombreValido && cargoValido && nivelValido && dniValido && passwordValido && tieneCambios;
  }

  getEstadoTooltip(estado: boolean | undefined): string {
    if (estado === undefined) return 'Estado no definido';
    return estado
      ? 'Usuario activo - Puede iniciar sesion y aparece en el organigrama'
      : 'Usuario inactivo - No puede iniciar sesion pero permanece en registros';
  }

  getEstadoTexto(estado: boolean | undefined): string {
    if (estado === undefined) return 'Indefinido';
    return estado ? 'Activo' : 'Inactivo';
  }

  getEstadoColor(estado: boolean | undefined): string {
    if (estado === undefined) return 'secondary';
    return estado ? 'success' : 'danger';
  }

  getEstadoIcono(estado: boolean | undefined): string {
    if (estado === undefined) return 'bi-question-circle';
    return estado ? 'bi-person-check' : 'bi-person-x';
  }
}
