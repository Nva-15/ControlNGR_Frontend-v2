import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../services/asistencia';
import { AuthService } from '../../services/auth';
import { EmpleadosService } from '../../services/empleados';
import { ExportService } from '../../services/export';
import { NotificationService } from '../../services/notification.service';
import { ReporteAsistencia } from '../../interfaces/asistencia';
import { rolBadge, rolLabel } from '../../utils/roles';
import { normalizar, opciones } from '../../utils/filtros';
import { hoyIso } from '../../utils/format';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html'
})
export class ReportesComponent implements OnInit, OnDestroy {
  private asistenciaService = inject(AsistenciaService);
  private authService = inject(AuthService);
  private empleadosService = inject(EmpleadosService);
  private exportService = inject(ExportService);
  private notification = inject(NotificationService);

  reporteCompleto: ReporteAsistencia[] = [];
  reporteFiltrado: ReporteAsistencia[] = [];
  isLoading = false;

  // Filtros
  fechaInicio = '';
  fechaFin = '';
  fechaHoy = '';
  filtroBusqueda = '';
  filtroRol = '';
  filtroDepartamento = '';
  filtroEstado = '';

  /** Roles que trabajan con horario; las opciones del filtro suman los roles de quien marcó sin horario. */
  roles: { value: string; label: string }[] = [{ value: '', label: 'Todos los roles' }];

  estados = [
    { value: '', label: 'Todos los estados' },
    { value: 'A tiempo', label: 'A tiempo' },
    { value: 'Tardanza', label: 'Tardanza' },
    { value: 'Falta', label: 'Falta' },
    { value: 'Permiso', label: 'Permiso' },
    { value: 'Descanso', label: 'Descanso' },
    { value: 'Vacaciones', label: 'Vacaciones' },
    { value: 'Compensado', label: 'Compensado' },
    { value: 'Descanso_medico', label: 'Descanso médico' },
    { value: 'Licencia', label: 'Licencia' },
    { value: 'Asistió', label: 'Asistió' }
  ];

  // Resumen
  totalRegistros = 0;
  totalATiempo = 0;
  totalTardanzas = 0;
  totalFaltas = 0;
  totalAsistio = 0;
  private intervaloAutoRefresh: any;

  ngOnInit(): void {
    // Fecha de Lima (no la del reloj de la PC), igual que el resto del sistema
    this.fechaHoy = hoyIso();
    this.fechaInicio = this.fechaHoy;
    this.fechaFin = this.fechaHoy;
    this.empleadosService.rolesConHorario().subscribe({
      next: r => this.roles = [{ value: '', label: 'Todos los roles' }, ...r.map(x => ({ value: x.codigo, label: x.nombre }))],
      error: () => { /* se mantiene "Todos los roles" */ }
    });
    this.cargarReporte();
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 60000);
  }

  ngOnDestroy(): void {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos(): void {
    if (this.isLoading || !this.fechaInicio || !this.fechaFin) return;
    this.asistenciaService.getReporteAsistencia(this.fechaInicio, this.fechaFin).subscribe({
      next: (data) => {
        this.reporteCompleto = this.filtrarPorPermisoDeRol(data);
        this.aplicarFiltros();
      }
    });
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  validarFechaInicio(): void {
    if (this.fechaInicio && this.fechaInicio > this.fechaHoy) {
      this.fechaInicio = this.fechaHoy;
    }
    this.validarFechaFin();
  }

  validarFechaFin(): void {
    if (this.fechaFin && this.fechaFin > this.fechaHoy) {
      this.fechaFin = this.fechaHoy;
    }
    if (this.fechaInicio && this.fechaFin && this.fechaFin < this.fechaInicio) {
      this.fechaFin = this.fechaInicio;
    }
  }

  cargarReporte(): void {
    if (!this.fechaInicio || !this.fechaFin) {
      this.notification.warning('Seleccione un rango de fechas', 'Aviso');
      return;
    }
    if (this.fechaFin < this.fechaInicio) {
      this.notification.warning('La fecha fin no puede ser menor a la fecha inicio', 'Aviso');
      this.fechaFin = this.fechaInicio;
      return;
    }

    this.isLoading = true;
    this.asistenciaService.getReporteAsistencia(this.fechaInicio, this.fechaFin).subscribe({
      next: (data) => {
        this.reporteCompleto = this.filtrarPorPermisoDeRol(data);
        this.aplicarFiltros();
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Error al cargar el reporte', 'Error');
        this.isLoading = false;
      }
    });
  }

  private filtrarPorPermisoDeRol(data: ReporteAsistencia[]): ReporteAsistencia[] {
    if (this.isAdminOrSupervisor()) {
      return data;
    }
    const currentEmpleado = this.authService.getCurrentEmpleado();
    if (currentEmpleado?.id) {
      return data.filter(r => r.empleadoId === currentEmpleado.id);
    }
    return [];
  }

  aplicarFiltros(): void {
    let filtrado = [...this.reporteCompleto];

    if (this.filtroBusqueda) {
      const busqueda = normalizar(this.filtroBusqueda.trim());
      filtrado = filtrado.filter(r => normalizar(r.empleadoNombre).includes(busqueda));
    }

    if (this.filtroDepartamento) {
      filtrado = filtrado.filter(r => r.empleadoDepartamento === this.filtroDepartamento);
    }

    if (this.filtroRol) {
      filtrado = filtrado.filter(r => r.empleadoRol?.toLowerCase() === this.filtroRol);
    }

    if (this.filtroEstado) {
      filtrado = filtrado.filter(r => r.estado === this.filtroEstado);
    }

    this.reporteFiltrado = filtrado;
    this.calcularResumen();
  }

  private calcularResumen(): void {
    // Días laborales: solo los que tienen horario programado (los marcados sin horario van aparte)
    const workDays = this.reporteFiltrado.filter(r => r.tipoDia === 'normal');
    this.totalRegistros = workDays.length;
    this.totalATiempo = workDays.filter(r => r.estado === 'A tiempo').length;
    this.totalTardanzas = workDays.filter(r => r.estado === 'Tardanza').length;
    this.totalFaltas = workDays.filter(r => r.estado === 'Falta').length;
    this.totalAsistio = this.reporteFiltrado.filter(r => r.estado === 'Asistió').length;
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'A tiempo': return 'badge-green';
      case 'Tardanza': return 'badge-amber';
      case 'Falta': return 'badge-red';
      case 'Vacaciones': return 'badge-oro';
      case 'Compensado': case 'Asistió': return 'badge-blue';
      case 'Descanso_medico': case 'Licencia': case 'Permiso': return 'badge-violet';
      default: return 'badge-gray';
    }
  }

  estadoTexto(estado: string): string {
    return this.estados.find(e => e.value === estado)?.label || estado;
  }

  getRolClass(rol: string): string {
    return rolBadge(rol);
  }

  getRolLabel(rol: string): string {
    return rolLabel(rol);
  }

  formatHora(hora: string | null): string {
    if (!hora) return '—';
    return hora.length >= 5 ? hora.substring(0, 5) : hora;
  }

  formatRetraso(minutos: number): string {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
  }

  getDiaSemanaLabel(dia: string): string {
    const labels: { [key: string]: string } = {
      'lunes': 'Lun', 'martes': 'Mar', 'miercoles': 'Mie',
      'jueves': 'Jue', 'viernes': 'Vie', 'sabado': 'Sab', 'domingo': 'Dom'
    };
    return labels[dia] || dia;
  }

  /** Jefaturas, supervisores y gestor ven a todo el personal. */
  isAdminOrSupervisor(): boolean {
    return this.authService.isGestion();
  }

  /** Roles con horario más los de quien aparece en el reporte por haber marcado (por ejemplo, jefaturas). */
  get opcionesRol(): { value: string; label: string }[] {
    const extra = opciones(this.reporteCompleto, r => r.empleadoRol?.toLowerCase())
      .filter(c => !this.roles.some(r => r.value === c))
      .map(c => ({ value: c, label: rolLabel(c) }));
    return [...this.roles, ...extra];
  }

  /** Departamentos presentes en el reporte cargado. */
  get departamentos(): string[] {
    return opciones(this.reporteCompleto, r => r.empleadoDepartamento);
  }

  limpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroRol = '';
    this.filtroDepartamento = '';
    this.filtroEstado = '';
    this.fechaInicio = this.fechaHoy;
    this.fechaFin = this.fechaHoy;
    this.empleadosService.rolesConHorario().subscribe({
      next: r => this.roles = [{ value: '', label: 'Todos los roles' }, ...r.map(x => ({ value: x.codigo, label: x.nombre }))],
      error: () => { /* se mantiene "Todos los roles" */ }
    });
    this.cargarReporte();
  }

  // ========== EXPORTAR ==========

  exportarExcel(): void {
    if (this.reporteFiltrado.length === 0) {
      this.notification.warning('No hay datos para exportar', 'Aviso');
      return;
    }
    const data = this.prepararDatosExport();
    this.exportService.exportToExcel(
      data,
      `reporte_asistencia_${this.fechaInicio}_${this.fechaFin}`,
      'Reporte'
    );
    this.notification.success('Archivo Excel generado', 'Exportar');
  }

  exportarPdf(): void {
    if (this.reporteFiltrado.length === 0) {
      this.notification.warning('No hay datos para exportar', 'Aviso');
      return;
    }
    const data = this.prepararDatosExport();
    const columns = [
      { header: 'Empleado', dataKey: 'empleado' },
      { header: 'Rol', dataKey: 'rol' },
      { header: 'Fecha', dataKey: 'fecha' },
      { header: 'Dia', dataKey: 'dia' },
      { header: 'H. Programada', dataKey: 'horarioEntrada' },
      { header: 'H. Real', dataKey: 'horaReal' },
      { header: 'Estado', dataKey: 'estado' },
      { header: 'Min. Retraso', dataKey: 'minutosRetraso' },
      { header: 'Mensaje', dataKey: 'mensaje' },
      { header: 'Observaciones', dataKey: 'observaciones' }
    ];

    this.exportService.exportToPDF(data, columns, {
      title: `Reporte de Asistencia (${this.fechaInicio} a ${this.fechaFin})`,
      orientation: 'landscape',
      filename: `reporte_asistencia_${this.fechaInicio}_${this.fechaFin}`,
      fontSize: 7,
      autoColumnWidth: true
    });
    this.notification.success('Archivo PDF generado', 'Exportar');
  }

  private prepararDatosExport(): any[] {
    return this.reporteFiltrado.map(r => ({
      empleado: r.empleadoNombre,
      rol: r.empleadoRol?.toUpperCase() || '',
      fecha: r.fecha,
      dia: this.getDiaSemanaLabel(r.diaSemana),
      horarioEntrada: this.formatHora(r.horarioEntrada),
      horaReal: this.formatHora(r.horaEntradaReal),
      estado: this.estadoTexto(r.estado),
      minutosRetraso: r.minutosRetraso !== null && r.minutosRetraso > 0 ? this.formatRetraso(r.minutosRetraso) : '-',
      mensaje: this.mensajeTexto(r),
      observaciones: r.observaciones || ''
    }));
  }

  /** Mensajes que el colaborador dejo al marcar. */
  mensajeTexto(r: ReporteAsistencia): string {
    return [r.mensajeEntrada ? `Entrada: ${r.mensajeEntrada}` : '', r.mensajeSalida ? `Salida: ${r.mensajeSalida}` : '']
      .filter(Boolean).join(' | ');
  }
}
