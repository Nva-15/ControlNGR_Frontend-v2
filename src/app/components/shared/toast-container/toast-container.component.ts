import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Toast } from '../../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1100;">
      <div *ngFor="let toast of toasts; trackBy: trackById"
           class="toast show fade-in"
           [class.bg-success]="toast.type === 'success'"
           [class.bg-danger]="toast.type === 'error'"
           [class.bg-warning]="toast.type === 'warning'"
           [class.bg-info]="toast.type === 'info'"
           [class.text-white]="toast.type !== 'warning'"
           role="alert">
        <div class="toast-header"
             [class.bg-success]="toast.type === 'success'"
             [class.bg-danger]="toast.type === 'error'"
             [class.bg-warning]="toast.type === 'warning'"
             [class.bg-info]="toast.type === 'info'"
             [class.text-white]="toast.type !== 'warning'">
          <i class="bi me-2"
             [class.bi-check-circle-fill]="toast.type === 'success'"
             [class.bi-x-circle-fill]="toast.type === 'error'"
             [class.bi-exclamation-triangle-fill]="toast.type === 'warning'"
             [class.bi-info-circle-fill]="toast.type === 'info'"></i>
          <strong class="me-auto">{{ toast.title }}</strong>
          <button type="button" class="btn-close btn-close-white"
                  (click)="removeToast(toast.id)"
                  [class.btn-close-white]="toast.type !== 'warning'"></button>
        </div>
        <div class="toast-body">
          {{ toast.message }}
        </div>
        <div class="toast-progress" *ngIf="toast.duration && toast.duration > 0">
          <div class="toast-progress-bar"
               [style.animation-duration.ms]="toast.duration"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast {
      min-width: 300px;
      margin-bottom: 0.5rem;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .toast-header {
      border-bottom: 1px solid rgba(255,255,255,0.2);
    }

    .toast-body {
      font-size: 0.95rem;
    }

    .fade-in {
      animation: fadeInSlide 0.3s ease-out;
    }

    @keyframes fadeInSlide {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .toast-progress {
      height: 3px;
      background: rgba(255,255,255,0.3);
      border-radius: 0 0 4px 4px;
      overflow: hidden;
    }

    .toast-progress-bar {
      height: 100%;
      background: rgba(255,255,255,0.7);
      animation: progress linear forwards;
    }

    @keyframes progress {
      from { width: 100%; }
      to { width: 0%; }
    }

    .bg-success .toast-header,
    .bg-danger .toast-header,
    .bg-info .toast-header {
      background: inherit !important;
    }

    .bg-warning .toast-header {
      background: inherit !important;
      color: #212529;
    }

    .bg-warning .btn-close {
      filter: none;
    }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subscription!: Subscription;

  constructor(private notificationService: NotificationService) {}

  ngOnInit() {
    this.subscription = this.notificationService.toasts$.subscribe(toasts => {
      this.toasts = toasts;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  removeToast(id: number) {
    this.notificationService.removeToast(id);
  }

  trackById(index: number, toast: Toast): number {
    return toast.id;
  }
}
