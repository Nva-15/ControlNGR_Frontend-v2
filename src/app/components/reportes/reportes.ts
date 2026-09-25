import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../services/asistencia';
import { AuthService } from '../../services/auth';
import { ExportService } from '../../services/export';
import { NotificationService } from '../../services/notification.service';
import { ReporteAsistencia } from '../../interfaces/asistencia';
import { PERSONAL, rolBadge, rolLabel } from '../../utils/roles';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html'
})
export class ReportesComponent implements OnInit, OnDestroy {
  private asistenciaService = inject(AsistenciaService);
  private authService = inject(AuthService);
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
  filtroEstado = '';

  roles = [
    { value: '', label: 'Todos los roles' },
    ...PERSONAL.map(r => ({ value: r as string, label: rolLabel(r) }))
  ];

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
    { value: 'Sin horario', label: 'Sin horario' }
  ];

  // Resumen
  totalRegistros = 0;
  totalATiempo = 0;
  totalTardanzas = 0;
  totalFaltas = 0;
  private intervaloAutoRefresh: any;

  ngOnInit(): void {
    const now = new Date();
    this.fechaHoy = this.formatDate(now);
    this.fechaInicio = this.fechaHoy;
    this.fechaFin = this.fechaHoy;
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
      const busqueda = this.filtroBusqueda.toLowerCase();
      filtrado = filtrado.filter(r => r.empleadoNombre.toLowerCase().includes(busqueda));
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
    const workDays = this.reporteFiltrado.filter(
      r => !r.tipoDia || r.tipoDia === 'normal'
    );
    this.totalRegistros = workDays.length;
    this.totalATiempo = workDays.filter(r => r.estado === 'A tiempo').length;
    this.totalTardanzas = workDays.filter(r => r.estado === 'Tardanza').length;
    this.totalFaltas = workDays.filter(r => r.estado === 'Falta').length;
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'A tiempo': return 'badge-green';
      case 'Tardanza': return 'badge-amber';
      case 'Falta': return 'badge-red';
      case 'Vacaciones': return 'badge-oro';
      case 'Compensado': return 'badge-blue';
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
    if (!hora) return '--:--';
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

  limpiarFiltros(): void {
    this.filtroBusqueda = '';
    this.filtroRol = '';
    this.filtroEstado = '';
    this.fechaInicio = this.fechaHoy;
    this.fechaFin = this.fechaHoy;
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
      estado: r.estado,
      minutosRetraso: r.minutosRetraso !== null && r.minutosRetraso > 0 ? this.formatRetraso(r.minutosRetraso) : '-',
      observaciones: r.observaciones || ''
    }));
  }
}
