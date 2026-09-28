#!/bin/sh
# Control NGR - Certificado HTTPS
#
# Si en /etc/nginx/certs ya hay un certificado entregado por TI (servidor.crt y servidor.key),
# se usa tal cual. Si no, se crea una autoridad local "Control NGR CA" (una sola vez) y con ella
# un certificado para localhost y la IP del servidor (SERVIDOR_IP). Cada PC importa ca.crt una vez.
set -e

DIR=/etc/nginx/certs
CA_KEY=$DIR/ca.key
CA_CRT=$DIR/ca.crt
KEY=$DIR/servidor.key
CRT=$DIR/servidor.crt
MARCA=$DIR/.autogenerado

mkdir -p "$DIR"

SAN="DNS:localhost,IP:127.0.0.1"
[ -n "$SERVIDOR_IP" ] && SAN="$SAN,IP:$SERVIDOR_IP"
[ -n "$SERVIDOR_NOMBRE" ] && SAN="$SAN,DNS:$SERVIDOR_NOMBRE"

PUERTO=""
[ -n "$HTTPS_PORT" ] && [ "$HTTPS_PORT" != "443" ] && PUERTO=":$HTTPS_PORT"
if [ -n "$SERVIDOR_IP" ]; then
    echo "certificado: enlace para los usuarios -> https://$SERVIDOR_IP$PUERTO"
else
    echo "certificado: AVISO - SERVIDOR_IP no esta configurada: el certificado solo sirve para localhost/127.0.0.1"
    echo "certificado: y las demas PCs veran 'La conexion no es privada'. En Windows inicie el sistema con"
    echo "certificado:   powershell -ExecutionPolicy Bypass -File .\\scripts\\iniciar.ps1"
    echo "certificado: (detecta la IP de este equipo y la guarda en .env) o complete SERVIDOR_IP en .env"
fi

# Certificado propio de TI: no se toca
if [ -s "$CRT" ] && [ -s "$KEY" ] && [ ! -f "$MARCA" ]; then
    echo "certificado: usando el certificado existente en $DIR"
    exit 0
fi

# Ya generado para las mismas direcciones: no se regenera
if [ -s "$CRT" ] && [ -s "$KEY" ] && [ "$(cat "$MARCA")" = "$SAN" ]; then
    echo "certificado: vigente para $SAN"
    exit 0
fi

if [ ! -s "$CA_KEY" ] || [ ! -s "$CA_CRT" ]; then
    echo "certificado: creando la autoridad local Control NGR CA (importe ca.crt en cada PC)"
    openssl req -x509 -newkey rsa:3072 -sha256 -days 3650 -nodes \
        -keyout "$CA_KEY" -out "$CA_CRT" -subj "/CN=Control NGR CA/O=NGR" \
        -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
        -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null
fi

echo "certificado: emitiendo certificado del servidor para $SAN"
EXT=$(mktemp)
cat > "$EXT" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$SAN
EOF
CSR=$(mktemp)
openssl req -new -newkey rsa:2048 -nodes -keyout "$KEY" -out "$CSR" -subj "/CN=Control NGR/O=NGR" 2>/dev/null
openssl x509 -req -in "$CSR" -CA "$CA_CRT" -CAkey "$CA_KEY" -CAcreateserial -out "$CRT" \
    -days 825 -sha256 -extfile "$EXT" 2>/dev/null
rm -f "$CSR" "$EXT"

echo "$SAN" > "$MARCA"
chmod 600 "$KEY" "$CA_KEY"
chmod 644 "$CRT" "$CA_CRT"
