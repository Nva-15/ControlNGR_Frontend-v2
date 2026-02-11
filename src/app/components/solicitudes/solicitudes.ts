import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SolicitudesService } from '../../services/solicitudes';
import { AuthService } from '../../services/auth';
import { ExportService } from '../../services/export';
import { SolicitudResponse } from '../../interfaces/solicitud';
import { ActivatedRoute } from '@angular/router';
import { EmpleadosService } from '../../services/empleados';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { NotificacionesService } from '../../services/notificaciones';

@Component({
  selector: 'app-solicitudes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitudes.html'
})
export class SolicitudesComponent implements OnInit, OnDestroy {
  private solicitudesService = inject(SolicitudesService);
  private authService = inject(AuthService);
  private exportService = inject(ExportService);
  private empleadosService = inject(EmpleadosService);
  private route = inject(ActivatedRoute);
  private notification = inject(NotificationService);
  private notificacionesService = inject(NotificacionesService);

  currentUser: any;
  misSolicitudes: SolicitudResponse[] = [];
  solicitudesPendientes: SolicitudResponse[] = [];
  historialGlobal: SolicitudResponse[] = [];
  todosEmpleados: any[] = [];

  filtroEstadoMisSolicitudes = '';
  filtroTipoMisSolicitudes = '';
  filtroPeriodoMisSolicitudes = '7d';
  filtroFechaInicioMisSolicitudes = '';
  filtroFechaFinMisSolicitudes = '';

  filtroTipoPendientes = '';
  filtroRolPendientes = '';
  filtroEmpleadoPendientes = '';
  filtroFechaInicioPendientes = '';
  filtroFechaFinPendientes = '';

  filtroRolHistorial = '';
  filtroTipoHistorial = '';
  filtroEstadoHistorial = '';
  filtroEmpleadoHistorial = '';
  filtroFechaInicioHistorial = '';
  filtroFechaFinHistorial = '';
  filtroPeriodoHistorial = '7d';

  nuevaSolicitud = {
    tipo: 'vacaciones',
    fechaInicio: '',
    fechaFin: '',
    motivo: ''
  };

  tieneConflictos = false;
  mensajeConflictos = '';
  conflictosDetectados: any[] = [];
  mostrarModalConflictos = false;
  accionPendiente: 'crear' | 'editar' | null = null;

  solicitudEditando: SolicitudResponse | null = null;
  editandoSolicitud = {
    id: 0,
    tipo: 'vacaciones',
    fechaInicio: '',
    fechaFin: '',
    motivo: '',
    estado: 'pendiente'
  };
  modoEdicion = false;

  activeTab = 'mis-solicitudes';
  isLoading = false;
  mensaje = '';
  exportando = false;

  private intervaloAutoRefresh: any;

  mostrarModalGestion = false;
  comentarioGestion = '';
  solicitudGestionandoId: number | null = null;
  estadoGestionando = '';

  ngOnInit() {
    this.currentUser = this.authService.getCurrentEmpleado();

    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      } else if (this.esJefe()) {
        this.activeTab = 'aprobar';
      }
    });

    this.cargarDatos();
    if (this.esJefe()) {
      this.cargarTodosEmpleados();
    }

    // Limpiar badge de solicitudes al entrar a la pagina
    this.notificacionesService.limpiarSolicitudes();

    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 5000);
  }

  ngOnDestroy() {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || this.mostrarModalConflictos || this.mostrarModalGestion || this.activeTab === 'crear') return;
    this.solicitudesService.getMisSolicitudes(this.currentUser.id).subscribe({
      next: (data) => this.misSolicitudes = data
    });
    if (this.esJefe()) {
      this.solicitudesService.getPendientes().subscribe({
        next: (data) => this.solicitudesPendientes = data
      });
      this.solicitudesService.getHistorial().subscribe({
        next: (data) => this.historialGlobal = data
      });
    }
  }

  esAdmin(): boolean {
    return this.authService.isAdmin();
  }

  esSupervisor(): boolean {
    return this.authService.isSupervisor();
  }

  esJefe(): boolean {
    return this.esAdmin() || this.esSupervisor();
  }

  puedeEditarSolicitud(solicitud: SolicitudResponse): boolean {
    if (!solicitud.estado || !this.currentUser) return false;
    const esMiSolicitud = solicitud.empleadoId === this.currentUser.id;
    return esMiSolicitud && solicitud.estado === 'pendiente';
  }

  puedeCorregirEstado(solicitud: SolicitudResponse): boolean {
    if (!solicitud.estado || !this.currentUser) return false;
    if (!['aprobado', 'rechazado'].includes(solicitud.estado)) return false;

    // Si la fecha fin de la solicitud ya paso (antes de hoy), no permitir cambio
    if (solicitud.fechaFin) {
      const fechaFinStr = solicitud.fechaFin.split('T')[0];
      const hoy = this.getFechaActual();
      if (fechaFinStr < hoy) return false;
    }

    const esMiSolicitud = solicitud.empleadoId === this.currentUser.id;
    if (esMiSolicitud) return false;

    const rolSolicitud = this.obtenerRolEmpleado(solicitud.empleadoId);

    if (['tecnico', 'hd', 'noc'].includes(rolSolicitud)) {
      return this.esJefe();
    }

    if (rolSolicitud === 'supervisor') {
      return this.esAdmin();
    }

    return this.esAdmin();
  }

  async corregirEstado(id: number, nuevoEstado: string) {
    if (nuevoEstado === 'rechazado') {
      this.solicitudGestionandoId = id;
      this.estadoGestionando = nuevoEstado;
      this.comentarioGestion = '';
      this.mostrarModalGestion = true;
      return;
    }

    const confirmado = await this.notification.confirm({
      title: 'Corregir estado',
      message: 'Confirma que desea cambiar el estado de esta solicitud a APROBADO?',
      confirmText: 'Si, corregir',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmado) return;

    this.solicitudesService.gestionarSolicitud(id, nuevoEstado, this.currentUser.id).subscribe({
      next: () => {
        this.cargarDatos();
        this.notification.success('Estado corregido a APROBADO correctamente', 'Estado corregido');
      },
      error: (err) => this.notification.error(err || 'Error al corregir el estado', 'Error')
    });
  }

  cargarDatos() {
    this.cargarMisSolicitudes();
    if (this.esJefe()) {
      this.cargarPendientes();
      this.cargarHistorialGlobal();
    }
  }

  cargarTodosEmpleados() {
    this.empleadosService.getEmpleados().subscribe({
      next: (data) => {
        this.todosEmpleados = data;
        if (this.esAdmin()) {
          this.filtroRolPendientes = 'supervisor';
          this.filtroRolHistorial = 'supervisor';
        } else if (this.esSupervisor()) {
          this.filtroRolPendientes = 'tecnico';
          this.filtroRolHistorial = 'tecnico';
        }
      }
    });
  }

  cargarMisSolicitudes() {
    this.isLoading = true;
    this.solicitudesService.getMisSolicitudes(this.currentUser.id).subscribe({
      next: (data) => {
        this.misSolicitudes = data;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  cargarPendientes() {
    this.solicitudesService.getPendientes().subscribe({
      next: (data) => {
        this.solicitudesPendientes = data;
      }
    });
  }

  cargarHistorialGlobal() {
    this.solicitudesService.getHistorial().subscribe({
      next: (data) => {
        this.historialGlobal = data;
      }
    });
  }

  crearSolicitud() {
    if (!this.nuevaSolicitud.fechaInicio || !this.nuevaSolicitud.fechaFin) {
      this.notification.warning('Por favor selecciona las fechas de inicio y fin', 'Campos requeridos');
      return;
    }

    if (!this.nuevaSolicitud.motivo || !this.nuevaSolicitud.motivo.trim()) {
      this.notification.warning('Por favor ingresa el motivo de la solicitud', 'Campos requeridos');
      return;
    }

    if (this.nuevaSolicitud.fechaInicio > this.nuevaSolicitud.fechaFin) {
      this.notification.warning('La fecha de fin no puede ser anterior a la fecha de inicio', 'Fechas invalidas');
      return;
    }

    this.isLoading = true;

    // Primero verificar si el usuario ya tiene una solicitud en ese rango
    this.solicitudesService.verificarConflictos(
      this.currentUser.id,
      this.nuevaSolicitud.fechaInicio,
      this.nuevaSolicitud.fechaFin
    ).subscribe({
      next: (responsePropio) => {
        if (responsePropio.tieneConflictos && responsePropio.conflictos && responsePropio.conflictos.length > 0) {
          // El usuario ya tiene una solicitud en ese rango
          this.notification.error('Ya tienes una solicitud en este rango de fechas', 'Conflicto de fechas');
          this.isLoading = false;
          return;
        }

        // Si no hay conflictos propios, verificar conflictos por rol
        this.solicitudesService.verificarConflictosPorRol(
          this.currentUser.id,
          this.currentUser.rol,
          this.nuevaSolicitud.fechaInicio,
          this.nuevaSolicitud.fechaFin
        ).subscribe({
          next: (response) => {
            if (response.tieneConflictos && response.conflictos && response.conflictos.length > 0) {
              this.tieneConflictos = true;
              this.mensajeConflictos = response.mensaje;
              this.conflictosDetectados = response.conflictos;
              this.accionPendiente = 'crear';
              this.mostrarModalConflictos = true;
              this.isLoading = false;
            } else {
              this.enviarSolicitud();
            }
          },
          error: () => {
            this.enviarSolicitud();
          }
        });
      },
      error: () => {
        // Si hay error en la verificación propia, continuar con la verificación por rol
        this.solicitudesService.verificarConflictosPorRol(
          this.currentUser.id,
          this.currentUser.rol,
          this.nuevaSolicitud.fechaInicio,
          this.nuevaSolicitud.fechaFin
        ).subscribe({
          next: (response) => {
            if (response.tieneConflictos && response.conflictos && response.conflictos.length > 0) {
              this.tieneConflictos = true;
              this.mensajeConflictos = response.mensaje;
              this.conflictosDetectados = response.conflictos;
              this.accionPendiente = 'crear';
              this.mostrarModalConflictos = true;
              this.isLoading = false;
            } else {
              this.enviarSolicitud();
            }
          },
          error: () => {
            this.enviarSolicitud();
          }
        });
      }
    });
  }

  private enviarSolicitud() {
    const payload = {
      empleadoId: this.currentUser.id,
      ...this.nuevaSolicitud
    };

    this.solicitudesService.crearSolicitud(payload).subscribe({
      next: (response) => {
        if (response.tieneNotaConflicto) {
          this.notification.info('Se detectaron conflictos de fechas. Se ha agregado una nota informativa en el motivo.', 'Solicitud enviada');
        } else {
          this.notification.success('Tu solicitud ha sido registrada correctamente.', 'Solicitud enviada');
        }

        this.cargarDatos();
        this.limpiarFormulario();
        if (this.activeTab === 'crear') this.activeTab = 'mis-solicitudes';
        this.tieneConflictos = false;
        this.mensajeConflictos = '';
        this.conflictosDetectados = [];
        this.isLoading = false;
      },
      error: (err) => {
        this.notification.error(err || 'Error al procesar solicitud', 'Error');
        this.isLoading = false;
      }
    });
  }

  cancelarCreacion() {
    this.limpiarFormulario();
    this.activeTab = this.esJefe() ? 'aprobar' : 'mis-solicitudes';
  }

  cargarSolicitudParaEditar(solicitud: SolicitudResponse) {
    if (!this.puedeEditarSolicitud(solicitud)) {
      this.notification.error('No tiene permisos para editar esta solicitud', 'Acceso denegado');
      return;
    }

    this.modoEdicion = true;
    this.solicitudEditando = solicitud;

    const fechaInicioRaw = solicitud.fechaInicio || '';
    const fechaFinRaw = solicitud.fechaFin || '';

    const fechaInicio = fechaInicioRaw.split('T')[0];
    const fechaFin = fechaFinRaw.split('T')[0];

    this.editandoSolicitud = {
      id: solicitud.id || 0,
      tipo: solicitud.tipo || 'vacaciones',
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      motivo: solicitud.motivo || '',
      estado: solicitud.estado || 'pendiente'
    };

    this.activeTab = 'crear';
  }

  guardarEdicion() {
    if (!this.editandoSolicitud.fechaInicio || !this.editandoSolicitud.fechaFin) {
      this.notification.warning('Por favor selecciona las fechas de inicio y fin', 'Campos requeridos');
      return;
    }

    if (!this.editandoSolicitud.motivo || !this.editandoSolicitud.motivo.trim()) {
      this.notification.warning('Por favor ingresa el motivo de la solicitud', 'Campos requeridos');
      return;
    }

    if (this.editandoSolicitud.fechaInicio > this.editandoSolicitud.fechaFin) {
      this.notification.warning('La fecha de fin no puede ser anterior a la fecha de inicio', 'Fechas invalidas');
      return;
    }

    this.isLoading = true;

    // Verificar si el usuario ya tiene otra solicitud en ese rango (excluyendo la actual)
    this.solicitudesService.verificarConflictos(
      this.currentUser.id,
      this.editandoSolicitud.fechaInicio,
      this.editandoSolicitud.fechaFin
    ).subscribe({
      next: (responsePropio) => {
        if (responsePropio.tieneConflictos && responsePropio.conflictos) {
          const conflictosPropio = responsePropio.conflictos.filter((c: any) => c.id !== this.editandoSolicitud.id);
          if (conflictosPropio.length > 0) {
            this.notification.error('Ya tienes otra solicitud en este rango de fechas', 'Conflicto de fechas');
            this.isLoading = false;
            return;
          }
        }

        // Si no hay conflictos propios, verificar conflictos por rol
        this.solicitudesService.verificarConflictosPorRol(
          this.currentUser.id,
          this.currentUser.rol,
          this.editandoSolicitud.fechaInicio,
          this.editandoSolicitud.fechaFin
        ).subscribe({
          next: (response) => {
            if (response.tieneConflictos && response.conflictos) {
              const conflictosFiltrados = response.conflictos.filter((c: any) => c.id !== this.editandoSolicitud.id);
              if (conflictosFiltrados.length > 0) {
                this.tieneConflictos = true;
                this.mensajeConflictos = response.mensaje;
                this.conflictosDetectados = conflictosFiltrados;
                this.accionPendiente = 'editar';
                this.mostrarModalConflictos = true;
                this.isLoading = false;
              } else {
                this.actualizarSolicitud();
              }
            } else {
              this.actualizarSolicitud();
            }
          },
          error: () => this.actualizarSolicitud()
        });
      },
      error: () => {
        // Si hay error en la verificación propia, continuar con verificación por rol
        this.solicitudesService.verificarConflictosPorRol(
          this.currentUser.id,
          this.currentUser.rol,
          this.editandoSolicitud.fechaInicio,
          this.editandoSolicitud.fechaFin
        ).subscribe({
          next: (response) => {
            if (response.tieneConflictos && response.conflictos) {
              const conflictosFiltrados = response.conflictos.filter((c: any) => c.id !== this.editandoSolicitud.id);
              if (conflictosFiltrados.length > 0) {
                this.tieneConflictos = true;
                this.mensajeConflictos = response.mensaje;
                this.conflictosDetectados = conflictosFiltrados;
                this.accionPendiente = 'editar';
                this.mostrarModalConflictos = true;
                this.isLoading = false;
              } else {
                this.actualizarSolicitud();
              }
            } else {
              this.actualizarSolicitud();
            }
          },
          error: () => this.actualizarSolicitud()
        });
      }
    });
  }

  private actualizarSolicitud() {
    const payload: any = {
      tipo: this.editandoSolicitud.tipo,
      fechaInicio: this.editandoSolicitud.fechaInicio,
      fechaFin: this.editandoSolicitud.fechaFin,
      motivo: this.editandoSolicitud.motivo
    };

    if (this.esJefe() && this.editandoSolicitud.id) {
      const esMiSolicitud = this.misSolicitudes.some(s => s.id === this.editandoSolicitud.id);
      if (!esMiSolicitud) {
        payload.estado = this.editandoSolicitud.estado;
      }
    }

    this.solicitudesService.editarSolicitud(this.editandoSolicitud.id, payload).subscribe({
      next: () => {
        this.notification.success('La solicitud ha sido actualizada correctamente.', 'Solicitud actualizada');
        this.cargarDatos();
        this.cancelarEdicion();
        this.isLoading = false;
      },
      error: (err) => {
        this.notification.error(err || 'Error al actualizar solicitud', 'Error');
        this.isLoading = false;
      }
    });
  }

  cancelarEdicion() {
    this.modoEdicion = false;
    this.solicitudEditando = null;
    this.editandoSolicitud = {
      id: 0,
      tipo: 'vacaciones',
      fechaInicio: '',
      fechaFin: '',
      motivo: '',
      estado: 'pendiente'
    };
    this.tieneConflictos = false;
    this.mensajeConflictos = '';
    this.conflictosDetectados = [];
    this.limpiarFormulario();
    this.activeTab = this.esJefe() ? 'aprobar' : 'mis-solicitudes';
  }

  get misSolicitudesFiltradas() {
    const fechaCorte = this.getFechaCorte(this.filtroPeriodoMisSolicitudes);

    return this.misSolicitudes.filter(sol => {
      let matchEstado = true;
      let matchTipo = true;
      let matchPeriodo = true;

      if (this.filtroEstadoMisSolicitudes) {
        matchEstado = sol.estado === this.filtroEstadoMisSolicitudes;
      }

      if (this.filtroTipoMisSolicitudes) {
        matchTipo = sol.tipo === this.filtroTipoMisSolicitudes;
      }

      if (fechaCorte && sol.fechaSolicitud) {
        const fechaSol = sol.fechaSolicitud.split('T')[0];
        matchPeriodo = fechaSol >= fechaCorte;
      }

      return matchEstado && matchTipo && matchPeriodo;
    });
  }

  private getFechaCorte(periodo: string): string | null {
    if (!periodo || periodo === 'todos') return null;

    const hoy = new Date();
    let fecha: Date;

    switch (periodo) {
      case 'hoy':
        fecha = hoy;
        break;
      case '7d':
        fecha = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '15d':
        fecha = new Date(hoy.getTime() - 15 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        fecha = new Date(hoy);
        fecha.setMonth(fecha.getMonth() - 1);
        break;
      case '3m':
        fecha = new Date(hoy);
        fecha.setMonth(fecha.getMonth() - 3);
        break;
      default:
        return null;
    }

    return fecha.toISOString().split('T')[0];
  }

  get pendientesFiltradas() {
    if (!this.esJefe()) return [];

    return this.solicitudesPendientes.filter(sol => {
      let matchTipo = true;
      let matchRol = true;
      let matchEmpleado = true;
      let matchFecha = true;

      if (this.filtroTipoPendientes) {
        matchTipo = sol.tipo === this.filtroTipoPendientes;
      }

      if (this.filtroRolPendientes) {
        const empleado = this.todosEmpleados.find(e => e.id === sol.empleadoId);
        if (empleado) {
          matchRol = empleado.rol === this.filtroRolPendientes;
        }
      }

      if (this.filtroEmpleadoPendientes) {
        matchEmpleado = sol.empleadoNombre.toLowerCase().includes(this.filtroEmpleadoPendientes.toLowerCase());
      }

      if (this.filtroFechaInicioPendientes && sol.fechaInicio) {
        const fechaSol = sol.fechaInicio.split('T')[0];
        matchFecha = fechaSol >= this.filtroFechaInicioPendientes;
      }

      if (this.filtroFechaFinPendientes && sol.fechaInicio) {
        const fechaSol = sol.fechaInicio.split('T')[0];
        matchFecha = matchFecha && fechaSol <= this.filtroFechaFinPendientes;
      }

      return matchTipo && matchRol && matchEmpleado && matchFecha;
    });
  }

  get historialGlobalFiltrado() {
    if (!this.esJefe()) return [];

    const fechaCorte = this.getFechaCorte(this.filtroPeriodoHistorial);

    return this.historialGlobal.filter(sol => {
      let matchRol = true;
      let matchTipo = true;
      let matchEstado = true;
      let matchEmpleado = true;
      let matchPeriodo = true;
      let matchFechaRango = true;

      if (this.filtroRolHistorial) {
        const empleado = this.todosEmpleados.find(e => e.id === sol.empleadoId);
        if (empleado) {
          matchRol = empleado.rol === this.filtroRolHistorial;
        }
      }

      if (this.filtroTipoHistorial) {
        matchTipo = sol.tipo === this.filtroTipoHistorial;
      }

      if (this.filtroEstadoHistorial) {
        matchEstado = sol.estado === this.filtroEstadoHistorial;
      }

      if (this.filtroEmpleadoHistorial) {
        matchEmpleado = sol.empleadoNombre.toLowerCase().includes(this.filtroEmpleadoHistorial.toLowerCase());
      }

      // Filtro por periodo de fecha de gestion/aprobacion
      if (fechaCorte) {
        const fechaProceso = (sol.fechaAprobacion || sol.fechaSolicitud || '').split('T')[0];
        matchPeriodo = fechaProceso >= fechaCorte;
      }

      // Filtro por rango de fechas de solicitud (Desde/Hasta)
      if (this.filtroFechaInicioHistorial && sol.fechaInicio) {
        const fechaSol = sol.fechaInicio.split('T')[0];
        matchFechaRango = fechaSol >= this.filtroFechaInicioHistorial;
      }
      if (this.filtroFechaFinHistorial && sol.fechaInicio) {
        const fechaSol = sol.fechaInicio.split('T')[0];
        matchFechaRango = matchFechaRango && fechaSol <= this.filtroFechaFinHistorial;
      }

      return matchRol && matchTipo && matchEstado && matchEmpleado && matchPeriodo && matchFechaRango;
    }).sort((a, b) => {
      const fechaA = a.fechaAprobacion || a.fechaSolicitud || '';
      const fechaB = b.fechaAprobacion || b.fechaSolicitud || '';
      return fechaB.localeCompare(fechaA);
    });
  }

  get empleadosFiltrados() {
    if (!this.esJefe()) return [];

    let empleados = this.todosEmpleados;

    if (this.filtroRolPendientes) {
      empleados = empleados.filter(e => e.rol === this.filtroRolPendientes);
    }

    return empleados;
  }

  validarFechasFiltro() {
    if (this.filtroFechaInicioMisSolicitudes && this.filtroFechaFinMisSolicitudes &&
        this.filtroFechaFinMisSolicitudes < this.filtroFechaInicioMisSolicitudes) {
      this.filtroFechaFinMisSolicitudes = this.filtroFechaInicioMisSolicitudes;
    }

    if (this.filtroFechaInicioPendientes && this.filtroFechaFinPendientes &&
        this.filtroFechaFinPendientes < this.filtroFechaInicioPendientes) {
      this.filtroFechaFinPendientes = this.filtroFechaInicioPendientes;
    }

    if (this.filtroFechaInicioHistorial && this.filtroFechaFinHistorial &&
        this.filtroFechaFinHistorial < this.filtroFechaInicioHistorial) {
      this.filtroFechaFinHistorial = this.filtroFechaInicioHistorial;
    }

    // Si se usa Desde/Hasta en historial, cambiar periodo a "todos" para buscar en todo
    if (this.filtroFechaInicioHistorial || this.filtroFechaFinHistorial) {
      this.filtroPeriodoHistorial = 'todos';
    }
  }

  limpiarFiltros() {
    switch(this.activeTab) {
      case 'mis-solicitudes':
        this.filtroEstadoMisSolicitudes = '';
        this.filtroTipoMisSolicitudes = '';
        this.filtroPeriodoMisSolicitudes = '7d';
        break;
      case 'aprobar':
        this.filtroTipoPendientes = '';
        this.filtroEmpleadoPendientes = '';
        this.filtroFechaInicioPendientes = '';
        this.filtroFechaFinPendientes = '';
        if (this.esAdmin()) {
          this.filtroRolPendientes = 'supervisor';
        } else if (this.esSupervisor()) {
          this.filtroRolPendientes = 'tecnico';
        } else {
          this.filtroRolPendientes = '';
        }
        break;
      case 'historial':
        this.filtroTipoHistorial = '';
        this.filtroEstadoHistorial = '';
        this.filtroEmpleadoHistorial = '';
        this.filtroFechaInicioHistorial = '';
        this.filtroFechaFinHistorial = '';
        this.filtroPeriodoHistorial = '7d';
        if (this.esAdmin()) {
          this.filtroRolHistorial = 'supervisor';
        } else if (this.esSupervisor()) {
          this.filtroRolHistorial = 'tecnico';
        } else {
          this.filtroRolHistorial = '';
        }
        break;
    }
  }

  exportarExcel() {
    this.exportando = true;
    const datos = this.obtenerDatosParaExportar();

    if (datos.length === 0) {
      this.notification.warning('No hay datos para exportar', 'Sin datos');
      this.exportando = false;
      return;
    }

    const nombreArchivo = this.getNombreArchivoExportacion();
    this.exportService.exportToExcel(datos, nombreArchivo);
    this.exportando = false;
  }

  exportarPDF() {
    this.exportando = true;
    const datos = this.obtenerDatosParaExportar();

    if (datos.length === 0) {
      this.notification.warning('No hay datos para exportar', 'Sin datos');
      this.exportando = false;
      return;
    }

    const nombreArchivo = this.getNombreArchivoExportacion();
    const titulo = this.getTituloExportacion();
    const columnas = this.getColumnasExportacion();

    this.exportService.exportToPDF(datos, columnas, {
      title: titulo,
      filename: nombreArchivo,
      orientation: 'landscape'
    });
    this.exportando = false;
  }

  private getColumnasExportacion(): any[] {
    if (this.activeTab === 'mis-solicitudes') {
      return [
        { header: 'ID', dataKey: 'id', width: 10 },
        { header: 'Tipo', dataKey: 'tipo', width: 25 },
        { header: 'F. Solicitud', dataKey: 'fechaSolicitud', width: 28 },
        { header: 'Inicio', dataKey: 'fechaInicio', width: 25 },
        { header: 'Fin', dataKey: 'fechaFin', width: 25 },
        { header: 'Dias', dataKey: 'dias', width: 12 },
        { header: 'Estado', dataKey: 'estado', width: 22 },
        { header: 'Aprobo', dataKey: 'aprobadoPor', width: 35 },
        { header: 'F. Aprobacion', dataKey: 'fechaAprobacion', width: 28 }
      ];
    } else if (this.activeTab === 'aprobar') {
      return [
        { header: 'ID', dataKey: 'id', width: 10 },
        { header: 'Empleado', dataKey: 'empleadoNombre', width: 40 },
        { header: 'Rol', dataKey: 'rol', width: 20 },
        { header: 'Tipo', dataKey: 'tipo', width: 25 },
        { header: 'Inicio', dataKey: 'fechaInicio', width: 25 },
        { header: 'Fin', dataKey: 'fechaFin', width: 25 },
        { header: 'Dias', dataKey: 'dias', width: 12 },
        { header: 'F. Solicitud', dataKey: 'fechaSolicitud', width: 28 },
        { header: 'Motivo', dataKey: 'motivo', width: 50 }
      ];
    } else {
      return [
        { header: 'ID', dataKey: 'id', width: 8 },
        { header: 'Empleado', dataKey: 'empleadoNombre', width: 35 },
        { header: 'Rol', dataKey: 'rol', width: 18 },
        { header: 'Tipo', dataKey: 'tipo', width: 22 },
        { header: 'Inicio', dataKey: 'fechaInicio', width: 22 },
        { header: 'Fin', dataKey: 'fechaFin', width: 22 },
        { header: 'Dias', dataKey: 'dias', width: 10 },
        { header: 'Estado', dataKey: 'estado', width: 18 },
        { header: 'Aprobo', dataKey: 'aprobadoPor', width: 30 },
        { header: 'F. Solicitud', dataKey: 'fechaSolicitud', width: 25 },
        { header: 'F. Aprobacion', dataKey: 'fechaAprobacion', width: 25 }
      ];
    }
  }

  private obtenerDatosParaExportar(): any[] {
    let datosOriginales: SolicitudResponse[] = [];

    switch(this.activeTab) {
      case 'mis-solicitudes':
        datosOriginales = this.misSolicitudesFiltradas;
        break;
      case 'aprobar':
        datosOriginales = this.pendientesFiltradas;
        break;
      case 'historial':
        datosOriginales = this.historialGlobalFiltrado;
        break;
      default:
        datosOriginales = [];
    }

    return datosOriginales.map(sol => {
      const empleado = this.todosEmpleados.find(e => e.id === sol.empleadoId);
      return {
        id: sol.id || '',
        empleadoNombre: this.truncarTexto(sol.empleadoNombre || '', 25),
        rol: this.formatRolExport(empleado?.rol || ''),
        tipo: this.formatTipoExport(sol.tipo || ''),
        fechaInicio: this.formatFechaExport(sol.fechaInicio || ''),
        fechaFin: this.formatFechaExport(sol.fechaFin || ''),
        dias: this.calcularDias(sol.fechaInicio || '', sol.fechaFin || ''),
        estado: this.formatEstadoExport(sol.estado || ''),
        aprobadoPor: this.truncarTexto(String(sol.aprobadoPor || sol.nombreAprobador || 'Pendiente'), 20),
        fechaSolicitud: this.formatFechaExport(sol.fechaSolicitud || ''),
        fechaAprobacion: this.formatFechaExport(sol.fechaAprobacion || ''),
        motivo: this.truncarTexto(sol.motivo || '', 40)
      };
    });
  }

  private truncarTexto(texto: string, maxLength: number): string {
    if (!texto) return '';
    return texto.length > maxLength ? texto.substring(0, maxLength) + '...' : texto;
  }

  private formatRolExport(rol: string): string {
    const roles: { [key: string]: string } = {
      'admin': 'Admin',
      'supervisor': 'Supervisor',
      'tecnico': 'Tecnico',
      'hd': 'HD',
      'noc': 'NOC'
    };
    return roles[rol?.toLowerCase()] || rol;
  }

  private formatTipoExport(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'vacaciones': 'Vacaciones',
      'permiso': 'Permiso',
      'descanso': 'Descanso',
      'compensacion': 'Compensacion',
      'licencia': 'Licencia'
    };
    return tipos[tipo?.toLowerCase()] || tipo;
  }

  private formatEstadoExport(estado: string): string {
    const estados: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'aprobado': 'Aprobado',
      'rechazado': 'Rechazado'
    };
    return estados[estado?.toLowerCase()] || estado;
  }

  private getNombreArchivoExportacion(): string {
    const tipoMap: {[key: string]: string} = {
      'mis-solicitudes': 'mis_solicitudes',
      'aprobar': 'solicitudes_pendientes',
      'historial': 'historial_solicitudes'
    };

    const fecha = new Date().toISOString().split('T')[0];
    return `${tipoMap[this.activeTab] || 'solicitudes'}_${fecha}`;
  }

  private getTituloExportacion(): string {
    const tituloMap: {[key: string]: string} = {
      'mis-solicitudes': 'Mis Solicitudes',
      'aprobar': 'Solicitudes Pendientes de Aprobacion',
      'historial': 'Historial de Solicitudes'
    };

    return tituloMap[this.activeTab] || 'Reporte de Solicitudes';
  }

  private formatFechaExport(fecha: string): string {
    if (!fecha) return '';
    try {
      return fecha.split('T')[0];
    } catch {
      return fecha;
    }
  }

  private formatearFecha(fecha: string): string {
    if (!fecha) return '';
    try {
      const fechaISO = fecha.split('T')[0];
      const [anio, mes, dia] = fechaISO.split('-');
      return `${dia}/${mes}/${anio}`;
    } catch {
      return fecha.split('T')[0] || fecha;
    }
  }

  private formatearFechaHora(fechaHora: string): string {
    if (!fechaHora) return '';
    try {
      const [fechaPart, horaPart] = fechaHora.split('T');
      const [anio, mes, dia] = fechaPart.split('-');

      if (horaPart) {
        const [hora, minutos] = horaPart.split(':');
        return `${dia}/${mes}/${anio} ${hora}:${minutos}`;
      }

      return `${dia}/${mes}/${anio}`;
    } catch {
      return fechaHora;
    }
  }

  private calcularDias(inicio: string, fin: string): number {
    if (!inicio || !fin) return 0;
    try {
      const fechaInicio = inicio.split('T')[0];
      const fechaFin = fin.split('T')[0];

      const start = new Date(fechaInicio);
      const end = new Date(fechaFin);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  }

  async procesar(id: number, estado: string) {
    if (estado === 'rechazado') {
      this.solicitudGestionandoId = id;
      this.estadoGestionando = estado;
      this.comentarioGestion = '';
      this.mostrarModalGestion = true;
      return;
    }

    const confirmado = await this.notification.confirm({
      title: 'APROBAR Solicitud',
      message: 'Confirma que desea aprobar esta solicitud?',
      confirmText: 'APROBAR',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmado) return;

    this.solicitudesService.gestionarSolicitud(id, estado, this.currentUser.id).subscribe({
      next: () => {
        this.cargarDatos();
        this.notification.success('La solicitud ha sido aprobada correctamente.', 'Solicitud aprobada');
      },
      error: () => this.notification.error('Error al procesar la solicitud', 'Error')
    });
  }

  confirmarGestion() {
    if (!this.solicitudGestionandoId) return;

    const id = this.solicitudGestionandoId;
    const estado = this.estadoGestionando;
    const comentario = this.comentarioGestion.trim() || undefined;

    this.mostrarModalGestion = false;

    this.solicitudesService.gestionarSolicitud(id, estado, this.currentUser.id, comentario).subscribe({
      next: () => {
        this.cargarDatos();
        this.notification.info('La solicitud ha sido rechazada.', 'Solicitud rechazada');
        this.resetModalGestion();
      },
      error: () => {
        this.notification.error('Error al procesar la solicitud', 'Error');
        this.resetModalGestion();
      }
    });
  }

  cancelarGestion() {
    this.resetModalGestion();
  }

  private resetModalGestion() {
    this.mostrarModalGestion = false;
    this.comentarioGestion = '';
    this.solicitudGestionandoId = null;
    this.estadoGestionando = '';
  }

  async eliminarSolicitud(id: number) {
    const confirmado = await this.notification.confirm({
      title: 'Eliminar Solicitud',
      message: '¿Está seguro de que desea eliminar esta solicitud pendiente? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmado) return;

    this.isLoading = true;
    this.solicitudesService.eliminarSolicitud(id).subscribe({
      next: () => {
        this.notification.success('La solicitud ha sido eliminada correctamente.', 'Solicitud eliminada');
        this.cargarDatos();
        this.isLoading = false;
      },
      error: (err) => {
        this.notification.error(err || 'Error al eliminar la solicitud', 'Error');
        this.isLoading = false;
      }
    });
  }

  limpiarFormulario() {
    this.nuevaSolicitud = {
      tipo: 'vacaciones',
      fechaInicio: '',
      fechaFin: '',
      motivo: ''
    };
    this.tieneConflictos = false;
    this.mensajeConflictos = '';
    this.conflictosDetectados = [];
    this.mostrarModalConflictos = false;
    this.accionPendiente = null;
  }

  confirmarConflictos() {
    this.mostrarModalConflictos = false;
    this.isLoading = true;

    if (this.accionPendiente === 'crear') {
      this.enviarSolicitud();
    } else if (this.accionPendiente === 'editar') {
      this.actualizarSolicitud();
    }

    this.accionPendiente = null;
  }

  cancelarConflictos() {
    this.mostrarModalConflictos = false;
    this.tieneConflictos = false;
    this.mensajeConflictos = '';
    this.conflictosDetectados = [];
    this.accionPendiente = null;
    this.isLoading = false;
  }

  getEstadoClass(estado: string): string {
    if (!estado) return 'bg-secondary';

    switch (estado.toLowerCase()) {
      case 'aprobado': return 'bg-success';
      case 'rechazado': return 'bg-danger';
      case 'pendiente': return 'bg-warning text-dark';
      default: return 'bg-secondary';
    }
  }

  getRolClass(rol: string): string {
    if (!rol) return 'bg-secondary';

    switch (rol.toLowerCase()) {
      case 'admin': return 'bg-dark text-white';
      case 'supervisor': return 'bg-primary text-white';
      case 'tecnico': return 'bg-info text-white';
      default: return 'bg-secondary';
    }
  }

  getFechaActual(): string {
    const hoy = new Date();
    const offset = -5 * 60 * 60 * 1000;
    const fechaPeru = new Date(hoy.getTime() + offset);
    return fechaPeru.toISOString().split('T')[0];
  }

  formatFecha(fecha: string): string {
    return this.formatearFecha(fecha);
  }

  formatFechaHora(fechaHora: string): string {
    return this.formatearFechaHora(fechaHora);
  }

  obtenerRolEmpleado(empleadoId: number): string {
    if (!this.todosEmpleados || this.todosEmpleados.length === 0) {
      return '';
    }

    const empleado = this.todosEmpleados.find(e => e.id === empleadoId);
    return empleado?.rol || '';
  }

  get todosEmpleadosFiltrados() {
    return this.todosEmpleados || [];
  }
}
