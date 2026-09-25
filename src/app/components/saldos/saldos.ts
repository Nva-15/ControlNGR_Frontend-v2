import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaldosService } from '../../services/saldos';
import { DetalleSaldos, MovimientoSaldo, TipoSaldo } from '../../interfaces/saldo';
import { dias, fechaCorta, mensajeError } from '../../utils/format';

/** Mis saldos de vacaciones y dias por compensar, con su historial. */
@Component({
  selector: 'app-saldos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './saldos.html'
})
export class SaldosComponent implements OnInit {
  private saldosService = inject(SaldosService);

  datos: DetalleSaldos | null = null;
  cargando = true;
  error = '';
  filtro: TipoSaldo | 'TODOS' = 'TODOS';
  pestana: 'movimientos' | 'feriados' | 'periodos' = 'movimientos';

  readonly dias = dias;
  readonly fechaCorta = fechaCorta;

  ngOnInit() {
    this.saldosService.miSaldo().subscribe({
      next: (d) => { this.datos = d; this.cargando = false; },
      error: (e) => { this.error = mensajeError(e); this.cargando = false; }
    });
  }

  get movimientos(): MovimientoSaldo[] {
    const lista = this.datos?.movimientos || [];
    return this.filtro === 'TODOS' ? lista : lista.filter(m => m.tipoSaldo === this.filtro);
  }

  etiquetaMovimiento(m: MovimientoSaldo): { texto: string; clase: string } {
    switch (m.tipoMovimiento) {
      case 'ABONO': return { texto: 'Abono', clase: 'badge-green' };
      case 'CARGO': return { texto: 'Descuento', clase: 'badge-red' };
      case 'REVERSION': return { texto: 'Reversión', clase: 'badge-amber' };
      case 'CARGA_INICIAL': return { texto: 'Carga inicial', clase: 'badge-blue' };
      default: return { texto: 'Ajuste', clase: 'badge-violet' };
    }
  }

  signo(valor: number): string {
    return valor > 0 ? `+${dias(valor)}` : dias(valor);
  }
}
