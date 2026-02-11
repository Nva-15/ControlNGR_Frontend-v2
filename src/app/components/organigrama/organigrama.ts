import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmpleadosService } from '../../services/empleados';
import { EmpleadoResponse } from '../../interfaces/empleado';
import { ApiConfigService } from '../../services/api-config.service';

@Component({
  selector: 'app-organigrama',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './organigrama.html',
  styleUrls: ['./organigrama.css']
})
export class OrganigramaComponent implements OnInit, OnDestroy {
  private empService = inject(EmpleadosService);
  private apiConfig = inject(ApiConfigService);

  nivelJefes: EmpleadoResponse[] = [];
  nivelSupervisores: EmpleadoResponse[] = [];
  nivelTecnicos: EmpleadoResponse[] = [];
  nivelHD: EmpleadoResponse[] = [];
  nivelNOC: EmpleadoResponse[] = [];

  cumpleanosHoy: any[] = [];
  cumpleanosProximos: any[] = [];

  empleadoSeleccionado: any = null;
  mostrarDetalle = false;

  isLoading = true;
  isLoadingDetalle = false;
  private intervaloAutoRefresh: any;
  private get apiUrl() {
    return this.apiConfig.baseUrl;
  }

  ngOnInit() {
    this.cargarDatos();
    this.intervaloAutoRefresh = setInterval(() => this.refrescarDatos(), 5000);
  }

  ngOnDestroy() {
    if (this.intervaloAutoRefresh) clearInterval(this.intervaloAutoRefresh);
  }

  private refrescarDatos() {
    if (this.isLoading || this.mostrarDetalle) return;
    this.empService.getEmpleados().subscribe({
      next: (data) => {
        const activos = data.filter(e => e.activo !== false);
        this.clasificarPersonal(activos);
        this.calcularCumpleanosSemanales(activos);
      }
    });
  }

  cargarDatos() {
    this.isLoading = true;
    
    this.empService.getEmpleados().subscribe({
      next: (data) => {
        const activos = data.filter(e => e.activo !== false);
        this.clasificarPersonal(activos);
        this.calcularCumpleanosSemanales(activos);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando organigrama:', err);
        this.isLoading = false;
      }
    });
  }

  clasificarPersonal(empleados: EmpleadoResponse[]) {
    this.nivelJefes = [];
    this.nivelSupervisores = [];
    this.nivelTecnicos = [];
    this.nivelHD = [];
    this.nivelNOC = [];

    empleados.forEach(emp => {
      const nivel = (emp.nivel || '').toLowerCase();
      const rol = (emp.rol || '').toLowerCase();
      const cargo = (emp.cargo || '').toLowerCase();

      if (rol === 'admin' || 
          nivel.includes('jefe') || 
          nivel.includes('gerente') ||
          cargo.includes('jefe') ||
          cargo.includes('gerente')) {
        this.nivelJefes.push(emp);
      }
      else if (rol === 'supervisor' || 
               nivel.includes('supervisor') || 
               cargo.includes('supervisor')) {
        this.nivelSupervisores.push(emp);
      }
      else if (nivel.includes('tecnico') || 
               cargo.includes('tecnico') ||
               rol === 'tecnico') {
        this.nivelTecnicos.push(emp);
      }
      else if (nivel.includes('hd') || 
               cargo.includes('hd') ||
               rol === 'hd') {
        this.nivelHD.push(emp);
      }
      else if (nivel.includes('noc') || 
               cargo.includes('noc') ||
               rol === 'noc') {
        this.nivelNOC.push(emp);
      }
      else {
        this.nivelTecnicos.push(emp);
      }
    });

    this.ordenarNivel(this.nivelJefes);
    this.ordenarNivel(this.nivelSupervisores);
    this.ordenarNivel(this.nivelTecnicos);
    this.ordenarNivel(this.nivelHD);
    this.ordenarNivel(this.nivelNOC);
  }

  ordenarNivel(nivel: EmpleadoResponse[]) {
    nivel.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  calcularCumpleanosSemanales(empleados: EmpleadoResponse[]) {
    this.cumpleanosHoy = [];
    this.cumpleanosProximos = [];

    const hoyPeru = this.getFechaActualPeru();
    const fechaLimite = new Date(hoyPeru);
    fechaLimite.setDate(hoyPeru.getDate() + 6);

    empleados.forEach(emp => {
      if (emp.cumpleanos) {
        const fechaCumple = this.parseFechaPeru(emp.cumpleanos);
        if (!fechaCumple) return;

        const cumpleEsteAnio = new Date(
          hoyPeru.getFullYear(),
          fechaCumple.getMonth(),
          fechaCumple.getDate()
        );

        if (cumpleEsteAnio >= hoyPeru && cumpleEsteAnio <= fechaLimite) {
          const esHoy = this.esMismaFecha(cumpleEsteAnio, hoyPeru);
          
          const datosCumple = {
            ...emp,
            esHoy: esHoy,
            fechaCumpleFormateada: esHoy ? '' : this.formatearFechaCorta(cumpleEsteAnio),
            edad: this.calcularEdad(emp.cumpleanos || '')
          };

          if (esHoy) {
            this.cumpleanosHoy.push(datosCumple);
          } else {
            this.cumpleanosProximos.push(datosCumple);
          }
        }
      }
    });

    this.cumpleanosProximos.sort((a, b) => {
      const fechaA = this.parseFechaPeru(a.cumpleanos || '');
      const fechaB = this.parseFechaPeru(b.cumpleanos || '');
      if (!fechaA || !fechaB) return 0;
      
      const hoy = new Date();
      const cumpleA = new Date(hoy.getFullYear(), fechaA.getMonth(), fechaA.getDate());
      const cumpleB = new Date(hoy.getFullYear(), fechaB.getMonth(), fechaB.getDate());
      
      return cumpleA.getTime() - cumpleB.getTime();
    });
  }

  getFechaActualPeru(): Date {
    const ahoraUTC = new Date();
    const offsetPeru = -5 * 60;
    const ahoraPeru = new Date(ahoraUTC.getTime() + offsetPeru * 60000);
    
    return new Date(
      ahoraPeru.getFullYear(),
      ahoraPeru.getMonth(),
      ahoraPeru.getDate()
    );
  }

  esMismaFecha(fecha1: Date, fecha2: Date): boolean {
    return fecha1.getDate() === fecha2.getDate() &&
           fecha1.getMonth() === fecha2.getMonth() &&
           fecha1.getFullYear() === fecha2.getFullYear();
  }

  formatearFechaCorta(fecha: Date): string {
    return fecha.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit'
    });
  }

  seleccionarEmpleado(empleado: EmpleadoResponse) {
    this.isLoadingDetalle = true;
    this.mostrarDetalle = true;
    
    this.empleadoSeleccionado = {
      id: empleado.id,
      nombre: empleado.nombre,
      cargo: empleado.cargo,
      nivel: empleado.nivel,
      descripcion: empleado.descripcion,
      hobby: empleado.hobby,
      cumpleanos: empleado.cumpleanos,
      ingreso: empleado.ingreso,
      foto: empleado.foto,
      activo: empleado.activo
    };
    
    this.isLoadingDetalle = false;
  }

  cerrarDetalle() {
    this.mostrarDetalle = false;
    this.empleadoSeleccionado = null;
  }

  calcularEdad(fechaNacimiento: string): number | null {
    if (!fechaNacimiento) return null;
    
    const fechaNac = this.parseFechaPeru(fechaNacimiento);
    if (!fechaNac) return null;
    
    const hoy = this.getFechaActualPeru();
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    
    return edad;
  }

  calcularTiempoEnEmpresa(fechaIngreso: string): string {
    if (!fechaIngreso) return 'Fecha no disponible';
    
    const fechaIng = this.parseFechaPeru(fechaIngreso);
    if (!fechaIng) return 'Fecha no disponible';
    
    const hoy = this.getFechaActualPeru();
    
    let años = hoy.getFullYear() - fechaIng.getFullYear();
    let meses = hoy.getMonth() - fechaIng.getMonth();
    let dias = hoy.getDate() - fechaIng.getDate();
    
    if (dias < 0) {
      meses--;
      const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
      dias += ultimoDiaMesAnterior;
    }
    
    if (meses < 0) {
      años--;
      meses += 12;
    }
    
    const partes = [];
    if (años > 0) partes.push(`${años} año${años !== 1 ? 's' : ''}`);
    if (meses > 0) partes.push(`${meses} mes${meses !== 1 ? 'es' : ''}`);
    if (dias > 0 || partes.length === 0) partes.push(`${dias} día${dias !== 1 ? 's' : ''}`);
    
    return partes.join(', ');
  }

  getFormatoFecha(fechaStr: string): string {
    if (!fechaStr) return 'Fecha no disponible';
    
    const fecha = this.parseFechaPeru(fechaStr);
    if (!fecha) return 'Fecha no disponible';
    
    return fecha.toLocaleDateString('es-PE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  parseFechaPeru(fechaStr: string): Date | null {
    if (!fechaStr) return null;
    
    try {
      if (fechaStr.includes('-')) {
        const [year, month, day] = fechaStr.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
      }
      else if (fechaStr.includes('/')) {
        const [day, month, year] = fechaStr.split('/').map(Number);
        return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
      }
      else if (fechaStr.includes('T')) {
        const fecha = new Date(fechaStr);
        fecha.setHours(fecha.getHours() - 5);
        return fecha;
      }
    } catch (e) {
      console.error('Error parseando fecha:', e);
    }
    return null;
  }

  getFoto(emp: any): string {
    if (!emp.foto || emp.foto.trim() === '') {
      return `${this.apiUrl}/img/perfil.png`;
    }

    if (emp.foto.startsWith('http')) {
      return emp.foto;
    }

    const rutaLimpia = emp.foto.startsWith('/') ? emp.foto.substring(1) : emp.foto;
    return `${this.apiUrl}/${rutaLimpia}`;
  }

  onImageError(event: any) {
    event.target.src = `${this.apiUrl}/img/perfil.png`;
  }

  getNivelDisplay(empleado: any): string {
    const nivel = (empleado.nivel || '').toLowerCase();
    const cargo = empleado.cargo || '';
    
    if (cargo) return cargo;
    
    if (nivel.includes('jefe') || nivel.includes('gerente')) {
      return 'Jefatura';
    } else if (nivel.includes('supervisor')) {
      return 'Supervisor';
    } else if (nivel.includes('tecnico')) {
      return 'Técnico';
    } else if (nivel.includes('hd')) {
      return 'HD';
    } else if (nivel.includes('noc')) {
      return 'NOC';
    }
    
    return 'Colaborador';
  }
}