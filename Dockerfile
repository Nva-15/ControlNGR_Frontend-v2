# ---------- Etapa 1: compilar Angular ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Limita la memoria de Node para equipos con poca RAM asignada a Docker
ENV NODE_OPTIONS=--max-old-space-size=1024
RUN npx ng build --configuration production

# ---------- Etapa 2: servir con nginx ----------
FROM nginx:1.27-alpine
# openssl: genera el certificado HTTPS si no se entrega uno (docker/05-certificado.sh)
RUN apk add --no-cache openssl
# URL interna del backend (red de Docker) y puerto HTTPS publicado (para la redireccion desde HTTP)
ENV BACKEND_URL=http://backend:8080 \
    HTTPS_PORT=443
COPY --chmod=755 docker/05-certificado.sh /docker-entrypoint.d/05-certificado.sh
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/tiendafrontend/browser /usr/share/nginx/html
EXPOSE 80 443
