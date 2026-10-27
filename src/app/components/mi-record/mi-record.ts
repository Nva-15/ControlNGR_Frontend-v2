import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReportesAsistenciaService } from '../../services/reportes-asistencia';
import { FichaAsistencia } from '../../interfaces/reportes-asistencia';
import { FichaAsistenciaComponent } from '../reportes/ficha-asistencia';
import { mensajeError } from '../../utils/format';

/** "Mi récord de asistencia": el colaborador ve solo sus propias marcaciones (si el panel lo habilitó). */
@Component({
  selector: 'app-mi-record',
  standalone: true,
  imports: [FichaAsistenciaComponent, RouterLink],
  template: `
    <div class="page-header">
      <div>
        <h1 class="page-title">Mi récord de asistencia</h1>
        <p class="page-subtitle">Sus marcaciones frente a su horario programado. Solo usted y sus jefaturas ven esta información.</p>
      </div>
      <a routerLink="/perfil" class="btn-secondary"><i class="bi bi-arrow-left"></i> Mi perfil</a>
    </div>
    @if (cargando) {
      <div class="flex justify-center py-16"><span class="spinner"></span></div>
    } @else if (error) {
      <div class="card"><div class="empty-state"><i class="bi bi-lock text-4xl"></i><p>{{ error }}</p></div></div>
    } @else if (datos) {
      <p class="alert-info mb-5" data-aviso-record><i class="bi bi-info-circle"></i>
        <span>Esta información es de solo lectura. Si encuentra un error en alguna marcación o en su horario, comuníquese con su jefatura.</span></p>
      <app-ficha-asistencia [datos]="datos" />
    }
  `
})
export class MiRecordComponent implements OnInit {
  private servicio = inject(ReportesAsistenciaService);
  datos: FichaAsistencia | null = null;
  cargando = true;
  error = '';

  ngOnInit() {
    this.servicio.miRecord().subscribe({
      next: d => { this.datos = d; this.cargando = false; },
      error: e => { this.error = mensajeError(e, 'No se pudo cargar su récord'); this.cargando = false; }
    });
  }
}
