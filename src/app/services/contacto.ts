import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MensajeContacto {
  nombre: string;
  correo: string;
  celular: string;
  descripcion: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactoService {
  private http = inject(HttpClient);
  
  private formspreeEndpoint = 'https://formspree.io/f/xyzlzgbk';

  enviarMensaje(mensaje: MensajeContacto): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    const payload = {
      name: mensaje.nombre,
      email: mensaje.correo,
      phone: `+51 ${mensaje.celular}`,
      message: mensaje.descripcion,
      _subject: `Soporte Sistema Tienda: ${mensaje.nombre}`,
      _replyto: mensaje.correo,
      _language: 'es'
    };

    return this.http.post(this.formspreeEndpoint, payload, { headers });
  }
}