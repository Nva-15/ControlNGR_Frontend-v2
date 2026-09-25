import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { ApiConfigService } from '../../services/api-config.service';
import { NotificationService } from '../../services/notification.service';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { fechaCorta, mensajeError } from '../../utils/format';
import { rolLabel } from '../../utils/roles';

/** Perfil del empleado autenticado: datos, foto y presentación. */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [FormsModule, RouterLink, AvatarComponent],
  templateUrl: './perfil.html'
})
export class PerfilComponent implements OnInit {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private api = inject(ApiConfigService);
  private notification = inject(NotificationService);

  perfil: any = null;
  descripcion = '';
  hobby = '';
  guardando = false;
  subiendoFoto = false;
  previsualizacion: string | null = null;
  archivo: File | null = null;

  readonly fechaCorta = fechaCorta;
  readonly rolLabel = rolLabel;

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.http.get<any>(`${this.api.apiUrl}/auth/perfil`).subscribe({
      next: (r) => {
        this.perfil = r.perfil;
        this.descripcion = r.perfil?.descripcion || '';
        this.hobby = r.perfil?.hobby || '';
      },
      error: (e) => this.notification.error(mensajeError(e), 'Perfil')
    });
  }

  guardar() {
    this.guardando = true;
    this.http.put(`${this.api.apiUrl}/auth/perfil/actualizar`, { descripcion: this.descripcion.trim(), hobby: this.hobby.trim() }).subscribe({
      next: () => {
        this.guardando = false;
        this.auth.actualizarEmpleadoSesion({ descripcion: this.descripcion.trim(), hobby: this.hobby.trim() });
        this.notification.success('Sus datos fueron actualizados.');
      },
      error: (e) => {
        this.guardando = false;
        this.notification.error(mensajeError(e));
      }
    });
  }

  seleccionarFoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(file.type)) {
      this.notification.error('Use una imagen JPG, PNG, GIF o BMP.');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.notification.error('La imagen no debe superar los 5 MB.');
      input.value = '';
      return;
    }
    this.archivo = file;
    const reader = new FileReader();
    reader.onload = () => this.previsualizacion = reader.result as string;
    reader.readAsDataURL(file);
  }

  cancelarFoto() {
    this.archivo = null;
    this.previsualizacion = null;
  }

  subirFoto() {
    if (!this.archivo || !this.perfil?.id) return;
    const form = new FormData();
    form.append('archivo', this.archivo);
    this.subiendoFoto = true;
    this.http.post<any>(`${this.api.apiUrl}/imagenes/upload/${this.perfil.id}`, form).subscribe({
      next: (r) => {
        this.subiendoFoto = false;
        if (r.success && r.ruta) {
          this.perfil.foto = r.ruta;
          this.auth.actualizarEmpleadoSesion({ foto: r.ruta });
          this.cancelarFoto();
          this.notification.success('Foto actualizada.');
        } else {
          this.notification.error(r.error || 'No se pudo subir la imagen');
        }
      },
      error: (e) => {
        this.subiendoFoto = false;
        this.notification.error(mensajeError(e, 'No se pudo subir la imagen'));
      }
    });
  }
}
