import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { NotificationService, Toast } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

/** Notificaciones emergentes (esquina superior derecha). */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-3" aria-live="polite">
      @for (toast of toasts; track toast.id) {
        <div class="pointer-events-auto flex gap-3 rounded-xl border bg-white p-4 shadow-lg" [class]="borde(toast)">
          <i class="bi text-lg" [class]="icono(toast)"></i>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-stone-900">{{ toast.title }}</p>
            <p class="mt-0.5 whitespace-pre-line text-sm text-stone-600">{{ toast.message }}</p>
          </div>
          <button type="button" class="btn-icon size-6! -mr-1 -mt-1" (click)="cerrar(toast.id)" aria-label="Cerrar">
            <i class="bi bi-x"></i>
          </button>
        </div>
      }
    </div>
  `
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  private notification = inject(NotificationService);
  private sub?: Subscription;
  toasts: Toast[] = [];

  ngOnInit() {
    this.sub = this.notification.toasts$.subscribe(t => this.toasts = t);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  cerrar(id: number) {
    this.notification.removeToast(id);
  }

  icono(t: Toast): string {
    switch (t.type) {
      case 'success': return 'bi-check-circle-fill text-emerald-600';
      case 'error': return 'bi-x-circle-fill text-red-600';
      case 'warning': return 'bi-exclamation-triangle-fill text-amber-500';
      default: return 'bi-info-circle-fill text-sky-600';
    }
  }

  borde(t: Toast): string {
    switch (t.type) {
      case 'success': return 'border-emerald-200';
      case 'error': return 'border-red-200';
      case 'warning': return 'border-amber-200';
      default: return 'border-sky-200';
    }
  }
}
