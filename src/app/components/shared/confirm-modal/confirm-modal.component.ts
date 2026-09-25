import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { NotificationService, ConfirmDialog } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

/** Dialogo global de confirmacion (NotificationService.confirm). */
@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (dialog) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" (click)="respond(false)"></div>
        <div class="relative w-full max-w-md rounded-2xl bg-white shadow-2xl" role="alertdialog" aria-modal="true">
          <div class="flex gap-4 p-6">
            <div class="flex size-11 shrink-0 items-center justify-center rounded-full" [class]="iconoFondo()">
              <i class="bi text-xl" [class]="icono()"></i>
            </div>
            <div class="min-w-0">
              <h3 class="text-base font-semibold text-stone-900">{{ dialog.title || 'Confirmar' }}</h3>
              <p class="mt-2 whitespace-pre-line text-sm text-stone-600">{{ dialog.message }}</p>
            </div>
          </div>
          <div class="flex justify-end gap-2 rounded-b-2xl bg-stone-50 px-6 py-4">
            <button type="button" class="btn-secondary" (click)="respond(false)">{{ dialog.cancelText || 'Cancelar' }}</button>
            <button type="button" [class]="botonConfirmar()" (click)="respond(true)">{{ dialog.confirmText || 'Confirmar' }}</button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
  private notification = inject(NotificationService);
  private sub?: Subscription;
  dialog: ConfirmDialog | null = null;

  ngOnInit() {
    this.sub = this.notification.confirm$.subscribe(d => this.dialog = d);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.dialog) this.respond(false);
  }

  respond(valor: boolean) {
    this.dialog = null;
    this.notification.respondToConfirm(valor);
  }

  icono(): string {
    switch (this.dialog?.type) {
      case 'danger': return 'bi-exclamation-triangle text-red-600';
      case 'warning': return 'bi-exclamation-circle text-amber-600';
      case 'success': return 'bi-check-circle text-emerald-600';
      default: return 'bi-question-circle text-sky-600';
    }
  }

  iconoFondo(): string {
    switch (this.dialog?.type) {
      case 'danger': return 'bg-red-50';
      case 'warning': return 'bg-amber-50';
      case 'success': return 'bg-emerald-50';
      default: return 'bg-sky-50';
    }
  }

  botonConfirmar(): string {
    switch (this.dialog?.type) {
      case 'danger': return 'btn-danger';
      case 'success': return 'btn-success';
      default: return 'btn-primary';
    }
  }
}
