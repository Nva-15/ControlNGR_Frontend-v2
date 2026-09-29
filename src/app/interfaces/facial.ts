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

/** Colaborador en los resultados de las pruebas del panel admin. */
export interface EmpleadoFacial {
  empleadoId: number;
  nombre: string;
  cargo?: string;
  foto?: string;
  rol?: string;
  departamento?: string;
  registrado?: boolean;
  muestras?: number;
  registradoEl?: string | null;
  /** Distancia al rostro capturado (menor = mas parecido). */
  distancia?: number;
  /** Si la distancia es menor o igual al umbral (se aceptaria la marcacion). */
  coincide?: boolean;
}

export interface ResumenFacial {
  total: number;
  registrados: number;
  umbral: number;
  obligatorio: boolean;
  muestrasRequeridas: number;
  empleados: EmpleadoFacial[];
}

export interface PruebaMarcacion {
  umbral: number;
  registrados: number;
  candidatos: EmpleadoFacial[];
  reconocido: EmpleadoFacial | null;
  objetivo?: EmpleadoFacial;
}

export interface PruebaRegistro {
  muestras: number;
  dispersion: number;
  dispersionMaxima: number;
  consistente: boolean;
  umbral: number;
  yaRegistradoPara: EmpleadoFacial | null;
  aceptable: boolean;
}
