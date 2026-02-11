import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  // En producción (JAR), el frontend y backend están en el mismo servidor
  // Por lo tanto, usamos la URL actual del navegador
  private getBaseUrl(): string {
    // Si estamos en desarrollo (ng serve), usar localhost:8080
    if (window.location.port === '4200') {
      return 'http://localhost:8080';
    }

    // En producción, usar la URL actual (misma IP y puerto que el navegador)
    return window.location.origin;
  }

  get apiUrl(): string {
    return `${this.getBaseUrl()}/api`;
  }

  get baseUrl(): string {
    return this.getBaseUrl();
  }
}
