/** Acceso a una herramienta web del equipo (vista "+ Herramientas"). */
export interface Herramienta {
  id: number;
  titulo: string;
  descripcion?: string | null;
  url: string;
  /** data:image/png;base64,... (hasta 128x128) */
  logo?: string | null;
  todosLosRoles: boolean;
  /** Solo lo reciben quienes gestionan. */
  roles?: string[];
  creadoPor?: string;
}

export interface ListaHerramientas {
  puedeGestionar: boolean;
  herramientas: Herramienta[];
}

export interface HerramientaRequest {
  titulo: string;
  descripcion: string;
  url: string;
  todosLosRoles: boolean;
  roles: string[];
  /** Ausente: sin cambios. null: quitar. data URL: reemplazar. */
  logo?: string | null;
}
