/** Estado del rostro registrado de un empleado. */
export interface EstadoFacial {
  registrado: boolean;
  muestras: number;
  registradoEl: string | null;
  consentimientoEl: string | null;
  /** Si su marcacion exige reconocimiento facial (modo FACIAL de su equipo). */
  obligatorio: boolean;
  /** Modo de marcacion de su equipo. */
  modo?: ModoMarcacion;
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
  /** Modo de marcacion de su equipo. */
  modo?: ModoMarcacion;
  /** Distancia al rostro capturado (menor = mas parecido). */
  distancia?: number;
  /** Si la distancia es menor o igual al umbral (se aceptaria la marcacion). */
  coincide?: boolean;
}

export interface ResumenFacial {
  total: number;
  registrados: number;
  umbral: number;
  /** Modo FACIAL para quienes no tienen equipo configurado. */
  obligatorio: boolean;
  /** Colaboradores cuyo equipo marca con reconocimiento facial. */
  conFacial?: number;
  muestrasRequeridas: number;
  empleados: EmpleadoFacial[];
}

/** FACIAL: camara y rostro registrado. BOTON: confirmacion, sin camara. */
export type ModoMarcacion = 'FACIAL' | 'BOTON';

/** Modo de marcacion de un equipo (panel admin). */
export interface ModoEquipo {
  departamentoId: number;
  departamento: string;
  configurado: boolean;
  modo: ModoMarcacion;
  colaboradores: number;
  conRostro: number;
  actualizadoEn?: string | null;
  actualizadoPor?: string | null;
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
