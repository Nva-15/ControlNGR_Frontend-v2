import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { AsistenciaService } from '../../services/asistencia';
import { HorariosService } from '../../services/horarios';
import { NotificationService } from '../../services/notification.service';
import { ApiConfigService } from '../../services/api-config.service';
import { EventosService } from '../../services/eventos';
import { NotificacionesService } from '../../services/notificaciones';
import { HorarioSemanal, HorarioDia } from '../../interfaces/horario';
import { Evento, RespuestaEventoRequest } from '../../interfaces/evento';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('fileInputModal') fileInputModal!: ElementRef;

  private intervaloReloj: any;
  private intervaloAutoRefresh: any;

  private auth = inject(AuthService);
  private asistenciaService = inject(AsistenciaService);
  private horariosService = inject(HorariosService);
  private notification = inject(NotificationService);
  private apiConfig = inject(ApiConfigService);
  private eventosService = inject(EventosService);
  private notificacionesService = inject(NotificacionesService);
  private http = inject(HttpClient);
  private router = inject(Router);

  currentEmpleado: any;
  fotoUrl: string = '';

  fechaActual = new Date();
  asistenciaHoy: any = null;
  isLoading = true;

  tipoMarcaje: 'entrada' | 'salida' = 'entrada';
  observaciones = '';

  mostrarModalPerfil = false;
  isUpdating = false;
  mensajeModal = '';
  mensajeErrorModal = '';

  descripcionEdit = '';
  hobbyEdit = '';
  fotoPreviewModal: string | null = null;
  fotoFileModal: File | null = null;

  mostrarSeccionPassword = false;
  passwordActual = '';
  passwordNueva = '';
  passwordConfirmar = '';

  horarioSemanal: HorarioSemanal | null = null;
  isLoadingHorario = false;
  diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  diasLabels: { [key: string]: string } = {
    'lunes': 'Lun', 'martes': 'Mar', 'miercoles': 'Mie',
    'jueves': 'Jue', 'viernes': 'Vie', 'sabado': 'Sab', 'domingo': 'Dom'
  };

  // Eventos
  eventosActivos: Evento[] = [];
  isLoadingEventos = false;
  eventoSeleccionado: Evento | null = null;
  mostrarModalEvento = false;
  respuestaEnviando = false;

  ngOnInit() {
    this.currentEmpleado = this.auth.getCurrentEmpleado();

    if (!this.currentEmpleado) {
      this.router.navigate(['/login']);
      return;
    }

    this.fotoUrl = this.getFotoUrl(
      this.currentEmpleado.foto,
      this.currentEmpleado.nombre
    );

    this.cargarAsistencia();
    this.cargarHorario();
    this.cargarEventos();
    this.mostrarNotificacionesPostLogin();

    // Actualizar la hora cada segundo
    this.intervaloReloj = setInterval(() => {
      this.fechaActual = new Date();
    }, 1000);

    // Auto-refresh datos cada 5 segundos
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 5000);
  }

  ngOnDestroy() {
    if (this.intervaloReloj) clearInterval(this.intervaloReloj);
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || !this.currentEmpleado?.id) return;
    if (this.mostrarModalPerfil || this.mostrarModalEvento) return;
    this.asistenciaService.getAsistenciasPorEmpleado(this.currentEmpleado.id).subscribe({
      next: (data: any[]) => {
        const hoy = new Date().toLocaleDateString('en-CA');
        this.asistenciaHoy = data.find((a: any) => a.fecha && a.fecha.toString().substring(0, 10) === hoy) || null;
      }
    });
    this.eventosService.getEventosActivos().subscribe({
      next: (eventos) => this.eventosActivos = eventos.filter(e => !e.yaRespondio)
    });
    if (this.currentEmpleado.rol !== 'admin') {
      this.horariosService.getMiHorarioVigente(this.currentEmpleado.id).subscribe({
        next: (data) => this.horarioSemanal = data
      });
    }
  }

  private getFotoUrl(fotoPath: string | undefined, nombre: string): string {
    if (!fotoPath || fotoPath === 'img/perfil.png') {
      return this.getAvatarPlaceholder(nombre);
    }

    if (fotoPath.startsWith('http')) {
      return fotoPath;
    }

    return `${this.apiConfig.baseUrl}/${fotoPath}`;
  }

  private getAvatarPlaceholder(nombre: string): string {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=0d6efd&color=fff&size=150`;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = this.getAvatarPlaceholder(this.currentEmpleado?.nombre || 'Usuario');
  }

  cargarAsistencia() {
    this.isLoading = true;
    this.asistenciaService.getAsistenciasPorEmpleado(this.currentEmpleado.id).subscribe({
      next: (data: any[]) => {
        const hoy = new Date().toLocaleDateString('en-CA');

        this.asistenciaHoy = data.find((a: any) => {
          return a.fecha && a.fecha.toString().substring(0, 10) === hoy;
        }) || null;

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.asistenciaHoy = null;
      }
    });
  }

  async marcarAsistencia() {
    if (!this.currentEmpleado) return;

    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const horaFormateada = ahora.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const esMarcajeEntrada = this.tipoMarcaje === 'entrada';
    const tipoTexto = esMarcajeEntrada ? 'ENTRADA' : 'SALIDA';

    const confirmado = await this.notification.confirm({
      title: `Confirmar Marcaje de ${tipoTexto}`,
      message: `Desea registrar su ${tipoTexto.toLowerCase()}?\n\n${fechaFormateada}\n${horaFormateada}`,
      confirmText: `Marcar ${tipoTexto}`,
      cancelText: 'Cancelar',
      type: esMarcajeEntrada ? 'success' : 'danger'
    });

    if (!confirmado) return;

    const req = {
      empleadoId: this.currentEmpleado.id,
      tipo: this.tipoMarcaje,
      observaciones: this.observaciones.trim() || undefined
    };

    this.asistenciaService.registrarAsistencia(req).subscribe({
      next: (res: any) => {
        const hora = this.tipoMarcaje === 'entrada' ? res.horaEntrada : res.horaSalida;
        const horaCorta = hora ? hora.substring(0, 5) : horaFormateada;

        if (esMarcajeEntrada) {
          this.notification.success(
            `Entrada registrada a las ${horaCorta}`,
            'Buen dia de trabajo!'
          );
        } else {
          this.notification.success(
            `Salida registrada a las ${horaCorta}`,
            'Hasta pronto!'
          );
        }

        this.observaciones = '';
        this.cargarAsistencia();
      },
      error: (e: any) => {
        this.notification.error(
          e.error?.error || 'Error al registrar asistencia',
          'Error de marcaje'
        );
        this.cargarAsistencia();
      }
    });
  }

  puedeMarcarEntrada(): boolean {
    return !this.asistenciaHoy;
  }

  puedeMarcarSalida(): boolean {
    return this.asistenciaHoy && this.asistenciaHoy.horaEntrada && !this.asistenciaHoy.horaSalida;
  }

  getEstadoAsistencia(): string {
    if (!this.asistenciaHoy) return 'SIN REGISTRO';
    if (this.asistenciaHoy.horaEntrada && !this.asistenciaHoy.horaSalida) return 'EN TRABAJO';
    if (this.asistenciaHoy.horaEntrada && this.asistenciaHoy.horaSalida) return 'COMPLETADO';
    return '-';
  }

  getBadgeColor(): string {
    switch(this.getEstadoAsistencia()) {
      case 'EN TRABAJO': return 'success';
      case 'COMPLETADO': return 'primary';
      case 'SIN REGISTRO': return 'warning';
      default: return 'secondary';
    }
  }

  getHoraFormateada(hora: string | undefined): string {
    return hora ? hora.substring(0, 5) : '--:--';
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  isSupervisor(): boolean {
    return this.auth.isSupervisor();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  irASolicitudes() {
    const tab = (this.isAdmin() || this.isSupervisor()) ? 'aprobar' : 'mis-solicitudes';
    this.router.navigate(['/solicitudes'], { queryParams: { tab } });
  }

  getUserRole(): string {
    return this.auth.getUserRole();
  }

  getRolDisplayName(): string {
    return this.auth.getRolDisplayName();
  }

  abrirModalPerfil() {
    this.descripcionEdit = this.currentEmpleado?.descripcion || '';
    this.hobbyEdit = this.currentEmpleado?.hobby || '';
    this.fotoPreviewModal = null;
    this.fotoFileModal = null;
    this.mostrarSeccionPassword = false;
    this.passwordActual = '';
    this.passwordNueva = '';
    this.passwordConfirmar = '';
    this.mensajeModal = '';
    this.mensajeErrorModal = '';
    this.mostrarModalPerfil = true;
  }

  cerrarModalPerfil() {
    this.mostrarModalPerfil = false;
    this.fotoPreviewModal = null;
    this.fotoFileModal = null;
    if (this.fileInputModal) {
      this.fileInputModal.nativeElement.value = '';
    }
  }

  onFileSelectedModal(event: any) {
    const file = event.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/bmp'];

      // Verificar tipo MIME
      if (!validTypes.includes(file.type)) {
        this.mostrarErrorModal('Solo se permiten imagenes JPG, PNG, GIF o BMP. WebP no es soportado.');
        event.target.value = '';
        return;
      }

      // Verificar extensión del archivo
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith('.webp')) {
        this.mostrarErrorModal('Formato WebP no soportado. Use JPG, PNG, GIF o BMP.');
        event.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.mostrarErrorModal('La imagen no debe superar los 5MB');
        event.target.value = '';
        return;
      }

      this.fotoFileModal = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.fotoPreviewModal = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  cancelarFotoModal() {
    this.fotoPreviewModal = null;
    this.fotoFileModal = null;
    if (this.fileInputModal) {
      this.fileInputModal.nativeElement.value = '';
    }
  }

  guardarDatosPersonales() {
    if (!this.currentEmpleado?.id) return;

    this.isUpdating = true;
    this.mensajeErrorModal = '';

    const datos = {
      descripcion: this.descripcionEdit.trim(),
      hobby: this.hobbyEdit.trim()
    };

    this.http.put(`${this.apiConfig.apiUrl}/auth/perfil/actualizar`, datos, {
      headers: { 'Authorization': `Bearer ${this.auth.getToken()}` }
    }).subscribe({
      next: () => {
        this.currentEmpleado.descripcion = this.descripcionEdit.trim();
        this.currentEmpleado.hobby = this.hobbyEdit.trim();
        localStorage.setItem('currentEmpleado', JSON.stringify(this.currentEmpleado));
        this.mostrarMensajeModal('Datos actualizados correctamente');
        this.isUpdating = false;
      },
      error: (e: any) => {
        this.mostrarErrorModal(e.error?.error || 'Error al actualizar datos');
        this.isUpdating = false;
      }
    });
  }

  guardarFoto() {
    if (!this.currentEmpleado?.id || !this.fotoFileModal) return;

    this.isUpdating = true;
    this.mensajeErrorModal = '';

    const formData = new FormData();
    formData.append('archivo', this.fotoFileModal);

    this.http.post(`${this.apiConfig.apiUrl}/imagenes/upload/${this.currentEmpleado.id}`, formData, {
      headers: { 'Authorization': `Bearer ${this.auth.getToken()}` }
    }).subscribe({
      next: (response: any) => {
        if (response.success && response.ruta) {
          this.currentEmpleado.foto = response.ruta;
          localStorage.setItem('currentEmpleado', JSON.stringify(this.currentEmpleado));
          this.fotoUrl = this.getFotoUrl(response.ruta, this.currentEmpleado.nombre);
          this.mostrarMensajeModal('Foto actualizada correctamente');
          this.cancelarFotoModal();
        } else if (response.error) {
          // Manejar respuesta de error dentro de la respuesta exitosa
          this.mostrarErrorModal(response.error);
        }
        this.isUpdating = false;
      },
      error: (e) => {
        const errorMsg = e.error?.error || e.error?.message || e.message || 'Error al subir la imagen';
        this.mostrarErrorModal(errorMsg);
        this.isUpdating = false;
      }
    });
  }

  cambiarPassword() {
    if (!this.currentEmpleado?.username) return;

    if (!this.passwordActual || !this.passwordNueva || !this.passwordConfirmar) {
      this.mostrarErrorModal('Todos los campos de contrasena son requeridos');
      return;
    }

    if (this.passwordNueva.length < 6) {
      this.mostrarErrorModal('La nueva contrasena debe tener al menos 6 caracteres');
      return;
    }

    if (this.passwordNueva !== this.passwordConfirmar) {
      this.mostrarErrorModal('Las contrasenas no coinciden');
      return;
    }

    this.isUpdating = true;
    this.mensajeErrorModal = '';

    this.auth.cambiarPassword(
      this.currentEmpleado.username,
      this.passwordActual,
      this.passwordNueva
    ).subscribe({
      next: () => {
        this.mostrarMensajeModal('Contrasena cambiada exitosamente');
        this.passwordActual = '';
        this.passwordNueva = '';
        this.passwordConfirmar = '';
        this.mostrarSeccionPassword = false;
        this.isUpdating = false;
      },
      error: (e) => {
        this.mostrarErrorModal(e.error?.error || 'Error al cambiar contrasena');
        this.isUpdating = false;
      }
    });
  }

  private mostrarMensajeModal(msg: string) {
    this.mensajeModal = msg;
    this.mensajeErrorModal = '';
    setTimeout(() => this.mensajeModal = '', 4000);

    // Mostrar toast de éxito
    this.notification.success(msg, 'Exitoso');
  }

  private mostrarErrorModal(msg: string) {
    this.mensajeErrorModal = msg;
    this.mensajeModal = '';
    setTimeout(() => this.mensajeErrorModal = '', 5000);

    // Mostrar toast de error (rojo)
    this.notification.error(msg, 'Error');
  }

  getNivelDisplay(nivel: string): string {
    switch (nivel?.toLowerCase()) {
      case 'jefe': return 'Jefe/Gerente';
      case 'supervisor': return 'Supervisor';
      case 'tecnico': return 'Tecnico';
      case 'hd': return 'HD';
      case 'bo': return 'Back Office';
      case 'noc': return 'NOC';
      default: return nivel || 'Sin nivel';
    }
  }

  cargarHorario() {
    if (!this.currentEmpleado?.id) return;
    if (this.currentEmpleado.rol === 'admin') return;

    this.isLoadingHorario = true;
    // Usar horario semanal activo (nuevo sistema) en vez de horario base (tabla vieja)
    this.horariosService.getMiHorarioVigente(this.currentEmpleado.id).subscribe({
      next: (data) => {
        this.horarioSemanal = data;
        this.isLoadingHorario = false;
      },
      error: () => {
        this.isLoadingHorario = false;
        this.horarioSemanal = null;
      }
    });
  }

  getHorarioDia(dia: string): HorarioDia | null {
    if (!this.horarioSemanal) return null;
    const horarios = this.horarioSemanal.horariosSemana as any;
    return horarios[dia] || null;
  }

  getTipoDiaLabel(tipo: string | undefined): string {
    switch (tipo) {
      case 'descanso': return 'Descanso';
      case 'compensado': return 'Compensado';
      case 'vacaciones': return 'Vacaciones';
      default: return 'Normal';
    }
  }

  tieneHorarioAsignado(): boolean {
    if (!this.horarioSemanal) return false;
    return this.diasSemana.some(dia => this.getHorarioDia(dia) !== null);
  }

  getRolDisplay(rol: string): string {
    switch (rol?.toLowerCase()) {
      case 'admin': return 'Administrador';
      case 'supervisor': return 'Supervisor';
      case 'tecnico': return 'Tecnico';
      case 'hd': return 'HD';
      case 'noc': return 'NOC';
      default: return rol || 'Sin rol';
    }
  }

  getFechaEnEspanol(): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const fecha = this.fechaActual;
    const diaSemana = dias[fecha.getDay()];
    const diaMes = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();

    // Obtener la hora actual
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const segundos = fecha.getSeconds().toString().padStart(2, '0');

    return `${diaSemana}, ${diaMes} de ${mes} de ${año} - ${horas}:${minutos}:${segundos}`;
  }

  // ==================== EVENTOS ====================

  cargarEventos() {
    this.isLoadingEventos = true;
    this.eventosService.getEventosActivos().subscribe({
      next: (eventos) => {
        // Solo mostrar eventos que NO han sido respondidos
        this.eventosActivos = eventos.filter(e => !e.yaRespondio);
        this.isLoadingEventos = false;
      },
      error: () => {
        this.isLoadingEventos = false;
        this.eventosActivos = [];
      }
    });
  }

  abrirEvento(evento: Evento) {
    this.eventoSeleccionado = evento;
    this.mostrarModalEvento = true;
  }

  cerrarModalEvento() {
    this.mostrarModalEvento = false;
    this.eventoSeleccionado = null;
  }

  getTipoEventoIcon(tipo: string): string {
    return this.eventosService.getTipoEventoIcon(tipo);
  }

  getTipoEventoColor(tipo: string): string {
    return this.eventosService.getTipoEventoColor(tipo);
  }

  getTipoEventoLabel(tipo: string): string {
    return this.eventosService.getTipoEventoLabel(tipo);
  }

  getFechaEventoFormateada(fecha: string | undefined): string {
    if (!fecha) return 'Sin fecha';
    try {
      const date = new Date(fecha);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  async responderSiNo(evento: Evento, respuesta: boolean) {
    if (this.respuestaEnviando) return;

    const confirmado = await this.notification.confirm({
      title: respuesta ? 'Confirmar SI' : 'Confirmar NO',
      message: `Desea responder "${respuesta ? 'SI' : 'NO'}" a "${evento.titulo}"?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: respuesta ? 'success' : 'danger'
    });

    if (!confirmado) return;

    this.respuestaEnviando = true;
    const request: RespuestaEventoRequest = {
      eventoId: evento.id!,
      respuestaSiNo: respuesta
    };

    this.eventosService.responderEvento(request).subscribe({
      next: () => {
        this.notification.success(
          `Has respondido "${respuesta ? 'SI' : 'NO'}"`,
          'Respuesta registrada'
        );
        this.cargarEventos();
        this.cerrarModalEvento();
        this.respuestaEnviando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.respuestaEnviando = false;
      }
    });
  }

  async responderAsistencia(evento: Evento, confirmacion: string) {
    if (this.respuestaEnviando) return;

    const labels: { [key: string]: string } = {
      'CONFIRMADO': 'Confirmar asistencia',
      'NO_ASISTIRE': 'No asistire',
      'PENDIENTE': 'Marcar como pendiente'
    };

    const confirmado = await this.notification.confirm({
      title: labels[confirmacion] || confirmacion,
      message: `Desea marcar su asistencia como "${labels[confirmacion]}" para "${evento.titulo}"?`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      type: confirmacion === 'CONFIRMADO' ? 'success' : 'warning'
    });

    if (!confirmado) return;

    this.respuestaEnviando = true;
    const request: RespuestaEventoRequest = {
      eventoId: evento.id!,
      confirmacionAsistencia: confirmacion
    };

    this.eventosService.responderEvento(request).subscribe({
      next: () => {
        this.notification.success(
          `Asistencia marcada como "${labels[confirmacion]}"`,
          'Respuesta registrada'
        );
        this.cargarEventos();
        this.cerrarModalEvento();
        this.respuestaEnviando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.respuestaEnviando = false;
      }
    });
  }

  async responderEncuesta(evento: Evento, opcionId: number) {
    if (this.respuestaEnviando) return;

    const opcion = evento.opciones?.find(o => o.id === opcionId);

    const confirmado = await this.notification.confirm({
      title: 'Confirmar voto',
      message: `Desea votar por "${opcion?.textoOpcion}" en "${evento.titulo}"?`,
      confirmText: 'Votar',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmado) return;

    this.respuestaEnviando = true;
    const request: RespuestaEventoRequest = {
      eventoId: evento.id!,
      opcionId: opcionId
    };

    this.eventosService.responderEvento(request).subscribe({
      next: () => {
        this.notification.success(
          `Has votado por "${opcion?.textoOpcion}"`,
          'Voto registrado'
        );
        this.cargarEventos();
        this.cerrarModalEvento();
        this.respuestaEnviando = false;
      },
      error: (err) => {
        this.notification.error(err, 'Error');
        this.respuestaEnviando = false;
      }
    });
  }

  marcarEventoVisto(evento: Evento) {
    if (evento.tipoEvento === 'INFORMATIVO' && !evento.yaRespondio) {
      const request: RespuestaEventoRequest = {
        eventoId: evento.id!,
        comentario: 'Visto'
      };
      this.eventosService.responderEvento(request).subscribe({
        next: () => {
          this.cargarEventos();
          this.cerrarModalEvento();
        }
      });
    } else {
      this.cerrarModalEvento();
    }
  }

  // ==================== NOTIFICACIONES POST-LOGIN ====================

  private mostrarNotificacionesPostLogin() {
    // Solo mostrar una vez por sesion
    const yaMostrado = sessionStorage.getItem('notificacionesMostradas');
    if (yaMostrado) return;

    this.notificacionesService.cargarResumen().subscribe({
      next: (resumen) => {
        if (!resumen) return;
        sessionStorage.setItem('notificacionesMostradas', 'true');

        // Mostrar toasts con delay para que no se apilen todos a la vez
        let delay = 1500; // esperar a que cargue el dashboard

        if (resumen.solicitudesAprobadas > 0) {
          setTimeout(() => {
            this.notification.success(
              `Tienes ${resumen.solicitudesAprobadas} solicitud(es) aprobada(s) recientemente`,
              'Solicitudes'
            );
          }, delay);
          delay += 800;
        }

        if (resumen.solicitudesRechazadas > 0) {
          setTimeout(() => {
            this.notification.warning(
              `Tienes ${resumen.solicitudesRechazadas} solicitud(es) rechazada(s) recientemente`,
              'Solicitudes'
            );
          }, delay);
          delay += 800;
        }

        if (resumen.eventosSinResponder > 0) {
          setTimeout(() => {
            this.notification.info(
              `Tienes ${resumen.eventosSinResponder} evento(s) pendiente(s) de responder`,
              'Eventos'
            );
          }, delay);
          delay += 800;
        }

        if ((this.isAdmin() || this.isSupervisor()) && resumen.solicitudesPendientes > 0) {
          setTimeout(() => {
            this.notification.info(
              `Hay ${resumen.solicitudesPendientes} solicitud(es) esperando aprobacion`,
              'Pendientes'
            );
          }, delay);
        }
      }
    });
  }
}
