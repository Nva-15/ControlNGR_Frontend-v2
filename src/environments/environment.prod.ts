// Configuración para producción (embebido en JAR)
// Como el frontend está servido por el mismo servidor backend,
// usamos rutas relativas
export const environment = {
  production: true,
  apiUrl: '/api'  // Ruta relativa - se resolverá automáticamente a http://IP_SERVIDOR:8080/api
};
