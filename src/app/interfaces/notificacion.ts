export interface NotificacionResumen {
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  solicitudesRechazadas: number;
  eventosSinResponder: number;
  /** Alertas de asistencia nuevas de su equipo (jefaturas). */
  alertasAsistencia?: number;
  totalNotificaciones: number;
}
