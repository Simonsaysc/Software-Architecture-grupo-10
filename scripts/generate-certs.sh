#!/usr/bin/env bash
set -e

CERTS_DIR="$(dirname "$0")/../traefik/certs"
mkdir -p "$CERTS_DIR"

CERT_KEY="$CERTS_DIR/key.pem"
CERT_PEM="$CERTS_DIR/cert.pem"

if [ -f "$CERT_KEY" ] && [ -f "$CERT_PEM" ]; then
  echo "TLS certificates already exist in $CERTS_DIR"
  exit 0
fi

echo "Generating self-signed TLS certificates with SAN for bookreviews.localhost and bookreviews.local..."

openssl req -x509 -newkey rsa:4096 -nodes -days 3650 \
  -keyout "$CERT_KEY" \
  -out "$CERT_PEM" \
  -subj "/CN=bookreviews.localhost/O=BookReviews/C=CL" \
  -addext "subjectAltName=DNS:bookreviews.localhost,DNS:*.bookreviews.localhost,DNS:bookreviews.local,DNS:localhost,IP:127.0.0.1"

echo "Certificates successfully generated:"
echo "  Key:  $CERT_KEY"
echo "  Cert: $CERT_PEM"
