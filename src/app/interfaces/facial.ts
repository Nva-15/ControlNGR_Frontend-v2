/** Estado del rostro registrado de un empleado. */
export interface EstadoFacial {
  registrado: boolean;
  muestras: number;
  registradoEl: string | null;
  consentimientoEl: string | null;
  /** Si toda marcacion exige reconocimiento facial (parametro del panel admin). */
  obligatorio: boolean;
  /** Capturas que se toman al registrar el rostro. */
  muestrasRequeridas: number;
}
