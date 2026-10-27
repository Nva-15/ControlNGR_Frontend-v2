import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../shared/modal/modal.component';
import { rolBadge, rolLabel } from '../../utils/roles';
import { normalizar, opciones } from '../../utils/filtros';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HorariosService, TurnoSemanaPayload } from '../../services/horarios';
import { EditorTurnoComponent, DiaEditorTurno, PlantillaTurno } from './editor-turno';
import { CONFIG_TURNOS_DEFECTO, ConfigTurnos, entradaSugerida, refrigerioSugerido, salidaSugerida } from '../../utils/turnos';
import { EmpleadosService } from '../../services/empleados';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export';
import {
  HorarioSemanal,
  HorarioDia,
  HorarioSemanalResponse,
  EmpleadoHorarioSemanal,
  DetalleHorarioDia,
  HorarioSemanalRequest,
  FuncionTurno
} from '../../interfaces/horario';

@Component({
  selector: 'app-horarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ModalComponent, EditorTurnoComponent],
  templateUrl: './horarios.html'
})
export class HorariosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private horariosService = inject(HorariosService);
  private authService = inject(AuthService);
  private empleadosService = inject(EmpleadosService);
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
  filtroDepartamento = '';
  /** El filtro por el área del usuario se aplica una sola vez, al abrir la pantalla. */
  private filtroInicialAplicado = false;

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

  // Editor de varios días (semana del colaborador u horario base)
  configTurnos: ConfigTurnos = CONFIG_TURNOS_DEFECTO;
  funcionesTurno: FuncionTurno[] = [];
  /** Funciones del día en el formulario de un día. */
  funcionesDia: string[] = [];
  editor = {
    abierto: false,
    modo: 'semana' as 'semana' | 'base',
    titulo: '',
    subtitulo: '',
    dias: [] as DiaEditorTurno[],
    diaInicial: '',
    plantillas: [] as PlantillaTurno[],
    guardarBaseInicial: false,
    guardando: false,
    empleado: null as EmpleadoHorarioSemanal | null,
    dia: null as DetalleHorarioDia | null
  };

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

  /** Solo los roles que trabajan con horario (configurable en el panel admin → Asistencia y horarios). */
  roles: { value: string; label: string }[] = [{ value: '', label: 'Todos los roles' }];

  tiposDia = [
    { value: 'normal', label: 'Laboral', clase: 'bg-superficie text-stone-700', icon: 'bi-briefcase' },
    { value: 'descanso', label: 'Descanso', clase: 'bg-stone-200 text-stone-700', icon: 'bi-moon-stars' },
    { value: 'descanso_feriado', label: 'Descanso feriado', clase: 'bg-teal-100 text-teal-800', icon: 'bi-calendar-heart' },
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
    this.empleadosService.rolesConHorario().subscribe({
      next: r => this.roles = [{ value: '', label: 'Todos los roles' }, ...r.map(x => ({ value: x.codigo, label: x.nombre }))],
      error: () => { /* se mantiene "Todos los roles" */ }
    });
    this.horariosService.configuracionTurnos().subscribe(c => this.configTurnos = c);
    this.horariosService.funcionesTurno().subscribe(f => this.funcionesTurno = f);
    this.cargarSemanas();
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 30000);
  }

  ngOnDestroy() {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || this.mostrarModal || this.mostrarModalCrear || this.editor.abierto) return;
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
        this.aplicarFiltroInicial();
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
        this.aplicarFiltroInicial();
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

    if (this.filtroDepartamento) {
      empleados = empleados.filter(e => e.empleadoDepartamento === this.filtroDepartamento);
    }

    // Filtrar por búsqueda
    if (this.filtroBusqueda) {
      const q = normalizar(this.filtroBusqueda.trim());
      empleados = empleados.filter(e => normalizar(e.empleadoNombre).includes(q));
    }

    this.empleadosFiltrados = empleados;
  }

  onFiltroRolChange() {
    this.aplicarFiltros();
  }

  /**
   * Al abrir Horarios, cada colaborador ve primero a su área (Soporte, HD, NOC...) para no cargar
   * a todo el personal. La gerencia y el admin empiezan viendo todo. "Limpiar" muestra a todos.
   */
  private aplicarFiltroInicial() {
    if (this.filtroInicialAplicado || !this.semanaSeleccionada) return;
    this.filtroInicialAplicado = true;
    if (this.authService.isAdmin() || this.authService.isGerencia()) return;
    const area = this.authService.empleado()?.departamentoNombre;
    if (area && this.departamentos.includes(area)) this.filtroDepartamento = area;
  }

  /** Departamentos presentes en la semana cargada. */
  get departamentos(): string[] {
    return opciones(this.semanaSeleccionada?.empleados || [], e => e.empleadoDepartamento);
  }

  limpiarFiltros() {
    this.filtroBusqueda = '';
    this.filtroRol = '';
    this.filtroDepartamento = '';
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
        this.avisarAgregados(semana);
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

  /** Colaboradores que no estaban en la semana copiada (ingresos nuevos): entraron con su horario base. */
  private avisarAgregados(semana: HorarioSemanalResponse) {
    const n = semana.colaboradoresAgregados ?? 0;
    if (n > 0) {
      this.notification.info(
        n === 1
          ? 'Se agregó 1 colaborador que no estaba en la semana copiada, con su horario base. Revise su turno.'
          : `Se agregaron ${n} colaboradores que no estaban en la semana copiada, con su horario base. Revise sus turnos.`,
        'Colaboradores nuevos', 8000);
    }
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
        this.avisarAgregados(semana);
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

  // ==================== EDITOR DE VARIOS DÍAS ====================

  /** Clic en un día: abre la semana del colaborador, un renglón por día, con ese día ya marcado. */
  editarDia(empleado: EmpleadoHorarioSemanal, dia: DetalleHorarioDia) {
    if (!this.tienePermiso() || !this.semanaSeleccionada) return;
    const dias: DiaEditorTurno[] = [];
    for (const f of this.getFechasDeSemana()) {
      const d = empleado.dias[f];
      if (!d) continue; // aún no formaba parte de la semana (ingresó después)
      dias.push({
        ...this.diaEditor(f, `${this.diasLabels[d.diaSemana] || d.diaSemana} ${this.formatFechaCorta(f)}`, d,
          d.origenTipoDia === 'solicitud_aprobada'),
        feriado: this.feriadoDe(f) || undefined
      });
    }
    this.editor = {
      ...this.editor,
      abierto: true,
      modo: 'semana',
      titulo: 'Editar semana',
      subtitulo: `${empleado.empleadoNombre} · ${this.semanaSeleccionada.nombre}`,
      dias,
      diaInicial: dia.fecha,
      plantillas: this.turnosDelEquipo(empleado),
      guardarBaseInicial: Object.values(empleado.dias).some(d => d?.origenTipoDia === 'sin_horario_base'),
      guardando: false,
      empleado,
      dia
    };
  }

  /** Horario base del colaborador (lunes a domingo): se usa para ingresos nuevos y días sin horario. */
  editarHorarioBase(empleado: EmpleadoHorarioSemanal) {
    if (!this.tienePermiso()) return;
    this.horariosService.getHorariosPorEmpleado(empleado.empleadoId).subscribe({
      next: base => {
        const porDia = new Map(base.map(h => [h.diaSemana, h]));
        this.editor = {
          ...this.editor,
          abierto: true,
          modo: 'base',
          titulo: 'Horario base',
          subtitulo: base.length ? empleado.empleadoNombre
            : `${empleado.empleadoNombre} · aún no tiene horario base`,
          // Sin horario base: se propone trabajar de lunes a sábado y descansar el domingo
          dias: this.diasSemana.map(ds => this.diaEditor(ds, this.diasLabels[ds],
            porDia.get(ds) ?? { tipoDia: ds === 'domingo' ? 'descanso' : 'normal' }, false)),
          diaInicial: '',
          plantillas: this.turnosDelEquipo(empleado),
          guardarBaseInicial: false,
          guardando: false,
          empleado,
          dia: null
        };
      },
      error: err => this.notification.error(err || 'No se pudo cargar el horario base', 'Error')
    });
  }

  private diaEditor(clave: string, etiqueta: string, d: Partial<DetalleHorarioDia>, bloqueado: boolean): DiaEditorTurno {
    const tipo = d.tipoDia || 'normal';
    return {
      clave, etiqueta, tipo, bloqueado, etiquetaTipo: this.getTipoDiaLabel(tipo),
      turno: d.turno, horaEntrada: d.horaEntrada, horaSalida: d.horaSalida,
      horaAlmuerzoInicio: d.horaAlmuerzoInicio, horaAlmuerzoFin: d.horaAlmuerzoFin, funciones: d.funciones
    };
  }

  cerrarEditor() {
    this.editor = { ...this.editor, abierto: false, empleado: null, dia: null };
  }

  /** "Editar solo un día": formulario de un día (permisos, otro horario puntual...). */
  /** "Permiso u otro tipo de día": formulario completo de ese día. */
  editarUnDia(fecha: string) {
    const empleado = this.editor.empleado;
    const dia = empleado?.dias[fecha];
    this.cerrarEditor();
    if (empleado && dia) this.abrirEditorDia(empleado, dia);
  }

  /** Turnos más usados esta semana por el equipo de la persona (fichas del editor), del más al menos frecuente. */
  private turnosDelEquipo(empleado: EmpleadoHorarioSemanal): PlantillaTurno[] {
    const conteo = new Map<string, { n: number; p: PlantillaTurno }>();
    const equipo = (this.semanaSeleccionada?.empleados || [])
      .filter(e => e.empleadoDepartamento === empleado.empleadoDepartamento);
    for (const e of equipo) {
      for (const d of Object.values(e.dias)) {
        if (!d || (d.tipoDia || 'normal') !== 'normal' || !d.horaEntrada || !d.horaSalida) continue;
        const k = `${d.turno}|${d.horaEntrada}|${d.horaSalida}|${[...(d.funciones || [])].sort().join(',')}`;
        const actual = conteo.get(k);
        if (actual) actual.n++;
        else conteo.set(k, { n: 1, p: { turno: d.turno, horaEntrada: d.horaEntrada, horaSalida: d.horaSalida,
          horaAlmuerzoInicio: d.horaAlmuerzoInicio, horaAlmuerzoFin: d.horaAlmuerzoFin, funciones: d.funciones } });
      }
    }
    return [...conteo.values()].sort((a, b) => b.n - a.n).map(x => x.p);
  }

  guardarEditor(payload: TurnoSemanaPayload) {
    const empleado = this.editor.empleado;
    if (!empleado) return;
    this.editor.guardando = true;
    if (this.editor.modo === 'base') {
      this.horariosService.guardarHorarioBase(empleado.empleadoId, payload).subscribe({
        next: () => {
          this.notification.success(`Horario base de ${empleado.empleadoNombre} guardado`, 'Éxito');
          this.cerrarEditor();
          // Los días que estaban sin horario base se completan: se recarga la semana
          if (this.semanaSeleccionada) this.seleccionarSemana(this.semanaSeleccionada.id);
        },
        error: err => {
          this.notification.error(err || 'No se pudo guardar el horario base', 'Error');
          this.editor.guardando = false;
        }
      });
      return;
    }
    if (!this.semanaSeleccionada) return;
    this.horariosService.guardarSemanaEmpleado(this.semanaSeleccionada.id, empleado.empleadoId, payload).subscribe({
      next: semana => {
        this.notification.success(payload.guardarComoBase
          ? 'Semana y horario base guardados' : 'Semana guardada', 'Éxito');
        this.semanaSeleccionada = semana;
        this.aplicarFiltros();
        this.cerrarEditor();
      },
      error: err => {
        this.notification.error(err || 'No se pudo guardar la semana', 'Error');
        this.editor.guardando = false;
      }
    });
  }

  /** Formulario de un solo día. */
  abrirEditorDia(empleado: EmpleadoHorarioSemanal, dia: DetalleHorarioDia) {
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

    this.funcionesDia = [...(dia.funciones || [])];
    this.horarioForm.patchValue({
      tipoDia: dia.tipoDia || 'normal',
      turno: dia.turno || 'manana',
      horaEntrada: dia.horaEntrada || '',
      horaSalida: dia.horaSalida || '',
      horaAlmuerzoInicio: dia.horaAlmuerzoInicio || '',
      horaAlmuerzoFin: dia.horaAlmuerzoFin || ''
    });
    // Día laboral aún sin horas: se propone la entrada habitual del turno y se calcula la salida
    if ((dia.tipoDia || 'normal') === 'normal' && !dia.horaEntrada) this.onTurnoChange();

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
      payload.funciones = [...this.funcionesDia];
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
      payload.funciones = [];
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
      this.onTurnoChange();
    }
  }

  /** Al elegir turno se propone su entrada habitual (mañana 08:30, tarde 17:00) y se calcula la salida. */
  onTurnoChange() {
    const tipoDia = this.horarioForm.get('tipoDia')?.value;
    if (tipoDia !== 'normal') return;
    const turno = this.horarioForm.get('turno')?.value || 'manana';
    this.horarioForm.patchValue({ horaEntrada: entradaSugerida(turno, this.configTurnos) });
    this.onEntradaChange();
  }

  alternarFuncionDia(codigo: string) {
    const i = this.funcionesDia.indexOf(codigo);
    if (i >= 0) this.funcionesDia.splice(i, 1); else this.funcionesDia.push(codigo);
  }

  /** Funciones que se pueden elegir en un día: las activas y las que ya tenía. */
  funcionesElegibles(actuales: string[]): FuncionTurno[] {
    return this.funcionesTurno.filter(f => f.activo || actuales.includes(f.codigo));
  }

  /** "(SP) (PRE)" para mostrar en la grilla y en el Excel. */
  textoFunciones(dia: DetalleHorarioDia | undefined | null): string {
    return (dia?.funciones || []).map(c => `(${c})`).join(' ');
  }

  /** Nombre del feriado de esa fecha en la semana (o vacío). */
  feriadoDe(fecha: string): string {
    return this.semanaSeleccionada?.feriados?.[fecha] || '';
  }

  /** Tipos de día del formulario de un día: "Descanso feriado" solo si la fecha es feriado. */
  tiposDiaPara(fecha: string | undefined): typeof this.tiposDia {
    return this.tiposDia.filter(t => t.value !== 'descanso_feriado' || (!!fecha && !!this.feriadoDe(fecha)));
  }

  /** "Soporte presencial, Preparador de equipos" (al pasar el mouse por la celda). */
  nombresFunciones(dia: DetalleHorarioDia): string {
    return (dia.funciones || []).map(c => this.funcionesTurno.find(f => f.codigo === c)?.nombre || c).join(', ');
  }

  /** Salida = entrada + jornada del turno; refrigerio del turno mañana 4 h después de la entrada (editables). */
  onEntradaChange() {
    const turno = this.horarioForm.get('turno')?.value || 'manana';
    const entrada = this.horarioForm.get('horaEntrada')?.value || (turno === 'tarde' ? '14:00' : '08:00');
    const refrigerio = refrigerioSugerido(entrada, this.configTurnos);
    this.horarioForm.patchValue({
      horaEntrada: entrada,
      horaSalida: salidaSugerida(entrada, turno, this.configTurnos),
      horaAlmuerzoInicio: turno === 'tarde' ? '' : refrigerio.inicio,
      horaAlmuerzoFin: turno === 'tarde' ? '' : refrigerio.fin
    });
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
          const funciones = this.textoFunciones(dia);
          row[fecha] = `${entrada} - ${salida}${funciones ? ' ' + funciones : ''}`;
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
