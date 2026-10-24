import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SolicitudesService } from '../../services/solicitudes';
import { SaldosService } from '../../services/saldos';
import { NotificationService } from '../../services/notification.service';
import { NotificacionesService } from '../../services/notificaciones';
import { ExportService } from '../../services/export';
import {
  CuposCompensacion, EstadoSolicitud, Evidencia, HistorialSolicitud, MotivoLicencia, SolicitudResponse, TipoSolicitud
} from '../../interfaces/solicitud';
import { DetalleSaldos } from '../../interfaces/saldo';
import { ModalComponent } from '../shared/modal/modal.component';
import { dias, fechaCorta, hoyIso, mensajeError } from '../../utils/format';
import { rolLabel } from '../../utils/roles';

type Pestana = 'mis-solicitudes' | 'nueva' | 'aprobar' | 'equipo';

const MAX_MB = 10;
const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png'];

@Component({
  selector: 'app-solicitudes',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, ModalComponent],
  templateUrl: './solicitudes.html'
})
export class SolicitudesComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private solicitudesService = inject(SolicitudesService);
  private saldosService = inject(SaldosService);
  private notification = inject(NotificationService);
  private notificacionesService = inject(NotificacionesService);
  private exportService = inject(ExportService);

  empleado = this.auth.empleado;
  pestana: Pestana = 'mis-solicitudes';
  private refresco: any;

  // Catalogos y saldos
  tipos: TipoSolicitud[] = [];
  motivosLicencia: MotivoLicencia[] = [];
  saldos: DetalleSaldos | null = null;
  rolesACargo: string[] = [];

  // Listas
  misSolicitudes: SolicitudResponse[] = [];
  porAprobar: SolicitudResponse[] = [];
  equipo: SolicitudResponse[] = [];
  cargando = false;

  // Filtros
  filtroEstado = '';
  filtroTipo = '';
  filtroTexto = '';

  // Nueva solicitud
  form = this.formVacio();
  archivo: File | null = null;
  enviando = false;
  conflictos: any[] = [];
  cupos: CuposCompensacion | null = null;

  // Detalle
  detalle: SolicitudResponse | null = null;
  historial: HistorialSolicitud[] = [];

  // Edicion
  editando: SolicitudResponse | null = null;
  edicion = { fechaInicio: '', fechaFin: '', motivo: '' };

  // Gestion (aprobar / rechazar / corregir)
  gestion: { solicitud: SolicitudResponse; estado: 'aprobado' | 'rechazado'; comentario: string } | null = null;
  gestionando = false;

  readonly dias = dias;
  readonly fechaCorta = fechaCorta;
  readonly rolLabel = rolLabel;
  readonly hoy = hoyIso();
  readonly maxMb = MAX_MB;

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['tab']) this.pestana = p['tab'] as Pestana;
    });
    this.solicitudesService.tipos().subscribe(t => this.tipos = t);
    this.solicitudesService.motivosLicencia().subscribe(m => this.motivosLicencia = m);
    this.cargarSaldos();
    this.cargarMisSolicitudes();
    this.solicitudesService.rolesACargo().subscribe(r => {
      this.rolesACargo = r;
      if (this.esAprobador) {
        this.cargarPorAprobar();
        this.cargarEquipo();
      }
    });
    this.refresco = setInterval(() => this.refrescar(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.refresco);
  }

  get esAprobador(): boolean {
    return this.rolesACargo.length > 0;
  }

  cambiarPestana(p: Pestana) {
    this.pestana = p;
    this.router.navigate([], { queryParams: { tab: p }, replaceUrl: true });
  }

  private refrescar() {
    if (this.gestion || this.editando || this.pestana === 'nueva') return;
    this.cargarMisSolicitudes(false);
    if (this.esAprobador) {
      this.cargarPorAprobar();
      this.cargarEquipo();
    }
  }

  // ==================== CARGAS ====================

  cargarSaldos() {
    this.saldosService.miSaldo().subscribe({ next: s => this.saldos = s, error: () => this.saldos = null });
  }

  cargarMisSolicitudes(mostrarCarga = true) {
    const id = this.empleado()?.id;
    if (!id) return;
    if (mostrarCarga) this.cargando = true;
    this.solicitudesService.getMisSolicitudes(id).subscribe({
      next: d => { this.misSolicitudes = d; this.cargando = false; },
      error: () => this.cargando = false
    });
  }

  cargarPorAprobar() {
    // Las urgencias primero; el resto conserva el orden de llegada
    this.solicitudesService.getPorAprobar().subscribe(d => this.porAprobar = [...d].sort((a, b) => Number(!!b.urgente) - Number(!!a.urgente)));
  }

  cargarEquipo() {
    this.solicitudesService.getTodas().subscribe(d => {
      this.equipo = d
        .filter(s => s.empleadoId !== this.empleado()?.id && s.empleadoRol && this.rolesACargo.includes(s.empleadoRol))
        .sort((a, b) => (b.fechaSolicitud || '').localeCompare(a.fechaSolicitud || ''));
    });
  }

  // ==================== FILTROS ====================

  private filtrar(lista: SolicitudResponse[]): SolicitudResponse[] {
    const texto = this.filtroTexto.trim().toLowerCase();
    return lista.filter(s =>
      (!this.filtroEstado || s.estado === this.filtroEstado) &&
      (!this.filtroTipo || s.tipo === this.filtroTipo) &&
      (!texto || s.empleadoNombre.toLowerCase().includes(texto) || (s.motivo || '').toLowerCase().includes(texto)));
  }

  get misFiltradas() { return this.filtrar(this.misSolicitudes); }
  get equipoFiltrado() { return this.filtrar(this.equipo); }

  limpiarFiltros() {
    this.filtroEstado = '';
    this.filtroTipo = '';
    this.filtroTexto = '';
  }

  // ==================== NUEVA SOLICITUD ====================

  private formVacio() {
    return { tipo: '', fechaInicio: '', fechaFin: '', motivo: '', motivoLicenciaId: null as number | null, urgente: false, motivoUrgencia: '' };
  }

  get tipoSeleccionado(): TipoSolicitud | undefined {
    return this.tipos.find(t => t.codigo === this.form.tipo);
  }

  get diasSolicitados(): number {
    if (!this.form.fechaInicio || !this.form.fechaFin || this.form.fechaFin < this.form.fechaInicio) return 0;
    const ms = new Date(this.form.fechaFin + 'T00:00:00').getTime() - new Date(this.form.fechaInicio + 'T00:00:00').getTime();
    return Math.round(ms / 86400000) + 1;
  }

  /** Dias disponibles del saldo que descuenta el tipo (null si no descuenta). */
  get disponible(): number | null {
    const t = this.tipoSeleccionado;
    if (!t || !this.saldos) return null;
    if (t.descuentaDe === 'VACACIONES') return this.saldos.saldos.vacaciones.disponible;
    if (t.descuentaDe === 'COMPENSACION') return this.saldos.saldos.compensacion.disponible;
    return null;
  }

  get excedeSaldo(): boolean {
    return this.disponible !== null && this.diasSolicitados > this.disponible;
  }

  /** Las solicitudes solo se registran desde hoy en adelante. */
  fechaPasada(fecha: string): boolean {
    return !!fecha && fecha < this.hoy;
  }

  get esCompensacion(): boolean {
    return this.form.tipo === 'compensacion';
  }

  /** Días de compensación que aún se aprueban solos en el equipo esa semana. */
  get cupoRestante(): number {
    return Math.max(0, (this.cupos?.cupoSemanal || 0) - (this.cupos?.usadosEquipo || 0));
  }

  get urgenciaIncompleta(): boolean {
    return this.esCompensacion && this.form.urgente && this.form.motivoUrgencia.trim().length < 5;
  }

  get puedeEnviar(): boolean {
    const t = this.tipoSeleccionado;
    return !!t && this.diasSolicitados > 0 && !this.excedeSaldo && !this.enviando && !this.urgenciaIncompleta
      && !this.fechaPasada(this.form.fechaInicio) && !this.fechaPasada(this.form.fechaFin)
      && (!t.requiereEvidencia || !!this.archivo)
      && (!t.requiereMotivoLicencia || !!this.form.motivoLicenciaId);
  }

  iconoTipo(codigo: string): string {
    switch (codigo) {
      case 'vacaciones': return 'bi-airplane';
      case 'compensacion': return 'bi-calendar-plus';
      case 'descanso_medico': return 'bi-heart-pulse';
      case 'licencia': return 'bi-file-earmark-text';
      default: return 'bi-send';
    }
  }

  seleccionarTipo(codigo: string) {
    this.form.tipo = codigo;
    this.archivo = null;
    this.form.motivoLicenciaId = null;
    this.form.urgente = false;
    this.form.motivoUrgencia = '';
    this.cargarCupos();
  }

  /** Cupos de la semana de la fecha de inicio (solo compensación en equipos con aprobación automática). */
  cargarCupos() {
    this.cupos = null;
    if (!this.esCompensacion || !this.form.fechaInicio) return;
    const fecha = this.form.fechaInicio;
    this.solicitudesService.cuposCompensacion(fecha).subscribe({
      next: c => { if (this.esCompensacion && this.form.fechaInicio === fecha) this.cupos = c; },
      error: () => this.cupos = null
    });
  }

  onFechasCambiadas() {
    this.conflictos = [];
    this.cargarCupos();
    const e = this.empleado();
    if (!e || !this.form.fechaInicio || !this.form.fechaFin || this.form.fechaFin < this.form.fechaInicio) return;
    this.solicitudesService.verificarConflictosPorRol(e.id, e.rol, this.form.fechaInicio, this.form.fechaFin).subscribe({
      next: (r) => this.conflictos = r?.conflictos || [],
      error: () => this.conflictos = []
    });
  }

  seleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    input.value = '';
    if (!file) return;
    if (!TIPOS_ARCHIVO.includes(file.type)) {
      this.notification.error('Adjunte una foto (JPG o PNG) o un PDF.', 'Archivo no permitido');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      this.notification.error(`El archivo no debe superar ${MAX_MB} MB.`, 'Archivo muy grande');
      return;
    }
    this.archivo = file;
  }

  tamano(bytes: number): string {
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  enviar() {
    if (!this.puedeEnviar) return;
    this.enviando = true;
    const t = this.tipoSeleccionado!;
    this.solicitudesService.crear({
      tipo: t.codigo,
      fechaInicio: this.form.fechaInicio,
      fechaFin: this.form.fechaFin,
      motivo: this.form.motivo.trim() || undefined,
      motivoLicenciaId: t.requiereMotivoLicencia ? this.form.motivoLicenciaId : undefined,
      urgente: this.esCompensacion && this.form.urgente ? true : undefined,
      motivoUrgencia: this.esCompensacion && this.form.urgente ? this.form.motivoUrgencia.trim() : undefined
    }, t.requiereEvidencia ? this.archivo : null).subscribe({
      next: (r) => {
        this.enviando = false;
        this.avisarResultado(r, t);
        this.form = this.formVacio();
        this.archivo = null;
        this.conflictos = [];
        this.cupos = null;
        this.cargarMisSolicitudes();
        this.cargarSaldos();
        this.cambiarPestana('mis-solicitudes');
      },
      error: (e) => {
        this.enviando = false;
        this.notification.error(mensajeError(e, 'No se pudo enviar la solicitud'), 'Solicitud no enviada', 7000);
      }
    });
  }

  private avisarResultado(r: SolicitudResponse | null, t: TipoSolicitud) {
    if (r?.estado === 'aprobado' && r.aprobacionAutomatica) {
      this.notification.success(`Su solicitud de ${t.nombre.toLowerCase()} fue aprobada automáticamente.`, 'Solicitud aprobada', 6000);
    } else if (r?.estado === 'rechazado') {
      this.notification.error(r.comentarioGestion || 'La solicitud fue rechazada automáticamente.', 'Solicitud rechazada', 9000);
    } else if (r?.urgente) {
      this.notification.warning('Su urgencia fue enviada a su supervisor para que la revise.', 'Solicitud enviada', 7000);
    } else if (r?.motivoEspera) {
      this.notification.warning(`${r.motivoEspera}. Comuníquese con su supervisor.`, 'Quedó en sala de espera', 9000);
    } else {
      this.notification.success(`Su solicitud de ${t.nombre.toLowerCase()} fue enviada para aprobación.`, 'Solicitud enviada');
    }
  }

  // ==================== DETALLE ====================

  verDetalle(s: SolicitudResponse) {
    this.detalle = s;
    this.historial = [];
    this.solicitudesService.historial(s.id).subscribe({ next: h => this.historial = h, error: () => {} });
  }

  abrirEvidencia(s: SolicitudResponse, ev: Evidencia) {
    // Se abre la ventana antes de la descarga para que el navegador no la bloquee
    const ventana = window.open('', '_blank');
    this.solicitudesService.evidencia(s.id, ev.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (ventana) ventana.location.href = url; else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: (e) => {
        ventana?.close();
        this.notification.error(mensajeError(e, 'No se pudo abrir la evidencia'));
      }
    });
  }

  // ==================== EDITAR / ELIMINAR ====================

  editar(s: SolicitudResponse) {
    this.editando = s;
    this.edicion = { fechaInicio: s.fechaInicio, fechaFin: s.fechaFin, motivo: (s.motivo || '').split('\n\nCONFLICTO DE FECHAS:')[0] };
  }

  guardarEdicion() {
    if (!this.editando) return;
    if (!this.edicion.fechaInicio || !this.edicion.fechaFin || this.edicion.fechaFin < this.edicion.fechaInicio) {
      this.notification.warning('Revise las fechas.');
      return;
    }
    if (this.fechaPasada(this.edicion.fechaInicio) || this.fechaPasada(this.edicion.fechaFin)) {
      this.notification.warning('Las fechas deben ser hoy o posteriores.');
      return;
    }
    this.gestionando = true;
    this.solicitudesService.editar(this.editando.id, this.edicion).subscribe({
      next: (r) => {
        this.gestionando = false;
        this.editando = null;
        const s = r?.solicitud as SolicitudResponse | undefined;
        if (s?.estado === 'aprobado' && s.aprobacionAutomatica) this.notification.success('Solicitud actualizada y aprobada automáticamente.');
        else if (s?.estado === 'rechazado') this.notification.error(s.comentarioGestion || 'La solicitud fue rechazada automáticamente.', 'Solicitud rechazada', 9000);
        else if (s?.motivoEspera && !s.urgente) this.notification.warning(`${s.motivoEspera}. Comuníquese con su supervisor.`, 'Sigue en sala de espera', 7000);
        else this.notification.success('Solicitud actualizada.');
        this.cargarMisSolicitudes();
        this.cargarSaldos();
      },
      error: (e) => {
        this.gestionando = false;
        this.notification.error(mensajeError(e, 'No se pudo editar la solicitud'));
      }
    });
  }

  async eliminar(s: SolicitudResponse) {
    const ok = await this.notification.confirm({
      title: 'Eliminar solicitud',
      message: `¿Eliminar su solicitud de ${s.tipoNombre.toLowerCase()} del ${fechaCorta(s.fechaInicio)} al ${fechaCorta(s.fechaFin)}?`,
      confirmText: 'Eliminar',
      type: 'danger'
    });
    if (!ok) return;
    this.solicitudesService.eliminar(s.id).subscribe({
      next: () => {
        this.notification.success('Solicitud eliminada.');
        this.cargarMisSolicitudes();
        this.cargarSaldos();
      },
      error: (e) => this.notification.error(mensajeError(e, 'No se pudo eliminar'))
    });
  }

  // ==================== APROBAR / RECHAZAR ====================

  abrirGestion(s: SolicitudResponse, estado: 'aprobado' | 'rechazado') {
    this.gestion = { solicitud: s, estado, comentario: '' };
  }

  /** Correccion de una decision previa (solo si la solicitud aun no termina). */
  puedeCorregir(s: SolicitudResponse): boolean {
    return s.estado !== 'pendiente' && s.fechaFin >= this.hoy && !!s.empleadoRol && this.rolesACargo.includes(s.empleadoRol);
  }

  get gestionRequiereComentario(): boolean {
    return this.gestion?.estado === 'rechazado';
  }

  confirmarGestion() {
    if (!this.gestion) return;
    if (this.gestionRequiereComentario && !this.gestion.comentario.trim()) {
      this.notification.warning('Indique el motivo del rechazo.');
      return;
    }
    const { solicitud, estado, comentario } = this.gestion;
    this.gestionando = true;
    this.solicitudesService.gestionar(solicitud.id, estado, comentario.trim() || undefined).subscribe({
      next: () => {
        this.gestionando = false;
        this.gestion = null;
        this.notification.success(`Solicitud de ${solicitud.empleadoNombre} ${estado === 'aprobado' ? 'aprobada' : 'rechazada'}.`);
        this.cargarPorAprobar();
        this.cargarEquipo();
        this.notificacionesService.cargarResumen().subscribe();
      },
      error: (e) => {
        this.gestionando = false;
        this.notification.error(mensajeError(e, 'No se pudo procesar la solicitud'), 'Error', 7000);
      }
    });
  }

  // ==================== PRESENTACION ====================

  estadoClase(estado: EstadoSolicitud | string): string {
    switch (estado) {
      case 'aprobado': return 'badge-green';
      case 'rechazado': return 'badge-red';
      default: return 'badge-amber';
    }
  }

  estadoTexto(estado: string): string {
    return estado === 'aprobado' ? 'Aprobada' : estado === 'rechazado' ? 'Rechazada' : 'Pendiente';
  }

  motivoLimpio(s: SolicitudResponse): string {
    return (s.motivo || '').split('\n\nCONFLICTO DE FECHAS:')[0].trim();
  }

  tieneConflicto(s: SolicitudResponse): boolean {
    return (s.motivo || '').includes('CONFLICTO DE FECHAS:');
  }

  // ==================== EXPORTAR ====================

  private filasExportacion(lista: SolicitudResponse[]) {
    return lista.map(s => ({
      Empleado: s.empleadoNombre,
      Rol: rolLabel(s.empleadoRol),
      Tipo: s.tipoNombre,
      Desde: fechaCorta(s.fechaInicio),
      Hasta: fechaCorta(s.fechaFin),
      Dias: dias(s.diasSolicitados),
      Estado: this.estadoTexto(s.estado),
      'Gestionado por': s.aprobadoPor || (s.aprobacionAutomatica ? 'Automática (sistema)' : ''),
      Comentario: s.comentarioGestion || '',
      Motivo: this.motivoLimpio(s)
    }));
  }

  exportarExcel(lista: SolicitudResponse[], nombre: string) {
    this.exportService.exportToExcel(this.filasExportacion(lista), `${nombre}_${this.hoy}`, 'Solicitudes');
  }

  exportarPDF(lista: SolicitudResponse[], titulo: string, nombre: string) {
    const filas = this.filasExportacion(lista);
    const columnas = ['Empleado', 'Tipo', 'Desde', 'Hasta', 'Dias', 'Estado', 'Gestionado por', 'Comentario']
      .map(c => ({ header: c, dataKey: c }));
    this.exportService.exportToPDF(filas, columnas, { title: titulo, filename: `${nombre}_${this.hoy}` });
  }
}
