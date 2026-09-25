# ---------- Etapa 1: compilar Angular ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx ng build --configuration production

# ---------- Etapa 2: servir con nginx ----------
FROM nginx:1.27-alpine
# URL interna del backend (red de Docker)
ENV BACKEND_URL=http://backend:8080
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/tiendafrontend/browser /usr/share/nginx/html
EXPOSE 80
