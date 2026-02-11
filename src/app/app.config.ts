import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth-interceptor';
import { ExportService } from './services/export';

export const appConfig: ApplicationConfig = {
  providers: [
    ExportService,
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor]) 
    )
  ]
};