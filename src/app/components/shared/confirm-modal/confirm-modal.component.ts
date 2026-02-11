import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, ConfirmDialog } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Modal de Confirmación -->
    <div class="modal fade show"
         [class.d-block]="isVisible"
         [style.display]="isVisible ? 'block' : 'none'"
         tabindex="-1"
         role="dialog"
         *ngIf="isVisible">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content shadow-lg">
          <div class="modal-header"
               [class.bg-danger]="dialog?.type === 'danger'"
               [class.bg-warning]="dialog?.type === 'warning'"
               [class.bg-info]="dialog?.type === 'info'"
               [class.bg-success]="dialog?.type === 'success'"
               [class.text-white]="dialog?.type !== 'warning'">
            <h5 class="modal-title d-flex align-items-center">
              <i class="bi me-2"
                 [class.bi-exclamation-triangle-fill]="dialog?.type === 'danger' || dialog?.type === 'warning'"
                 [class.bi-info-circle-fill]="dialog?.type === 'info'"
                 [class.bi-check-circle-fill]="dialog?.type === 'success'"
                 [class.bi-question-circle-fill]="!dialog?.type"></i>
              {{ dialog?.title || 'Confirmar' }}
            </h5>
            <button type="button"
                    class="btn-close"
                    [class.btn-close-white]="dialog?.type !== 'warning'"
                    (click)="respond(false)">
            </button>
          </div>
          <div class="modal-body py-4">
            <p class="mb-0 fs-6">{{ dialog?.message }}</p>
          </div>
          <div class="modal-footer border-top-0">
            <button type="button"
                    class="btn btn-outline-secondary"
                    (click)="respond(false)">
              <i class="bi bi-x-lg me-1"></i>
              {{ dialog?.cancelText || 'Cancelar' }}
            </button>
            <button type="button"
                    class="btn"
                    [class.btn-danger]="dialog?.type === 'danger'"
                    [class.btn-warning]="dialog?.type === 'warning'"
                    [class.btn-info]="dialog?.type === 'info'"
                    [class.btn-success]="dialog?.type === 'success'"
                    [class.btn-primary]="!dialog?.type"
                    (click)="respond(true)">
              <i class="bi bi-check-lg me-1"></i>
              {{ dialog?.confirmText || 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Backdrop -->
    <div class="modal-backdrop fade show" *ngIf="isVisible"></div>
  `,
  styles: [`
    .modal-content {
      border: none;
      border-radius: 12px;
      overflow: hidden;
    }

    .modal-header {
      border-bottom: none;
      padding: 1rem 1.5rem;
    }

    .modal-body {
      padding: 1.5rem;
    }

    .modal-footer {
      padding: 1rem 1.5rem;
    }

    .modal.show {
      animation: fadeIn 0.2s ease-out;
    }

    .modal-dialog {
      animation: slideIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-50px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
  isVisible = false;
  dialog: ConfirmDialog | null = null;
  private subscription!: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.subscription = this.notificationService.confirm$.subscribe(dialog => {
      this.dialog = dialog;
      this.isVisible = true;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  respond(value: boolean) {
    this.isVisible = false;
    this.notificationService.respondToConfirm(value);
  }
}
