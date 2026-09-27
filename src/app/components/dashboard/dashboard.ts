import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { AsistenciaService } from '../../services/asistencia';
import { HorariosService } from '../../services/horarios';
import { NotificationService } from '../../services/notification.service';
import { EventosService } from '../../services/eventos';
import { NotificacionesService } from '../../services/notificaciones';
import { SaldosService } from '../../services/saldos';
import { HorarioSemanal, HorarioDia } from '../../interfaces/horario';
import { Evento, RespuestaEventoRequest } from '../../interfaces/evento';
import { AsistenciaResponse } from '../../interfaces/asistencia';
import { DetalleSaldos } from '../../interfaces/saldo';
import { ModalComponent } from '../shared/modal/modal.component';
import { CamaraFacialComponent } from '../shared/camara-facial/camara-facial.component';
import { FacialService } from '../../services/facial';
import { EstadoFacial } from '../../interfaces/facial';
import { dias, diaSemanaLima, enlaceSeguro, horaCorta, hoyIso, mensajeError, ZONA } from '../../utils/format';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent, CamaraFacialComponent],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private asistenciaService = inject(AsistenciaService);
  private horariosService = inject(HorariosService);
  private notification = inject(NotificationService);
  private eventosService = inject(EventosService);
  private notificacionesService = inject(NotificacionesService);
  private saldosService = inject(SaldosService);
  private facial = inject(FacialService);

  empleado = this.auth.empleado;
  ahora = new Date();
  private reloj: any;
  private refresco: any;

  // Asistencia
  asistenciaHoy: AsistenciaResponse | null = null;
  cargandoAsistencia = true;
  marcando = false;
  red: { ip: string; dentroDeRed: boolean; mensaje: string } | null = null;

  // Reconocimiento facial
  estadoFacial: EstadoFacial | null = null;
  /** Marcacion en curso con camara abierta. */
  marcacionFacial: 'entrada' | 'salida' | null = null;

  /** Marcacion ya registrada: se muestra la hora y se ofrece dejar un mensaje al supervisor. */
  marcacionRegistrada: { tipo: 'entrada' | 'salida'; asistencia: AsistenciaResponse; facial: boolean } | null = null;
  mensaje = '';
  enviandoMensaje = false;
  readonly largoMensaje = 300;

  // Saldos
  saldos: DetalleSaldos | null = null;
  porAprobar = 0;

  // Horario
  horarioSemanal: HorarioSemanal | null = null;
  cargandoHorario = true;
  diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  diasLabels: Record<string, string> = {
    lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves',
    viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo'
  };

  // Eventos
  eventos: Evento[] = [];
  eventoSeleccionado: Evento | null = null;
  enviandoRespuesta = false;

  readonly horaCorta = horaCorta;
  readonly enlaceSeguro = enlaceSeguro;
  readonly dias = dias;

  ngOnInit() {
    this.cargarConfiguracion();
    this.cargarAsistencia();
    this.verificarRed();
    this.cargarEstadoFacial();
    this.cargarSaldos();
    this.cargarHorario();
    this.cargarEventos();
    this.mostrarAvisosDeInicio();
    this.reloj = setInterval(() => this.ahora = new Date(), 1000);
    this.refresco = setInterval(() => {
      if (!this.eventoSeleccionado && !this.marcando && !this.marcacionFacial && !this.marcacionRegistrada) {
        this.cargarAsistencia(false);
        this.cargarEventos();
      }
    }, 60000);
  }

  ngOnDestroy() {
    clearInterval(this.reloj);
    clearInterval(this.refresco);
  }

  get saludo(): string {
    const h = Number(this.ahora.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: ZONA }));
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  get primerNombre(): string {
    return (this.empleado()?.nombre || '').split(' ')[0];
  }

  get fechaTexto(): string {
    return this.ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
  }

  get horaTexto(): string {
    return this.ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: ZONA });
  }

  // ==================== ASISTENCIA ====================

  cargarAsistencia(mostrarCarga = true) {
    const id = this.empleado()?.id;
    if (!id) return;
    if (mostrarCarga) this.cargandoAsistencia = true;
    this.asistenciaService.getAsistenciasPorEmpleado(id).subscribe({
      next: (data) => {
        const hoy = hoyIso();
        this.asistenciaHoy = data.find(a => a.fecha?.toString().substring(0, 10) === hoy) || null;
        this.cargandoAsistencia = false;
      },
      error: () => {
        this.asistenciaHoy = null;
        this.cargandoAsistencia = false;
      }
    });
  }

  verificandoRed = false;

  verificarRed() {
    this.verificandoRed = true;
    this.asistenciaService.verificarRed().subscribe({
      next: (r) => { this.red = r; this.verificandoRed = false; },
      error: () => { this.red = null; this.verificandoRed = false; }
    });
  }

  get estado(): { texto: string; clase: string } {
    if (!this.asistenciaHoy?.horaEntrada) return { texto: 'Sin marcar', clase: 'badge-amber' };
    if (!this.asistenciaHoy.horaSalida) return { texto: 'En jornada', clase: 'badge-green' };
    return { texto: 'Jornada completa', clase: 'badge-blue' };
  }

  /** Solo se marca si el servidor confirmó que el equipo está en un segmento permitido. */
  get dentroDeRed(): boolean {
    return this.red?.dentroDeRed === true;
  }

  get puedeMarcarEntrada(): boolean {
    return this.dentroDeRed && !this.faltaRegistroFacial && !this.asistenciaHoy?.horaEntrada;
  }

  get puedeMarcarSalida(): boolean {
    return this.dentroDeRed && !this.faltaRegistroFacial
      && !!this.asistenciaHoy?.horaEntrada && !this.asistenciaHoy?.horaSalida;
  }

  /** Configuracion de su rol (panel admin → Asistencia y horarios). */
  config: { marcaAsistencia: boolean; conHorario: boolean; toleranciaMinutos: number } | null = null;

  /** Su rol marca asistencia (mientras carga se asume que si). */
  get marcaAsistencia(): boolean {
    return this.config?.marcaAsistencia !== false;
  }

  /** Su rol marca sin horario: marca cualquier dia y no tiene tardanzas. */
  get horarioFlexible(): boolean {
    return !!this.config && this.config.marcaAsistencia && !this.config.conHorario;
  }

  cargarConfiguracion() {
    this.asistenciaService.miConfiguracion().subscribe({ next: c => this.config = c, error: () => this.config = null });
  }

  // ==================== RECONOCIMIENTO FACIAL ====================

  cargarEstadoFacial() {
    this.facial.miEstado().subscribe({ next: (e) => this.estadoFacial = e, error: () => this.estadoFacial = null });
  }

  /** La marcacion usa la camara si hay rostro registrado o si es obligatoria. */
  get requiereRostro(): boolean {
    return !!this.estadoFacial && (this.estadoFacial.registrado || this.estadoFacial.obligatorio);
  }

  /** Marcacion facial obligatoria y el colaborador aun no registra su rostro. */
  get faltaRegistroFacial(): boolean {
    return !!this.estadoFacial && this.estadoFacial.obligatorio && !this.estadoFacial.registrado;
  }

  cancelarMarcacionFacial() {
    if (this.marcando) return;
    this.marcacionFacial = null;
  }

  /** La marcacion se registra en cuanto se captura el rostro (el mensaje es opcional y posterior). */
  rostroCapturado(descriptores: number[][]) {
    const tipo = this.marcacionFacial;
    if (!tipo) return;
    this.enviarMarcacion(tipo, descriptores[0]);
  }

  get turnoHoy(): HorarioDia | null {
    const dia = this.diasSemana[diaSemanaLima(this.ahora)];
    return this.getHorarioDia(dia);
  }

  async marcar(tipo: 'entrada' | 'salida') {
    if (this.marcando || this.marcacionFacial) return;
    if (this.red && !this.red.dentroDeRed) {
      this.notification.error(`Está fuera de red (IP ${this.red.ip}). No se puede marcar asistencia desde este equipo.`, 'Fuera de red');
      return;
    }
    if (this.faltaRegistroFacial) {
      this.notification.warning('Registre su rostro en Mi perfil para poder marcar asistencia.', 'Rostro no registrado');
      return;
    }
    if (this.requiereRostro) {
      // La captura del rostro es la confirmacion de la marcacion
      this.marcacionFacial = tipo;
      return;
    }
    const confirmado = await this.notification.confirm({
      title: tipo === 'entrada' ? 'Marcar entrada' : 'Marcar salida',
      message: `${this.fechaTexto}\nHora aproximada: ${this.horaTexto.substring(0, 5)}`,
      confirmText: tipo === 'entrada' ? 'Marcar entrada' : 'Marcar salida',
      type: tipo === 'entrada' ? 'success' : 'warning'
    });
    if (confirmado) this.enviarMarcacion(tipo);
  }

  private enviarMarcacion(tipo: 'entrada' | 'salida', descriptor?: number[]) {
    this.marcando = true;
    this.asistenciaService.registrarAsistencia({ tipo, descriptor }).subscribe({
      next: (res) => {
        this.marcando = false;
        this.marcacionFacial = null;
        this.asistenciaHoy = res;
        this.mensaje = '';
        this.enviandoMensaje = false;
        this.marcacionRegistrada = { tipo, asistencia: res, facial: !!descriptor };
        if (res.feriado) {
          this.notification.info(
            `Hoy es feriado (${res.feriado}). Se abonaron ${dias(res.diasCompensacionAbonados)} día(s) a su saldo de compensación.`,
            'Feriado laborado', 8000);
          this.cargarSaldos();
        }
      },
      error: (e) => {
        this.marcando = false;
        this.marcacionFacial = null;
        if (e.error?.fueraDeRed) this.verificarRed();
        const codigo = e.error?.codigoFacial;
        if (codigo === 'NO_REGISTRADO' || codigo === 'FALTA_ROSTRO') this.cargarEstadoFacial();
        const titulo = codigo === 'NO_COINCIDE' ? 'Rostro no reconocido' : 'No se registró la marcación';
        this.notification.error(mensajeError(e, 'No se pudo registrar la asistencia'), titulo, 7000);
        this.cargarAsistencia(false);
      }
    });
  }

  /** Hora que quedo registrada (reloj del servidor). */
  get horaRegistrada(): string {
    const m = this.marcacionRegistrada;
    if (!m) return '';
    return (m.tipo === 'entrada' ? m.asistencia.horaEntrada : m.asistencia.horaSalida) || '';
  }

  enviarMensaje() {
    const m = this.marcacionRegistrada;
    const texto = this.mensaje.trim();
    if (!m || !texto || this.enviandoMensaje) return;
    this.enviandoMensaje = true;
    this.asistenciaService.enviarMensaje(m.asistencia.id, m.tipo, texto).subscribe({
      next: (res) => {
        this.asistenciaHoy = res;
        this.notification.success('Su supervisor podrá ver el mensaje.', 'Mensaje enviado');
        this.cerrarMarcacionRegistrada();
      },
      error: (e) => {
        this.enviandoMensaje = false;
        this.notification.error(mensajeError(e, 'No se pudo enviar el mensaje'));
      }
    });
  }

  cerrarMarcacionRegistrada() {
    this.marcacionRegistrada = null;
    this.mensaje = '';
    this.enviandoMensaje = false;
  }

  // ==================== SALDOS ====================

  cargarSaldos() {
    this.saldosService.miSaldo().subscribe({ next: (s) => this.saldos = s, error: () => this.saldos = null });
  }

  // ==================== HORARIO ====================

  cargarHorario() {
    const id = this.empleado()?.id;
    if (!id) return;
    this.horariosService.getMiHorarioVigente(id).subscribe({
      next: (data) => { this.horarioSemanal = data; this.cargandoHorario = false; },
      error: () => { this.horarioSemanal = null; this.cargandoHorario = false; }
    });
  }

  getHorarioDia(dia: string): HorarioDia | null {
    return (this.horarioSemanal?.horariosSemana as any)?.[dia] || null;
  }

  esHoy(dia: string): boolean {
    return this.diasSemana[diaSemanaLima(this.ahora)] === dia;
  }

  tipoDiaLabel(tipo?: string): string {
    const map: Record<string, string> = {
      descanso: 'Descanso', compensado: 'Compensado', vacaciones: 'Vacaciones',
      descanso_medico: 'Descanso médico', licencia: 'Licencia', permiso: 'Permiso'
    };
    return tipo ? (map[tipo] || tipo) : 'Laboral';
  }

  turnoLabel(turno?: string): string {
    return turno === 'manana' ? 'Mañana' : turno === 'tarde' ? 'Tarde' : (turno || '—');
  }

  tieneHorario(): boolean {
    return this.diasSemana.some(d => this.getHorarioDia(d));
  }

  // ==================== EVENTOS ====================

  cargarEventos() {
    this.eventosService.getEventosActivos().subscribe({
      next: (ev) => this.eventos = ev.filter(e => !e.yaRespondio),
      error: () => this.eventos = []
    });
  }

  icono(tipo: string) { return this.eventosService.getTipoEventoIcon(tipo); }
  tipoLabel(tipo: string) { return this.eventosService.getTipoEventoLabel(tipo); }

  private responder(req: RespuestaEventoRequest, mensaje: string) {
    this.enviandoRespuesta = true;
    this.eventosService.responderEvento(req).subscribe({
      next: () => {
        this.enviandoRespuesta = false;
        this.notification.success(mensaje, 'Respuesta registrada');
        this.eventoSeleccionado = null;
        this.cargarEventos();
        this.notificacionesService.cargarResumen().subscribe();
      },
      error: (e) => {
        this.enviandoRespuesta = false;
        this.notification.error(mensajeError(e), 'Error');
      }
    });
  }

  responderSiNo(evento: Evento, valor: boolean) {
    this.responder({ eventoId: evento.id!, respuestaSiNo: valor }, `Respondió "${valor ? 'Sí' : 'No'}".`);
  }

  responderAsistencia(evento: Evento, confirmacion: string) {
    const labels: Record<string, string> = { CONFIRMADO: 'Asistiré', NO_ASISTIRE: 'No asistiré', PENDIENTE: 'Aún no sé' };
    this.responder({ eventoId: evento.id!, confirmacionAsistencia: confirmacion }, `Marcó "${labels[confirmacion]}".`);
  }

  votar(evento: Evento, opcionId: number) {
    const opcion = evento.opciones?.find(o => o.id === opcionId);
    this.responder({ eventoId: evento.id!, opcionId }, `Votó por "${opcion?.textoOpcion}".`);
  }

  marcarVisto(evento: Evento) {
    this.responder({ eventoId: evento.id!, comentario: 'Visto' }, 'Marcado como leído.');
  }

  // ==================== AVISOS ====================

  private mostrarAvisosDeInicio() {
    this.notificacionesService.cargarResumen().subscribe({
      next: (r) => {
        if (!r) return;
        this.porAprobar = r.solicitudesPendientes || 0;
        if (sessionStorage.getItem('notificacionesMostradas')) return;
        sessionStorage.setItem('notificacionesMostradas', 'true');
        if (r.solicitudesAprobadas > 0) {
          this.notification.success(`Tiene ${r.solicitudesAprobadas} solicitud(es) aprobada(s) recientemente.`, 'Solicitudes');
        }
        if (r.solicitudesRechazadas > 0) {
          this.notification.warning(`Tiene ${r.solicitudesRechazadas} solicitud(es) rechazada(s) recientemente.`, 'Solicitudes');
        }
        if (r.solicitudesPendientes > 0) {
          this.notification.info(`Hay ${r.solicitudesPendientes} solicitud(es) esperando su aprobación.`, 'Por aprobar');
        }
      }
    });
  }
}
