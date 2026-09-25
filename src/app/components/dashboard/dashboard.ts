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
import { dias, diaSemanaLima, horaCorta, hoyIso, mensajeError, ZONA } from '../../utils/format';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent],
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

  empleado = this.auth.empleado;
  ahora = new Date();
  private reloj: any;
  private refresco: any;

  // Asistencia
  asistenciaHoy: AsistenciaResponse | null = null;
  cargandoAsistencia = true;
  marcando = false;
  observaciones = '';
  red: { ip: string; dentroDeRed: boolean; mensaje: string } | null = null;

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
  readonly dias = dias;

  ngOnInit() {
    this.cargarAsistencia();
    this.verificarRed();
    this.cargarSaldos();
    this.cargarHorario();
    this.cargarEventos();
    this.mostrarAvisosDeInicio();
    this.reloj = setInterval(() => this.ahora = new Date(), 1000);
    this.refresco = setInterval(() => {
      if (!this.eventoSeleccionado && !this.marcando) {
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

  verificarRed() {
    this.asistenciaService.verificarRed().subscribe({
      next: (r) => this.red = r,
      error: () => this.red = null
    });
  }

  get estado(): { texto: string; clase: string } {
    if (!this.asistenciaHoy?.horaEntrada) return { texto: 'Sin marcar', clase: 'badge-amber' };
    if (!this.asistenciaHoy.horaSalida) return { texto: 'En jornada', clase: 'badge-green' };
    return { texto: 'Jornada completa', clase: 'badge-blue' };
  }

  get puedeMarcarEntrada(): boolean {
    return !this.asistenciaHoy?.horaEntrada;
  }

  get puedeMarcarSalida(): boolean {
    return !!this.asistenciaHoy?.horaEntrada && !this.asistenciaHoy?.horaSalida;
  }

  get turnoHoy(): HorarioDia | null {
    const dia = this.diasSemana[diaSemanaLima(this.ahora)];
    return this.getHorarioDia(dia);
  }

  async marcar(tipo: 'entrada' | 'salida') {
    if (this.marcando) return;
    if (this.red && !this.red.dentroDeRed) {
      this.notification.error(`Está fuera de red (IP ${this.red.ip}). No se puede marcar asistencia desde este equipo.`, 'Fuera de red');
      return;
    }
    const confirmado = await this.notification.confirm({
      title: tipo === 'entrada' ? 'Marcar entrada' : 'Marcar salida',
      message: `${this.fechaTexto}\nHora aproximada: ${this.horaTexto.substring(0, 5)}`,
      confirmText: tipo === 'entrada' ? 'Marcar entrada' : 'Marcar salida',
      type: tipo === 'entrada' ? 'success' : 'warning'
    });
    if (!confirmado) return;

    this.marcando = true;
    this.asistenciaService.registrarAsistencia({ tipo, observaciones: this.observaciones.trim() || undefined }).subscribe({
      next: (res) => {
        this.marcando = false;
        this.observaciones = '';
        this.asistenciaHoy = res;
        const hora = horaCorta(tipo === 'entrada' ? res.horaEntrada : res.horaSalida);
        this.notification.success(
          tipo === 'entrada' ? `Entrada registrada a las ${hora}.` : `Salida registrada a las ${hora}.`,
          tipo === 'entrada' ? '¡Buen día de trabajo!' : '¡Hasta pronto!'
        );
        if (res.feriado) {
          this.notification.info(
            `Hoy es feriado (${res.feriado}). Se abonaron ${dias(res.diasCompensacionAbonados)} día(s) a su saldo de compensación.`,
            'Feriado laborado', 8000);
          this.cargarSaldos();
        }
      },
      error: (e) => {
        this.marcando = false;
        if (e.error?.fueraDeRed) this.verificarRed();
        this.notification.error(mensajeError(e, 'No se pudo registrar la asistencia'), 'No se registró la marcación', 7000);
        this.cargarAsistencia(false);
      }
    });
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
