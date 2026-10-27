export interface NotificacionResumen {
  solicitudesPendientes: number;
  solicitudesAprobadas: number;
  solicitudesRechazadas: number;
  eventosSinResponder: number;
  /** Alertas de asistencia nuevas de su equipo (jefaturas). */
  alertasAsistencia?: number;
  /** El panel habilitó "Mi récord" y la persona marca asistencia: muestra "Mi asistencia" en el menú. */
  miRecordHabilitado?: boolean;
  totalNotificaciones: number;
}
