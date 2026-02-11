import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth';
import { EventosService } from '../../services/eventos';
import { NotificationService } from '../../services/notification.service';
import { ApiConfigService } from '../../services/api-config.service';
import { Evento, EventoRequest, RespuestaEventoRequest } from '../../interfaces/evento';

@Component({
  selector: 'app-eventos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './eventos.html',
  styleUrls: ['./eventos.css']
})
export class EventosComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private eventosService = inject(EventosService);
  private notification = inject(NotificationService);
  private apiConfig = inject(ApiConfigService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  eventos: Evento[] = [];
  isLoading = false;
  filtroEstado = 'todos';

  // Modo de vista: 'mis-eventos' (todos) o 'gestion' (solo admin)
  modoVista: 'mis-eventos' | 'gestion' = 'mis-eventos';

  // Para empleados
  filtroMisEventos: 'pendientes' | 'respondidos' = 'pendientes';

  // Filtro de fecha para Mis Eventos (por defecto últimos 7 días)
  filtroDias: number = 7;
  opcionesDias = [
    { value: 7, label: 'Últimos 7 días' },
    { value: 15, label: 'Últimos 15 días' },
    { value: 30, label: 'Últimos 30 días' },
    { value: 90, label: 'Últimos 3 meses' },
    { value: -1, label: 'Todos' }
  ];

  // Filtro de fecha para Gestión (por defecto Hoy)
  filtroDiasAdmin: number = 0;
  opcionesDiasAdmin = [
    { value: 0, label: 'Hoy' },
    { value: 7, label: 'Últimos 7 días' },
    { value: 15, label: 'Últimos 15 días' },
    { value: 30, label: 'Último mes' },
    { value: 90, label: 'Últimos 3 meses' },
    { value: -1, label: 'Todos' }
  ];

  // Modal crear/editar
  mostrarModalEvento = false;
  eventoEdit: EventoRequest = this.nuevoEvento();
  eventoEditId: number | null = null;
  isGuardando = false;
  opcionNueva = '';

  // Modal responder (para empleados)
  mostrarModalResponder = false;
  eventoResponder: Evento | null = null;
  respuestaEnviando = false;

  private intervaloAutoRefresh: any;

  // Fecha minima para validacion
  fechaMinima: string = '';

  rolesDisponibles = [
    { value: 'admin', label: 'Administrador' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'tecnico', label: 'Tecnico' },
    { value: 'hd', label: 'HD' },
    { value: 'noc', label: 'NOC' }
  ];

  tiposEvento = [
    { value: 'ENCUESTA', label: 'Encuesta' },
    { value: 'SI_NO', label: 'SI/NO' },
    { value: 'ASISTENCIA', label: 'Asistencia' },
    { value: 'INFORMATIVO', label: 'Informativo' }
  ];

  ngOnInit() {
    // Verificar si viene con modo=gestion o modo=admin en query params
    this.route.queryParams.subscribe(params => {
      if ((params['modo'] === 'gestion' || params['modo'] === 'admin') && this.puedeGestionar()) {
        this.modoVista = 'gestion';
      } else {
        this.modoVista = 'mis-eventos';
      }
      this.cargarEventos();
    });

    this.actualizarFechaMinima();

    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 5000);
  }

  ngOnDestroy() {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || this.mostrarModalEvento || this.mostrarModalResponder) return;
    if (this.esVistaGestion()) {
      this.eventosService.getTodosEventos().subscribe({
        next: (eventos) => this.eventos = eventos
      });
    } else {
      this.eventosService.getEventosActivos().subscribe({
        next: (eventos) => this.eventos = eventos
      });
    }
  }

  actualizarFechaMinima() {
    const ahora = new Date();
    this.fechaMinima = this.formatLocalDateTime(ahora);
  }

  // Formatea una fecha como 'YYYY-MM-DDTHH:mm' usando hora local (Peru)
  private formatLocalDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Puede gestionar eventos (admin/supervisor)
  puedeGestionar(): boolean {
    return this.auth.isAdmin() || this.auth.isSupervisor();
  }

  // Mostrar vista de gestión (admin mode)
  esVistaGestion(): boolean {
    return this.modoVista === 'gestion' && this.puedeGestionar();
  }

  // Alias para compatibilidad
  esAdmin(): boolean {
    return this.esVistaGestion();
  }

  cargarEventos() {
    this.isLoading = true;

    if (this.esVistaGestion()) {
      // Vista gestión: cargar todos los eventos
      this.eventosService.getTodosEventos().subscribe({
        next: (eventos) => {
          this.eventos = eventos;
          this.isLoading = false;
        },
        error: (err) => {
          this.notification.error(err, 'Error al cargar eventos');
          this.isLoading = false;
        }
      });
    } else {
      // Vista Mis Eventos: cargar solo eventos activos para el usuario
      this.eventosService.getEventosActivos().subscribe({
        next: (eventos) => {
          this.eventos = eventos;
          this.isLoading = false;
        },
        error: (err) => {
          this.notification.error(err, 'Error al cargar eventos');
          this.isLoading = false;
        }
      });
    }
  }

  // Filtrado para admin (aplica filtro de estado y fecha)
  get eventosFiltrados(): Evento[] {
    let resultado = this.filtrarPorFechaAdmin(this.eventos);

    if (this.filtroEstado === 'todos') {
      return resultado;
    }
    return resultado.filter(e => e.estado === this.filtroEstado);
  }

  // Filtrar por fecha para admin (con opción Hoy)
  filtrarPorFechaAdmin(eventos: Evento[]): Evento[] {
    if (this.filtroDiasAdmin === -1) {
      return eventos; // Mostrar todos
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    if (this.filtroDiasAdmin === 0) {
      // Hoy: eventos que iniciaron hoy o están activos hoy (no futuros)
      return eventos.filter(e => {
        if (!e.fechaInicio) return true;
        const fechaEvento = new Date(e.fechaInicio);
        fechaEvento.setHours(0, 0, 0, 0);
        // Evento inicia hoy O evento inició antes y sigue activo hoy
        return fechaEvento.getTime() === hoy.getTime() ||
               (fechaEvento < hoy && (!e.fechaFin || new Date(e.fechaFin) >= hoy));
      });
    }

    // Últimos N días (no incluye eventos futuros)
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - this.filtroDiasAdmin);
    fechaLimite.setHours(0, 0, 0, 0);

    return eventos.filter(e => {
      if (!e.fechaInicio) return true;
      const fechaEvento = new Date(e.fechaInicio);
      // Evento dentro del rango Y no es futuro (inicia antes de mañana)
      return fechaEvento >= fechaLimite && fechaEvento < manana;
    });
  }

  // Cambiar filtro de estado y resetear filtro de fecha a Hoy
  cambiarFiltroEstado(estado: string) {
    this.filtroEstado = estado;
    this.filtroDiasAdmin = 0; // Reset a "Hoy"
  }

  // Filtrar por fecha para Mis Eventos (últimos N días)
  filtrarPorFecha(eventos: Evento[]): Evento[] {
    if (this.filtroDias === -1) {
      return eventos; // Mostrar todos
    }

    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - this.filtroDias);

    return eventos.filter(e => {
      if (!e.fechaInicio) return true;
      const fechaEvento = new Date(e.fechaInicio);
      return fechaEvento >= fechaLimite;
    });
  }

  // Filtrado para empleados (aplica filtro de fecha)
  get misEventosFiltrados(): Evento[] {
    let resultado = this.filtrarPorFecha(this.eventos);

    if (this.filtroMisEventos === 'pendientes') {
      return resultado.filter(e => !e.yaRespondio);
    }
    return resultado.filter(e => e.yaRespondio);
  }

  // Contadores para empleados (aplican filtro de fecha)
  get eventosPendientesCount(): number {
    return this.filtrarPorFecha(this.eventos).filter(e => !e.yaRespondio).length;
  }

  get eventosRespondidosCount(): number {
    return this.filtrarPorFecha(this.eventos).filter(e => e.yaRespondio).length;
  }

  nuevoEvento(): EventoRequest {
    this.actualizarFechaMinima();
    // Fecha fin por defecto: mismo día a las 23:59
    const fechaFinDefault = new Date();
    fechaFinDefault.setHours(23, 59, 0, 0);
    const fechaFinStr = this.formatLocalDateTime(fechaFinDefault);

    return {
      titulo: '',
      descripcion: '',
      tipoEvento: 'INFORMATIVO',
      fechaInicio: this.fechaMinima,
      fechaFin: fechaFinStr,
      rolesVisibles: ['admin', 'supervisor', 'tecnico', 'hd', 'noc'],
      permiteComentarios: true,
      requiereRespuesta: true,
      opciones: []
    };
  }

  abrirModalCrear() {
    this.actualizarFechaMinima();
    this.eventoEdit = this.nuevoEvento();
    this.eventoEditId = null;
    this.mostrarModalEvento = true;
  }

  abrirModalEditar(evento: Evento) {
    this.actualizarFechaMinima();
    this.eventoEdit = {
      titulo: evento.titulo,
      descripcion: evento.descripcion,
      tipoEvento: evento.tipoEvento,
      fechaInicio: evento.fechaInicio?.substring(0, 16) || '',
      fechaFin: evento.fechaFin?.substring(0, 16) || '',
      rolesVisibles: evento.rolesVisibles || [],
      permiteComentarios: evento.permiteComentarios,
      requiereRespuesta: evento.requiereRespuesta,
      opciones: evento.opciones?.map(o => o.textoOpcion) || []
    };
    this.eventoEditId = evento.id || null;
    this.mostrarModalEvento = true;
  }

  cerrarModalEvento() {
    this.mostrarModalEvento = false;
    this.eventoEdit = this.nuevoEvento();
    this.eventoEditId = null;
    this.opcionNueva = '';
  }

  toggleRol(rol: string) {
    const index = this.eventoEdit.rolesVisibles.indexOf(rol);
    if (index > -1) {
      this.eventoEdit.rolesVisibles.splice(index, 1);
    } else {
      this.eventoEdit.rolesVisibles.push(rol);
    }
  }

  isRolSeleccionado(rol: string): boolean {
    return this.eventoEdit.rolesVisibles.includes(rol);
  }

  agregarOpcion() {
    if (this.opcionNueva.trim()) {
      if (!this.eventoEdit.opciones) {
        this.eventoEdit.opciones = [];
      }
      this.eventoEdit.opciones.push(this.opcionNueva.trim());
      this.opcionNueva = '';
    }
  }

  eliminarOpcion(index: number) {
    this.eventoEdit.opciones?.splice(index, 1);
  }

  // Validacion de fechas
  validarFechas(): boolean {
    const ahora = new Date();

    if (this.eventoEdit.fechaInicio) {
      const fechaInicio = new Date(this.eventoEdit.fechaInicio);
      if (fechaInicio < ahora) {
        this.notification.error('La fecha de inicio no puede ser anterior a la fecha actual', 'Validacion');
        return false;
      }
    }

    if (this.eventoEdit.fechaInicio && this.eventoEdit.fechaFin) {
      const fechaInicio = new Date(this.eventoEdit.fechaInicio);
      const fechaFin = new Date(this.eventoEdit.fechaFin);
      if (fechaFin < fechaInicio) {
        this.notification.error('La fecha de fin no puede ser anterior a la fecha de inicio', 'Validacion');
        return false;
      }
    }

    return true;
  }

  async guardarEvento() {
    if (!this.eventoEdit.titulo.trim()) {
      this.notification.error('El titulo es requerido', 'Validacion');
      return;
    }
    if (!this.eventoEdit.descripcion.trim()) {
      this.notification.error('La descripcion es requerida', 'Validacion');
      return;
    }
    if (!this.eventoEdit.fechaInicio) {
      this.notification.error('La fecha de inicio es requerida', 'Validacion');
      return;
    }
    if (this.eventoEdit.rolesVisibles.length === 0) {
      this.notification.error('Debe seleccionar al menos un rol', 'Validacion');
      return;
    }
    if (this.eventoEdit.tipoEvento === 'ENCUESTA' && (!this.eventoEdit.opciones || this.eventoEdit.opciones.length < 2)) {
      this.notification.error('Las encuestas requieren al menos 2 opciones', 'Validacion');
      return;
    }

    // Validar fechas solo para eventos nuevos
    if (!this.eventoEditId && !this.validarFechas()) {
      return;
    }

    this.isGuardando = true;

    const observable = this.eventoEditId
      ? this.eventosService.actualizarEvento(this.eventoEditId, this.eventoEdit)
      : this.eventosService.crearEvento(this.eventoEdit);

    observable.subscribe({
      next: () => {
        this.notification.success(
          this.eventoEditId ? 'Evento actualizado' : 'Evento creado',
          'Exitoso'
        );
        this.cargarEventos();
        this.cerrarModalEvento();
        this.isGuardando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.isGuardando = false;
      }
    });
  }

  async cambiarEstado(evento: Evento, nuevoEstado: string) {
    const labels: { [key: string]: string } = {
      'ACTIVO': 'activar',
      'FINALIZADO': 'finalizar',
      'CANCELADO': 'cancelar',
      'BORRADOR': 'pasar a borrador'
    };

    const confirmado = await this.notification.confirm({
      title: `Cambiar estado`,
      message: `Desea ${labels[nuevoEstado] || nuevoEstado} el evento "${evento.titulo}"?`,
      confirmText: 'Si, cambiar',
      cancelText: 'Cancelar',
      type: nuevoEstado === 'ACTIVO' ? 'success' : 'warning'
    });

    if (!confirmado) return;

    this.eventosService.cambiarEstado(evento.id!, nuevoEstado).subscribe({
      next: () => {
        this.notification.success(`Estado cambiado a ${nuevoEstado}`, 'Exitoso');
        this.cargarEventos();
      },
      error: (err) => {
        this.notification.error(err, 'Error');
      }
    });
  }

  async eliminarEvento(evento: Evento) {
    const confirmado = await this.notification.confirm({
      title: 'Eliminar evento',
      message: `Desea eliminar permanentemente "${evento.titulo}"? Esta accion no se puede deshacer.`,
      confirmText: 'Si, eliminar',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmado) return;

    this.eventosService.eliminarEvento(evento.id!).subscribe({
      next: () => {
        this.notification.success('Evento eliminado', 'Exitoso');
        this.cargarEventos();
      },
      error: (err) => {
        this.notification.error(err, 'Error');
      }
    });
  }

  verEstadisticas(evento: Evento) {
    this.router.navigate(['/eventos', evento.id, 'estadisticas']);
  }

  // ==================== RESPUESTAS (para empleados) ====================

  abrirModalResponder(evento: Evento) {
    this.eventoResponder = evento;
    this.mostrarModalResponder = true;
  }

  cerrarModalResponder() {
    this.mostrarModalResponder = false;
    this.eventoResponder = null;
  }

  async responderSiNo(respuesta: boolean) {
    if (!this.eventoResponder || this.respuestaEnviando) return;

    const confirmado = await this.notification.confirm({
      title: respuesta ? 'Confirmar SI' : 'Confirmar NO',
      message: `Desea responder "${respuesta ? 'SI' : 'NO'}"?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: respuesta ? 'success' : 'danger'
    });

    if (!confirmado) return;

    this.respuestaEnviando = true;
    const request: RespuestaEventoRequest = {
      eventoId: this.eventoResponder.id!,
      respuestaSiNo: respuesta
    };

    this.eventosService.responderEvento(request).subscribe({
      next: () => {
        this.notification.success(`Has respondido "${respuesta ? 'SI' : 'NO'}"`, 'Respuesta registrada');
        this.cargarEventos();
        this.cerrarModalResponder();
        this.respuestaEnviando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.respuestaEnviando = false;
      }
    });
  }

  async responderAsistencia(confirmacion: string) {
    if (!this.eventoResponder || this.respuestaEnviando) return;

    const labels: { [key: string]: string } = {
      'CONFIRMADO': 'Confirmar asistencia',
      'NO_ASISTIRE': 'No asistire',
      'PENDIENTE': 'Marcar como pendiente'
    };

    const confirmado = await this.notification.confirm({
      title: labels[confirmacion] || confirmacion,
      message: `Desea marcar su asistencia como "${labels[confirmacion]}"?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: confirmacion === 'CONFIRMADO' ? 'success' : 'warning'
    });

    if (!confirmado) return;

    this.respuestaEnviando = true;
    const request: RespuestaEventoRequest = {
      eventoId: this.eventoResponder.id!,
      confirmacionAsistencia: confirmacion
    };

    this.eventosService.responderEvento(request).subscribe({
      next: () => {
        this.notification.success(`Asistencia marcada como "${labels[confirmacion]}"`, 'Respuesta registrada');
        this.cargarEventos();
        this.cerrarModalResponder();
        this.respuestaEnviando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.respuestaEnviando = false;
      }
    });
  }

  async responderEncuesta(opcionId: number) {
    if (!this.eventoResponder || this.respuestaEnviando) return;

    const opcion = this.eventoResponder.opciones?.find(o => o.id === opcionId);

    const confirmado = await this.notification.confirm({
      title: 'Confirmar voto',
      message: `Desea votar por "${opcion?.textoOpcion}"?`,
      confirmText: 'Votar',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmado) return;

    this.respuestaEnviando = true;
    const request: RespuestaEventoRequest = {
      eventoId: this.eventoResponder.id!,
      opcionId: opcionId
    };

    this.eventosService.responderEvento(request).subscribe({
      next: () => {
        this.notification.success(`Has votado por "${opcion?.textoOpcion}"`, 'Voto registrado');
        this.cargarEventos();
        this.cerrarModalResponder();
        this.respuestaEnviando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.respuestaEnviando = false;
      }
    });
  }

  marcarEventoVisto() {
    if (!this.eventoResponder) return;

    if (this.eventoResponder.tipoEvento === 'INFORMATIVO' && !this.eventoResponder.yaRespondio) {
      const request: RespuestaEventoRequest = {
        eventoId: this.eventoResponder.id!,
        comentario: 'Visto'
      };
      this.eventosService.responderEvento(request).subscribe({
        next: () => {
          this.cargarEventos();
          this.cerrarModalResponder();
        }
      });
    } else {
      this.cerrarModalResponder();
    }
  }

  // ==================== UTILIDADES ====================

  getTipoEventoIcon(tipo: string): string {
    return this.eventosService.getTipoEventoIcon(tipo);
  }

  getTipoEventoColor(tipo: string): string {
    return this.eventosService.getTipoEventoColor(tipo);
  }

  getTipoEventoLabel(tipo: string): string {
    return this.eventosService.getTipoEventoLabel(tipo);
  }

  getEstadoLabel(estado: string): string {
    return this.eventosService.getEstadoLabel(estado);
  }

  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'BORRADOR': return 'secondary';
      case 'ACTIVO': return 'success';
      case 'FINALIZADO': return 'primary';
      case 'CANCELADO': return 'danger';
      default: return 'secondary';
    }
  }

  getFechaFormateada(fecha: string | undefined): string {
    if (!fecha) return '-';
    try {
      return new Date(fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  getFotoUrl(foto: string | undefined): string {
    if (!foto) return 'https://ui-avatars.com/api/?name=U&background=6c757d&color=fff';
    if (foto.startsWith('http')) return foto;
    return `${this.apiConfig.baseUrl}/${foto}`;
  }

  volver() {
    this.router.navigate(['/dashboard']);
  }
}
