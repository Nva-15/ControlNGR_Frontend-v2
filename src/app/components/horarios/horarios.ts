import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HorariosService } from '../../services/horarios';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export';
import {
  HorarioSemanal,
  HorarioDia,
  HorarioSemanalResponse,
  EmpleadoHorarioSemanal,
  DetalleHorarioDia,
  HorarioSemanalRequest
} from '../../interfaces/horario';

@Component({
  selector: 'app-horarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './horarios.html',
  styleUrls: ['./horarios.css']
})
export class HorariosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private horariosService = inject(HorariosService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private exportService = inject(ExportService);

  horarioForm: FormGroup;
  semanaForm: FormGroup;

  // Vista actual: 'fechas' (nuevo) o 'clasico' (antiguo)
  vistaActual: 'fechas' | 'clasico' = 'fechas';

  // Datos para vista por fechas
  semanasDisponibles: HorarioSemanalResponse[] = [];
  semanaSeleccionada: HorarioSemanalResponse | null = null;
  empleadosFiltrados: EmpleadoHorarioSemanal[] = [];

  // Datos para vista clasica
  horariosSemanales: HorarioSemanal[] = [];
  horariosFiltrados: HorarioSemanal[] = [];

  isLoading = false;
  filtroRol = '';
  filtroBusqueda = '';

  // Modal de edicion
  mostrarModal = false;
  empleadoEditando: EmpleadoHorarioSemanal | null = null;
  diaEditando: DetalleHorarioDia | null = null;

  // Modal crear semana
  mostrarModalCrear = false;

  // Aplicar a multiples dias
  aplicarAOtrosDias = false;
  diasSeleccionados: { [key: string]: boolean } = {};
  otrosDiasDisponibles: { fecha: string; dia: DetalleHorarioDia; label: string }[] = [];

  private intervaloAutoRefresh: any;

  diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

  diasLabels: { [key: string]: string } = {
    'lunes': 'Lun',
    'martes': 'Mar',
    'miercoles': 'Mié',
    'jueves': 'Jue',
    'viernes': 'Vie',
    'sabado': 'Sáb',
    'domingo': 'Dom'
  };

  roles = [
    { value: '', label: 'Todos los roles' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'hd', label: 'HD' },
    { value: 'noc', label: 'NOC' }
  ];

  tiposDia = [
    { value: 'normal', label: 'Normal', color: 'success', icon: 'bi-briefcase' },
    { value: 'descanso', label: 'Descanso', color: 'secondary', icon: 'bi-moon-stars' },
    { value: 'compensado', label: 'Compensado', color: 'info', icon: 'bi-calendar-check' },
    { value: 'vacaciones', label: 'Vacaciones', color: 'warning', icon: 'bi-sun' },
    { value: 'permiso', label: 'Permiso', color: 'primary', icon: 'bi-person-check' }
  ];

  estadosSemana = [
    { value: 'borrador', label: 'Borrador', class: 'bg-secondary' },
    { value: 'activo', label: 'Activo', class: 'bg-success' },
    { value: 'historico', label: 'Histórico', class: 'bg-dark' }
  ];

  constructor() {
    this.horarioForm = this.initHorarioForm();
    this.semanaForm = this.initSemanaForm();
  }

  ngOnInit() {
    const rol = this.authService.getUserRole();
    if (rol === 'tecnico' || rol === 'hd' || rol === 'noc') {
      this.filtroRol = rol;
    }
    this.cargarSemanas();
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 5000);
  }

  ngOnDestroy() {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || this.mostrarModal || this.mostrarModalCrear) return;
    // Refrescar lista de semanas disponibles (detecta nuevas activaciones)
    this.horariosService.getSemanasHorarios().subscribe({
      next: (semanas) => {
        this.semanasDisponibles = this.filtrarSemanasVisibles(semanas);
      }
    });
    // Refrescar semana seleccionada
    if (this.semanaSeleccionada) {
      this.horariosService.getSemanaById(this.semanaSeleccionada.id).subscribe({
        next: (semana) => {
          this.semanaSeleccionada = semana;
          this.aplicarFiltros();
        }
      });
    }
  }

  initHorarioForm(): FormGroup {
    return this.fb.group({
      tipoDia: ['normal', Validators.required],
      turno: ['manana'],
      horaEntrada: ['08:00'],
      horaSalida: ['17:00'],
      horaAlmuerzoInicio: ['12:00'],
      horaAlmuerzoFin: ['13:00']
    });
  }

  initSemanaForm(): FormGroup {
    const hoy = new Date();
    const lunes = this.getLunesDeSemana(hoy);
    const domingo = new Date(lunes);
    domingo.setDate(domingo.getDate() + 6);

    return this.fb.group({
      fechaInicio: [this.formatDate(lunes), Validators.required],
      fechaFin: [this.formatDate(domingo), Validators.required],
      copiarDeId: ['']
    });
  }

  getLunesDeSemana(fecha: Date): Date {
    const d = new Date(fecha);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ========== CARGAR DATOS ==========

  cargarSemanas() {
    this.isLoading = true;
    this.horariosService.getSemanasHorarios().subscribe({
      next: (semanas) => {
        // Filtrar semanas según el rol del usuario y fechas
        this.semanasDisponibles = this.filtrarSemanasVisibles(semanas);

        // Si hay semana vigente, seleccionarla
        const vigente = this.semanasDisponibles.find(s => s.esSemanaActual);
        if (vigente) {
          this.seleccionarSemana(vigente.id);
        } else if (this.semanasDisponibles.length > 0) {
          this.seleccionarSemana(this.semanasDisponibles[0].id);
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.notification.error('Error al cargar semanas', 'Error');
        this.isLoading = false;
      }
    });
  }

  // Filtrar semanas visibles según rol y fechas
  filtrarSemanasVisibles(semanas: HorarioSemanalResponse[]): HorarioSemanalResponse[] {
    const rol = this.authService.getUserRole();
    const esRolBasico = ['tecnico', 'hd', 'noc'].includes(rol);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Calcular el inicio de la semana actual (lunes)
    const inicioSemanaActual = this.getLunesDeSemana(hoy);

    // Calcular el inicio de la semana anterior
    const inicioSemanaAnterior = new Date(inicioSemanaActual);
    inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);

    return semanas.filter(semana => {
      // Para roles básicos (tecnico, hd, noc): solo mostrar horarios activos
      if (esRolBasico && semana.estado !== 'activo') {
        return false;
      }

      // Filtrar por fechas: mostrar semana anterior, actual y futuras
      const fechaInicioSemana = new Date(semana.fechaInicio);
      fechaInicioSemana.setHours(0, 0, 0, 0);

      // Permitir: semana anterior (solo una), semana actual y futuras
      return fechaInicioSemana >= inicioSemanaAnterior;
    });
  }

  seleccionarSemana(semanaId: number) {
    this.isLoading = true;
    this.horariosService.getSemanaById(semanaId).subscribe({
      next: (semana) => {
        this.semanaSeleccionada = semana;
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Error al cargar semana', 'Error');
        this.isLoading = false;
      }
    });
  }

  cargarSemanaVigente() {
    this.isLoading = true;
    this.horariosService.getSemanaVigente().subscribe({
      next: (semana) => {
        this.semanaSeleccionada = semana;
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: (err) => {
        this.notification.warning('No hay semana vigente configurada', 'Aviso');
        this.isLoading = false;
      }
    });
  }

  // ========== FILTROS ==========

  aplicarFiltros() {
    if (!this.semanaSeleccionada) {
      this.empleadosFiltrados = [];
      return;
    }

    let empleados = [...this.semanaSeleccionada.empleados];

    // Filtrar por rol
    if (this.filtroRol) {
      empleados = empleados.filter(e =>
        e.empleadoRol?.toLowerCase() === this.filtroRol.toLowerCase()
      );
    }

    // Filtrar por búsqueda
    if (this.filtroBusqueda) {
      empleados = empleados.filter(e =>
        e.empleadoNombre.toLowerCase().includes(this.filtroBusqueda.toLowerCase())
      );
    }

    this.empleadosFiltrados = empleados;
  }

  onFiltroRolChange() {
    this.aplicarFiltros();
  }

  // ========== HELPERS PARA FECHAS ==========

  getFechasDeSemana(): string[] {
    if (!this.semanaSeleccionada) return [];
    const fechas: string[] = [];
    const inicio = new Date(this.semanaSeleccionada.fechaInicio);
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      fechas.push(this.formatDate(fecha));
    }
    return fechas;
  }

  getDiaDeEmpleado(empleado: EmpleadoHorarioSemanal, fecha: string): DetalleHorarioDia | null {
    return empleado.dias[fecha] || null;
  }

  formatFechaCorta(fechaStr: string): string {
    const fecha = new Date(fechaStr + 'T00:00:00');
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  }

  getDiaSemanaFromFecha(fechaStr: string): string {
    const fecha = new Date(fechaStr + 'T00:00:00');
    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    return dias[fecha.getDay()];
  }

  esHoy(fechaStr: string): boolean {
    const hoy = new Date().toISOString().split('T')[0];
    return fechaStr === hoy;
  }

  // ========== ESTILOS ==========

  getTipoDiaClass(dia: DetalleHorarioDia | null): string {
    if (!dia) return 'sin-horario';
    const tipo = dia.tipoDia || 'normal';
    switch (tipo) {
      case 'descanso': return 'bg-secondary text-white';
      case 'compensado': return 'bg-info text-white';
      case 'vacaciones': return 'bg-warning text-dark';
      case 'permiso': return 'bg-primary text-white';
      default: return 'bg-light';
    }
  }

  getTipoDiaLabel(tipo: string | undefined): string {
    if (!tipo) return 'Normal';
    const tipoObj = this.tiposDia.find(t => t.value === tipo);
    return tipoObj ? tipoObj.label : tipo;
  }

  getTipoDiaIcon(tipo: string | undefined): string {
    if (!tipo) return 'bi-briefcase';
    const tipoObj = this.tiposDia.find(t => t.value === tipo);
    return tipoObj ? tipoObj.icon : 'bi-briefcase';
  }

  getRolLabel(rol: string): string {
    const rolUpper = rol?.toUpperCase() || '';
    switch (rolUpper) {
      case 'ADMIN': return 'Admin';
      case 'SUPERVISOR': return 'Supervisor';
      case 'TECNICO': return 'Técnico';
      case 'HD': return 'HD';
      case 'NOC': return 'NOC';
      default: return rol;
    }
  }

  getRolClass(rol: string): string {
    switch (rol?.toLowerCase()) {
      case 'admin': return 'badge bg-danger';
      case 'supervisor': return 'badge bg-primary';
      case 'tecnico': return 'badge bg-success';
      case 'hd': return 'badge bg-info';
      case 'noc': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }

  getEstadoClass(estado: string): string {
    const est = this.estadosSemana.find(e => e.value === estado);
    return est ? `badge ${est.class}` : 'badge bg-secondary';
  }

  // ========== CREAR SEMANA ==========

  abrirModalCrear() {
    const hoy = new Date();
    const lunes = this.getLunesDeSemana(hoy);
    // Siguiente semana
    lunes.setDate(lunes.getDate() + 7);
    const domingo = new Date(lunes);
    domingo.setDate(domingo.getDate() + 6);

    this.semanaForm.patchValue({
      fechaInicio: this.formatDate(lunes),
      fechaFin: this.formatDate(domingo),
      copiarDeId: this.semanaSeleccionada?.id?.toString() || ''
    });
    this.mostrarModalCrear = true;
  }

  cerrarModalCrear() {
    this.mostrarModalCrear = false;
  }

  onFechaInicioChange() {
    const fechaInicio = this.semanaForm.get('fechaInicio')?.value;
    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(inicio);
      fin.setDate(inicio.getDate() + 6);
      this.semanaForm.patchValue({ fechaFin: this.formatDate(fin) });
    }
  }

  crearSemana() {
    if (this.semanaForm.invalid) return;

    const formValue = this.semanaForm.value;
    const empleado = this.authService.getCurrentEmpleado();

    if (!empleado?.id) {
      this.notification.error('No se pudo obtener el usuario actual. Por favor, inicie sesión nuevamente.', 'Error');
      return;
    }

    // Convertir copiarDeId a número o undefined (evitar string "null")
    let copiarDeId: number | undefined = undefined;
    if (formValue.copiarDeId && formValue.copiarDeId !== 'null' && formValue.copiarDeId !== '') {
      copiarDeId = Number(formValue.copiarDeId);
    }

    const request: HorarioSemanalRequest = {
      fechaInicio: formValue.fechaInicio,
      fechaFin: formValue.fechaFin,
      creadoPorId: empleado.id,
      copiarDeId: copiarDeId
    };

    console.log('Creando semana con request:', request);

    this.isLoading = true;
    this.horariosService.generarSemana(request).subscribe({
      next: (semana) => {
        this.notification.success(`Semana "${semana.nombre}" creada correctamente`, 'Éxito');
        this.cerrarModalCrear();
        this.cargarSemanas();
        this.seleccionarSemana(semana.id);
      },
      error: (err) => {
        this.notification.error(err || 'Error al crear semana', 'Error');
        this.isLoading = false;
      }
    });
  }

  copiarSemanaActual() {
    if (!this.semanaSeleccionada) return;

    const fechaInicio = new Date(this.semanaSeleccionada.fechaInicio);
    fechaInicio.setDate(fechaInicio.getDate() + 7);

    this.isLoading = true;
    this.horariosService.copiarSemana(
      this.semanaSeleccionada.id,
      this.formatDate(fechaInicio)
    ).subscribe({
      next: (semana) => {
        this.notification.success(`Semana "${semana.nombre}" copiada correctamente`, 'Éxito');
        this.cargarSemanas();
        this.seleccionarSemana(semana.id);
      },
      error: (err) => {
        this.notification.error(err || 'Error al copiar semana', 'Error');
        this.isLoading = false;
      }
    });
  }

  // ========== CAMBIAR ESTADO SEMANA ==========

  cambiarEstado(nuevoEstado: string) {
    if (!this.semanaSeleccionada) return;

    this.horariosService.cambiarEstadoSemana(this.semanaSeleccionada.id, nuevoEstado).subscribe({
      next: (semana) => {
        this.semanaSeleccionada = semana;
        this.notification.success(`Estado cambiado a "${nuevoEstado}"`, 'Éxito');
        this.cargarSemanas();
      },
      error: (err) => {
        this.notification.error(err || 'Error al cambiar estado', 'Error');
      }
    });
  }

  async eliminarSemana() {
    if (!this.semanaSeleccionada) return;
    if (this.semanaSeleccionada.estado !== 'borrador') {
      this.notification.warning('Solo se pueden eliminar semanas en estado borrador', 'Aviso');
      return;
    }

    const confirmado = await this.notification.confirm({
      title: 'Confirmar eliminación',
      message: '¿Está seguro de eliminar esta semana?',
      type: 'danger',
      confirmText: 'Eliminar',
      cancelText: 'Cancelar'
    });

    if (confirmado && this.semanaSeleccionada) {
      this.horariosService.eliminarSemana(this.semanaSeleccionada.id).subscribe({
        next: () => {
          this.notification.success('Semana eliminada', 'Éxito');
          this.semanaSeleccionada = null;
          this.cargarSemanas();
        },
        error: (err) => {
          this.notification.error(err || 'Error al eliminar', 'Error');
        }
      });
    }
  }

  // ========== MODAL EDITAR DIA ==========

  editarDia(empleado: EmpleadoHorarioSemanal, dia: DetalleHorarioDia) {
    if (!this.tienePermiso()) return;
    if (dia.origenTipoDia === 'solicitud_aprobada') {
      this.notification.warning('Este día está asignado por una solicitud aprobada. Para modificarlo, primero debe rechazar la solicitud.', 'Aviso');
      return;
    }

    this.empleadoEditando = empleado;
    this.diaEditando = dia;

    // Reset dias seleccionados
    this.aplicarAOtrosDias = false;
    this.diasSeleccionados = {};
    this.calcularOtrosDiasDisponibles();

    if (dia) {
      this.horarioForm.patchValue({
        tipoDia: dia.tipoDia || 'normal',
        turno: dia.turno || 'manana',
        horaEntrada: dia.horaEntrada || '08:00',
        horaSalida: dia.horaSalida || '17:00',
        horaAlmuerzoInicio: dia.horaAlmuerzoInicio || '12:00',
        horaAlmuerzoFin: dia.horaAlmuerzoFin || '13:00'
      });
    } else {
      this.horarioForm.reset({
        tipoDia: 'normal',
        turno: 'manana',
        horaEntrada: '08:00',
        horaSalida: '17:00',
        horaAlmuerzoInicio: '12:00',
        horaAlmuerzoFin: '13:00'
      });
    }

    this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.empleadoEditando = null;
    this.diaEditando = null;
    this.aplicarAOtrosDias = false;
    this.diasSeleccionados = {};
  }

  guardarHorario() {
    if (!this.empleadoEditando || !this.diaEditando?.id) return;

    const formValue = this.horarioForm.value;
    this.isLoading = true;

    const payload: Partial<DetalleHorarioDia> = {
      tipoDia: formValue.tipoDia,
      turno: formValue.turno || 'manana'
    };

    if (formValue.tipoDia === 'normal') {
      payload.horaEntrada = formValue.horaEntrada;
      payload.horaSalida = formValue.horaSalida;
      if (formValue.turno === 'tarde') {
        payload.horaAlmuerzoInicio = '';
        payload.horaAlmuerzoFin = '';
      } else {
        payload.horaAlmuerzoInicio = formValue.horaAlmuerzoInicio;
        payload.horaAlmuerzoFin = formValue.horaAlmuerzoFin;
      }
    } else {
      payload.horaEntrada = '';
      payload.horaSalida = '';
      payload.horaAlmuerzoInicio = '';
      payload.horaAlmuerzoFin = '';
    }

    // Recolectar IDs de días seleccionados
    const detalleIds: number[] = [this.diaEditando.id];

    if (this.aplicarAOtrosDias && this.empleadoEditando) {
      // Agregar los días seleccionados (excepto el día actual que ya está incluido)
      for (const [fecha, seleccionado] of Object.entries(this.diasSeleccionados)) {
        if (seleccionado) {
          const dia = this.empleadoEditando.dias[fecha];
          if (dia?.id && dia.id !== this.diaEditando.id && dia.origenTipoDia !== 'solicitud_aprobada') {
            detalleIds.push(dia.id);
          }
        }
      }
    }

    // Usar endpoint múltiple si hay más de un día seleccionado
    if (detalleIds.length > 1) {
      this.horariosService.actualizarMultiplesDias(detalleIds, payload).subscribe({
        next: (semana) => {
          this.notification.success(`Horario aplicado a ${detalleIds.length} días`, 'Éxito');
          this.semanaSeleccionada = semana;
          this.aplicarFiltros();
          this.cerrarModal();
          this.isLoading = false;
        },
        error: (err) => {
          this.notification.error(err || 'Error al guardar horarios', 'Error');
          this.isLoading = false;
        }
      });
    } else {
      this.horariosService.actualizarDetalleDia(this.diaEditando.id, payload).subscribe({
        next: (semana) => {
          this.notification.success('Horario actualizado correctamente', 'Éxito');
          this.semanaSeleccionada = semana;
          this.aplicarFiltros();
          this.cerrarModal();
          this.isLoading = false;
        },
        error: (err) => {
          this.notification.error(err || 'Error al guardar horario', 'Error');
          this.isLoading = false;
        }
      });
    }
  }

  onTipoDiaChange() {
    const tipoDia = this.horarioForm.get('tipoDia')?.value;
    const esNormal = tipoDia === 'normal';

    if (!esNormal) {
      this.horarioForm.patchValue({
        horaEntrada: '',
        horaSalida: '',
        horaAlmuerzoInicio: '',
        horaAlmuerzoFin: ''
      });
    } else {
      const turno = this.horarioForm.get('turno')?.value;
      if (turno === 'tarde') {
        this.horarioForm.patchValue({
          horaEntrada: '14:00',
          horaSalida: '22:00',
          horaAlmuerzoInicio: '',
          horaAlmuerzoFin: ''
        });
      } else {
        this.horarioForm.patchValue({
          horaEntrada: '08:00',
          horaSalida: '17:00',
          horaAlmuerzoInicio: '12:00',
          horaAlmuerzoFin: '13:00'
        });
      }
    }
  }

  onTurnoChange() {
    const turno = this.horarioForm.get('turno')?.value;
    const tipoDia = this.horarioForm.get('tipoDia')?.value;

    if (tipoDia !== 'normal') return;

    if (turno === 'tarde') {
      this.horarioForm.patchValue({
        horaEntrada: '14:00',
        horaSalida: '22:00',
        horaAlmuerzoInicio: '',
        horaAlmuerzoFin: ''
      });
    } else {
      this.horarioForm.patchValue({
        horaEntrada: '08:00',
        horaSalida: '17:00',
        horaAlmuerzoInicio: '12:00',
        horaAlmuerzoFin: '13:00'
      });
    }
  }

  // Calcular los otros días del empleado (para aplicar a múltiples)
  calcularOtrosDiasDisponibles(): void {
    this.otrosDiasDisponibles = [];

    if (!this.empleadoEditando || !this.diaEditando) return;

    for (const [fecha, dia] of Object.entries(this.empleadoEditando.dias)) {
      // Excluir el día que se está editando y los días con solicitud aprobada
      if (dia && dia.id !== this.diaEditando.id && dia.origenTipoDia !== 'solicitud_aprobada') {
        const label = `${this.diasLabels[dia.diaSemana] || dia.diaSemana} ${this.formatFechaCorta(fecha)}`;
        this.otrosDiasDisponibles.push({ fecha, dia, label });
      }
    }
  }

  // Seleccionar/deseleccionar todos los días
  toggleSeleccionarTodos() {
    const todosSeleccionados = this.otrosDiasDisponibles.every(d => this.diasSeleccionados[d.fecha]);

    for (const d of this.otrosDiasDisponibles) {
      this.diasSeleccionados[d.fecha] = !todosSeleccionados;
    }
  }

  // Contar días seleccionados
  getSelectedDaysCount(): number {
    return Object.values(this.diasSeleccionados).filter(v => v).length;
  }

  esTurnoTarde(): boolean {
    return this.horarioForm.get('turno')?.value === 'tarde';
  }

  // ========== EXPORTAR ==========

  exportarExcel() {
    if (this.empleadosFiltrados.length === 0) {
      this.notification.warning('No hay datos para exportar', 'Aviso');
      return;
    }

    const data = this.prepararDatosExport();
    const nombre = this.semanaSeleccionada
      ? `horario_${this.semanaSeleccionada.fechaInicio}_${this.semanaSeleccionada.fechaFin}`
      : 'horario_semanal';

    this.exportService.exportToExcel(data, nombre, 'Horarios');
    this.notification.success('Archivo Excel generado', 'Exportar');
  }

  exportarPdf() {
    if (this.empleadosFiltrados.length === 0) {
      this.notification.warning('No hay datos para exportar', 'Aviso');
      return;
    }

    const data = this.prepararDatosExport();
    const fechas = this.getFechasDeSemana();
    const columns = [
      { header: 'Empleado', dataKey: 'empleado' },
      { header: 'Cargo', dataKey: 'cargo' },
      ...fechas.map(f => ({
        header: `${this.diasLabels[this.getDiaSemanaFromFecha(f)]} ${this.formatFechaCorta(f)}`,
        dataKey: f
      }))
    ];

    const titulo = this.semanaSeleccionada
      ? `Horario - ${this.semanaSeleccionada.nombre}`
      : 'Horario Semanal';

    this.exportService.exportToPDF(data, columns, {
      title: titulo,
      orientation: 'landscape',
      filename: this.semanaSeleccionada
        ? `horario_${this.semanaSeleccionada.fechaInicio}`
        : 'horario_semanal',
      fontSize: 7,
      autoColumnWidth: true
    });
    this.notification.success('Archivo PDF generado', 'Exportar');
  }

  private prepararDatosExport(): any[] {
    const fechas = this.getFechasDeSemana();

    return this.empleadosFiltrados.map(emp => {
      const row: any = {
        empleado: emp.empleadoNombre,
        cargo: emp.empleadoCargo || ''
      };

      fechas.forEach(fecha => {
        const dia = this.getDiaDeEmpleado(emp, fecha);
        if (!dia) {
          row[fecha] = 'Sin horario';
        } else if (dia.tipoDia && dia.tipoDia !== 'normal') {
          row[fecha] = dia.tipoDia.toUpperCase();
        } else {
          const entrada = dia.horaEntrada || '--';
          const salida = dia.horaSalida || '--';
          row[fecha] = `${entrada} - ${salida}`;
        }
      });

      return row;
    });
  }

  tienePermiso(): boolean {
    const rol = this.authService.getUserRole();
    return rol === 'admin' || rol === 'supervisor';
  }
}
