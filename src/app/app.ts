import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './components/shared/toast-container/toast-container.component';
import { ConfirmModalComponent } from './components/shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmModalComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-confirm-modal />
  `
})
export class AppComponent {}
