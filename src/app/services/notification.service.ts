import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialog {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toasts: Toast[] = [];
  private toastsSubject = new Subject<Toast[]>();
  private toastId = 0;

  private confirmSubject = new Subject<ConfirmDialog>();
  private confirmResponseSubject = new Subject<boolean>();

  get toasts$(): Observable<Toast[]> {
    return this.toastsSubject.asObservable();
  }

  success(message: string, title: string = 'Exitoso', duration: number = 4000) {
    this.showToast('success', title, message, duration);
  }

  error(message: string, title: string = 'Error', duration: number = 5000) {
    this.showToast('error', title, message, duration);
  }

  warning(message: string, title: string = 'Advertencia', duration: number = 4500) {
    this.showToast('warning', title, message, duration);
  }

  info(message: string, title: string = 'Información', duration: number = 4000) {
    this.showToast('info', title, message, duration);
  }

  private showToast(type: Toast['type'], title: string, message: string, duration: number) {
    const toast: Toast = {
      id: ++this.toastId,
      type,
      title,
      message,
      duration
    };

    this.toasts.push(toast);
    this.toastsSubject.next([...this.toasts]);

    if (duration > 0) {
      setTimeout(() => this.removeToast(toast.id), duration);
    }
  }

  removeToast(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.toastsSubject.next([...this.toasts]);
  }

  get confirm$(): Observable<ConfirmDialog> {
    return this.confirmSubject.asObservable();
  }

  get confirmResponse$(): Observable<boolean> {
    return this.confirmResponseSubject.asObservable();
  }

  confirm(options: ConfirmDialog): Promise<boolean> {
    return new Promise((resolve) => {
      this.confirmSubject.next(options);

      const subscription = this.confirmResponseSubject.subscribe((response) => {
        subscription.unsubscribe();
        resolve(response);
      });
    });
  }

  respondToConfirm(response: boolean) {
    this.confirmResponseSubject.next(response);
  }
}
