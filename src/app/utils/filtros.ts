/** Valores distintos (sin vacíos), ordenados, para armar las opciones de un filtro a partir de los datos cargados. */
export function opciones<T>(lista: T[], campo: (x: T) => string | null | undefined): string[] {
  const set = new Set<string>();
  for (const x of lista) {
    const v = campo(x);
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Texto sin tildes y en minúsculas para búsquedas. */
export function normalizar(s: string | null | undefined): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** HttpParams sin los filtros vacíos (para las listas paginadas en el servidor). */
export function parametros(filtros: Record<string, string | number | boolean | null | undefined>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtros)) if (v !== null && v !== undefined && v !== '') r[k] = String(v);
  return r;
}
