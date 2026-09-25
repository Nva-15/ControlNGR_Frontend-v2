import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../shared/modal/modal.component';
import { PERSONAL, rolBadge, rolLabel } from '../../utils/roles';
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
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ModalComponent],
  templateUrl: './horarios.html'
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
    ...PERSONAL.map(r => ({ value: r as string, label: rolLabel(r) }))
  ];

  tiposDia = [
    { value: 'normal', label: 'Laboral', clase: 'bg-white text-stone-700', icon: 'bi-briefcase' },
    { value: 'descanso', label: 'Descanso', clase: 'bg-stone-200 text-stone-700', icon: 'bi-moon-stars' },
    { value: 'compensado', label: 'Compensado', clase: 'bg-sky-100 text-sky-800', icon: 'bi-calendar-check' },
    { value: 'vacaciones', label: 'Vacaciones', clase: 'bg-oro-100 text-oro-800', icon: 'bi-sun' },
    { value: 'descanso_medico', label: 'Descanso médico', clase: 'bg-red-100 text-red-800', icon: 'bi-heart-pulse' },
    { value: 'licencia', label: 'Licencia', clase: 'bg-violet-100 text-violet-800', icon: 'bi-file-earmark-text' },
    { value: 'permiso', label: 'Permiso', clase: 'bg-vino-100 text-vino-800', icon: 'bi-person-check' }
  ];

  estadosSemana = [
    { value: 'borrador', label: 'Borrador', class: 'badge-gray' },
    { value: 'activo', label: 'Activo', class: 'badge-green' },
    { value: 'historico', label: 'Histórico', class: 'badge-blue' }
  ];

  constructor() {
    this.horarioForm = this.initHorarioForm();
    this.semanaForm = this.initSemanaForm();
  }

  ngOnInit() {
    this.cargarSemanas();
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 30000);
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

  /** Fecha local en formato yyyy-MM-dd (no usar toISOString: cambia de dia despues de las 19:00 en Lima). */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-CA');
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
    const esRolBasico = !this.tienePermiso();
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
      const fechaInicioSemana = new Date(semana.fechaInicio + 'T00:00:00');
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
    const inicio = new Date(this.semanaSeleccionada.fechaInicio + 'T00:00:00');
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
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return fechaStr === hoy;
  }

  // ========== ESTILOS ==========

  getTipoDiaClass(dia: DetalleHorarioDia | null): string {
    if (!dia) return 'bg-stone-50 text-stone-400';
    const tipo = this.tiposDia.find(t => t.value === (dia.tipoDia || 'normal'));
    return tipo ? tipo.clase : 'bg-stone-100 text-stone-700';
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
    return rolLabel(rol);
  }

  getRolClass(rol: string): string {
    return rolBadge(rol);
  }

  getEstadoClass(estado: string): string {
    const est = this.estadosSemana.find(e => e.value === estado);
    return est ? est.class : 'badge-gray';
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
      const inicio = new Date(fechaInicio + 'T00:00:00');
      const fin = new Date(inicio);
      fin.setDate(inicio.getDate() + 6);
      this.semanaForm.patchValue({ fechaFin: this.formatDate(fin) });
    }
  }

  crearSemana() {
    if (this.semanaForm.invalid) return;

    const formValue = this.semanaForm.value;
    const empleado = this.authService.getCurrentEmpleado();

    // Convertir copiarDeId a número o undefined (evitar string "null")
    let copiarDeId: number | undefined = undefined;
    if (formValue.copiarDeId && formValue.copiarDeId !== 'null' && formValue.copiarDeId !== '') {
      copiarDeId = Number(formValue.copiarDeId);
    }

    const request: HorarioSemanalRequest = {
      fechaInicio: formValue.fechaInicio,
      fechaFin: formValue.fechaFin,
      creadoPorId: empleado?.id ?? 0, // el backend usa el usuario autenticado
      copiarDeId: copiarDeId
    };

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

    const fechaInicio = new Date(this.semanaSeleccionada.fechaInicio + 'T00:00:00');
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

  /** Crear/editar horarios: jefaturas, supervisores, gestor y admin. */
  tienePermiso(): boolean {
    return this.authService.isAdmin() || this.authService.isGestion();
  }

  cambiarEstadoMenu = false;
}
