import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminParametrosBloqueComponent, CampoParametro } from './parametros-bloque';

/** Reglas de marcación: tolerancia, anticipación, salida automática y jornada por turno (qué roles marcan está en Roles y aprobaciones). */
@Component({
  selector: 'app-admin-asistencia',
  standalone: true,
  imports: [RouterLink, AdminParametrosBloqueComponent],
  template: `
    <app-admin-parametros-bloque [campos]="campos" [separado]="false" />
    <p class="field-help mt-3">
      Qué roles marcan asistencia y cuáles trabajan con horario se configura en
      <a routerLink="/admin/roles" class="font-medium text-vino-700 hover:underline">Roles y aprobaciones</a>.
    </p>
  `
})
export class AdminAsistenciaComponent {
  readonly campos: CampoParametro[] = [
    { clave: 'TOLERANCIA_TARDANZA_MINUTOS', titulo: 'Tolerancia de tardanza', unidad: 'min', min: 0, max: 120,
      ayuda: 'Minutos después de la hora de entrada programada en los que la marcación aún cuenta como puntual. Solo se aplica a los roles con horario, al marcar y en el reporte.' },
    { clave: 'ANTICIPACION_ENTRADA_MINUTOS', titulo: 'Anticipación para marcar entrada', unidad: 'min', min: 0, max: 720,
      ayuda: 'Minutos antes del inicio del turno desde los que se puede marcar la entrada (por ejemplo, 5 → turno 08:00 se marca desde las 07:55). 0 = desde la hora exacta. Solo se aplica a los roles con horario.' },
    { clave: 'SALIDA_AUTOMATICA_HORAS', titulo: 'Salida automática', unidad: 'horas', min: 1, max: 23,
      ayuda: 'Si el colaborador no marca su salida, el sistema la registra sola estas horas después de la entrada (por ejemplo, entrada 17:00 → salida 05:00 del día siguiente). Queda marcada como "automática" en el reporte.' },
    { clave: 'JORNADA_MANANA_HORAS', titulo: 'Jornada del turno mañana', unidad: 'horas', min: 1, max: 16, paso: 0.25,
      ayuda: 'Al armar un horario, la salida del turno mañana se calcula sola: entrada + estas horas, con 1 h de refrigerio incluida que empieza 4 h después de la entrada (por ejemplo, 9 → 08:00 a 17:00, refrigerio 12:00 a 13:00). Se puede cambiar en cada horario.' },
    { clave: 'JORNADA_TARDE_HORAS', titulo: 'Jornada del turno tarde', unidad: 'horas', min: 1, max: 16, paso: 0.25,
      ayuda: 'Salida del turno tarde = entrada + estas horas, sin refrigerio (por ejemplo, 8 → 14:00 a 22:00). Se puede cambiar en cada horario.' },
  ];
}
