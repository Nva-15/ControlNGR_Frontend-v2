import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ContactoService } from '../../services/contacto';

@Component({
  selector: 'app-ayuda',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './ayuda.html',
  styleUrl: './ayuda.css'
})
export class AyudaComponent implements OnInit {
  private contactoService = inject(ContactoService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  contactoForm: FormGroup;
  isLoading = false;
  mensajeResultado: { tipo: string, texto: string } | null = null;

  constructor() {
    this.contactoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      correo: ['', [Validators.required, Validators.email]],
      celular: ['', [Validators.required, Validators.pattern('^[0-9]{9}$')]],
      descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]]
    });
  }

  ngOnInit() {}

  // Validador para celular 
  validarCelularPeruano(control: AbstractControl) {
    const celular = control.value;
    if (!celular) return null;
    
    const regex = /^[0-9]{9}$/;
    if (!regex.test(celular)) {
      return { celularInvalido: true };
    }
    return null;
  }

  onSubmit() {
    if (this.contactoForm.valid) {
      this.isLoading = true;
      this.mensajeResultado = null;

      this.contactoService.enviarMensaje(this.contactoForm.value).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.mensajeResultado = {
            tipo: 'success',
            texto: '¡Mensaje enviado correctamente! Nos pondremos en contacto contigo pronto.'
          };
          this.contactoForm.reset();
          this.limpiarEstadosValidacion();
        },
        error: (error) => {
          this.isLoading = false;
          this.mensajeResultado = {
            tipo: 'danger',
            texto: 'Error al enviar el mensaje. Por favor, intenta nuevamente más tarde.'
          };
          console.error('Error enviando mensaje:', error);
        }
      });
    } else {
      this.marcarCamposComoTouched();
    }
  }

  //  Limpiar formulario al cancelar
  limpiarFormulario() {
    this.contactoForm.reset();
    this.limpiarEstadosValidacion();
    this.mensajeResultado = null;
    console.log('Formulario limpiado');
  }

  //Limpiar estados de validación
  limpiarEstadosValidacion() {
    Object.keys(this.contactoForm.controls).forEach(key => {
      const control = this.contactoForm.get(key);
      control?.markAsUntouched();
      control?.markAsPristine();
      control?.setErrors(null);
    });
  }

  marcarCamposComoTouched() {
    Object.keys(this.contactoForm.controls).forEach(key => {
      const control = this.contactoForm.get(key);
      control?.markAsTouched();
    });
  }

  // Volver al menú ahora limpia el formulario primero
  volverAlMenu() {
    this.limpiarFormulario();
    this.router.navigate(['/dashboard']);
  }

  get nombre() { return this.contactoForm.get('nombre'); }
  get correo() { return this.contactoForm.get('correo'); }
  get celular() { return this.contactoForm.get('celular'); }
  get descripcion() { return this.contactoForm.get('descripcion'); }

  getMensajeError(campo: string): string {
    const control = this.contactoForm.get(campo);
    
    if (control?.errors?.['required'] && control.touched) {
      return 'Este campo es requerido';
    }
    
    if (control?.errors?.['minlength'] && control.touched) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    
    if (control?.errors?.['email'] && control.touched) {
      return 'Ingresa un correo electrónico válido';
    }
    
    if (control?.errors?.['pattern'] && control.touched) {
      return 'El celular debe tener 9 dígitos (ej: 987654321)';
    }
    
    return '';
  }
}