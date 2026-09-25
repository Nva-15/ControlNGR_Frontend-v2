import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin';
import { NotificationService } from '../../../services/notification.service';
import { Parametro } from '../../../interfaces/admin';
import { mensajeError } from '../../../utils/format';

const NOMBRES: Record<string, string> = {
  DIAS_POR_FERIADO_LABORADO: 'Días por feriado trabajado',
  DIAS_VACACIONES_POR_ANIO: 'Días de vacaciones por año cumplido',
  VACACIONES_ABONO_DESDE: 'Abonar aniversarios desde',
  VALIDAR_IP_MARCACION: 'Validar red al marcar asistencia',
  TOLERANCIA_TARDANZA_MINUTOS: 'Tolerancia de tardanza (minutos)',
  EVIDENCIA_MAX_MB: 'Tamaño máximo de evidencia (MB)',
};

@Component({
  selector: 'app-admin-parametros',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card divide-y divide-stone-100">
      @for (p of parametros; track p.clave) {
        <div class="grid items-center gap-4 p-5 md:grid-cols-[1fr_16rem_auto]">
          <div>
            <p class="font-medium text-stone-900">{{ nombre(p.clave) }}</p>
            <p class="text-xs text-stone-500">{{ p.descripcion }}</p>
          </div>
          @switch (p.tipoDato) {
            @case ('BOOLEANO') {
              <select class="select" [(ngModel)]="valores[p.clave]">
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            }
            @case ('FECHA') { <input type="date" class="input" [(ngModel)]="valores[p.clave]" /> }
            @case ('NUMERO') { <input type="number" min="0" class="input" [(ngModel)]="valores[p.clave]" /> }
            @default { <input class="input" [(ngModel)]="valores[p.clave]" /> }
          }
          <button class="btn-secondary btn-sm" [disabled]="'' + valores[p.clave] === p.valor" (click)="guardar(p)">Guardar</button>
        </div>
      }
    </div>
  `
})
export class AdminParametrosComponent implements OnInit {
  private admin = inject(AdminService);
  private notification = inject(NotificationService);
  parametros: Parametro[] = [];
  valores: Record<string, any> = {};

  ngOnInit() { this.cargar(); }

  cargar() {
    this.admin.parametros().subscribe(p => {
      this.parametros = p;
      this.valores = Object.fromEntries(p.map(x => [x.clave, x.valor]));
    });
  }

  nombre(clave: string) { return NOMBRES[clave] || clave; }

  guardar(p: Parametro) {
    this.admin.actualizarParametro(p.clave, String(this.valores[p.clave])).subscribe({
      next: () => { this.notification.success('Parámetro actualizado.'); this.cargar(); },
      error: e => this.notification.error(mensajeError(e))
    });
  }
}
