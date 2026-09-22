# Deploy en Kubernetes (minikube): stack completo escalado horizontalmente

Arquitectura desplegada:

```
                 https://bookreviews.localhost
                              │
                   minikube tunnel (127.0.0.1:80/443)
                              │
            ┌─────────── Traefik (namespace traefik) ───────────┐
            │  - TLS termination (secret bookreviews-tls)       │
            │  - Redirección HTTP → HTTPS                       │
            │  - Enrutamiento por host/path (Ingress)           │
            └───────┬───────────────────────────────┬───────────┘
                    │ /                             │ /uploads
                    ▼                               ▼
          web-app-service (ClusterIP)     static-assets-service (ClusterIP)
          ┌────────┼────────┐                       │
       web-app  web-app  web-app  (3 réplicas)   nginx (solo lectura)
          │        │        │                       │
          └────────┴────┬───┴───────────────────────┘
                        │  uploads-pvc (imágenes compartidas)
       ┌────────────────┼────────────────┐
   postgres-service  redis-service  opensearch-service
   (datos, PVC)      (cache + sesiones)  (búsqueda)
```

La app es **stateless**: las sesiones viven en Redis (`connect-redis`) y las imágenes subidas en un
PVC compartido montado por las 3 réplicas y por nginx. Cualquier réplica puede atender cualquier request.

## Archivos

| Archivo | Contenido |
|---|---|
| `configmap.yaml` | Config no sensible (hosts, flags `ENABLE_CACHE`/`ENABLE_SEARCH`, `UPLOADS_PATH`) |
| `secret.yaml` | Credenciales de DB/OpenSearch y `SESSION_SECRET` |
| `postgres-pvc.yaml`, `postgres.yaml` | PostgreSQL con volumen persistente |
| `redis.yaml` | Redis (cache del A3 + store de sesiones) |
| `opensearch.yaml` | OpenSearch single-node (límite 2Gi: con 1Gi queda en OOMKilled) |
| `uploads-pvc.yaml` | Volumen compartido para portadas y fotos de autor |
| `web-app.yaml` | App con 3 réplicas, probes de readiness/liveness y Service ClusterIP |
| `static-assets.yaml` | nginx que sirve `/uploads` directo desde el PVC |
| `ingress.yaml` | Ingress de Traefik para `/` y `/uploads` + Middlewares (cache headers, gzip) |
| `traefik-values.yaml` | Valores del chart de Helm de Traefik (redirect HTTP→HTTPS, LoadBalancer) |

> `k8s-manifest.yaml` es un duplicado antiguo; no aplicarlo.

## Requisitos

- minikube, kubectl y Helm (`brew install minikube kubectl helm`)
- El certificado self-signed en `traefik/certs/` (si falta: `bash scripts/generate-certs.sh`)

## Deploy desde cero

Todo se corre desde la raíz del repo.

```bash
# 1. Cluster (OpenSearch necesita memoria)
minikube start --memory=6144 --cpus=4

# 2. Imagen de la app, construida dentro del docker de minikube (imagePullPolicy: IfNotPresent)
eval $(minikube docker-env)
docker build -t software-arch-app:latest .

# 3. Traefik como reverse proxy / edge (NO usar `minikube addons enable ingress`, que instala nginx)
helm repo add traefik https://traefik.github.io/charts && helm repo update
helm install traefik traefik/traefik -n traefik --create-namespace -f k8s/traefik-values.yaml
kubectl -n traefik rollout status deploy/traefik --timeout=120s

# 4. Certificado TLS para el Ingress
kubectl create secret tls bookreviews-tls --cert=traefik/certs/cert.pem --key=traefik/certs/key.pem

# 5. Infraestructura y datos
kubectl apply -f k8s/configmap.yaml -f k8s/secret.yaml \
  -f k8s/postgres-pvc.yaml -f k8s/postgres.yaml \
  -f k8s/redis.yaml -f k8s/opensearch.yaml -f k8s/uploads-pvc.yaml

# 6. Esperar a OpenSearch ANTES de levantar la app (la app revisa el motor de búsqueda una sola vez al iniciar)
until kubectl logs deploy/opensearch-deployment 2>/dev/null | grep -q "Node started"; do echo "esperando opensearch..."; sleep 10; done

# 7. App, estáticos e Ingress
kubectl apply -f k8s/web-app.yaml -f k8s/static-assets.yaml -f k8s/ingress.yaml
kubectl rollout status deployment/web-app-deployment --timeout=180s

# 8. Poblar la base de datos e indexar en OpenSearch
#    (el seed se corre con cache/search desactivados porque si no queda colgado al cerrar Redis)
kubectl exec deploy/web-app-deployment -- env ENABLE_CACHE=false ENABLE_SEARCH=false npm run seed
kubectl exec deploy/web-app-deployment -- npm run reindex
```

En **otra terminal**, dejar corriendo (pide la contraseña para abrir los puertos 80/443):

```bash
minikube tunnel
```

La app queda en **https://bookreviews.localhost** (el navegador va a advertir por el certificado self-signed).

## Verificación

```bash
# Redirección HTTP → HTTPS
curl -sI http://bookreviews.localhost | grep -i location           # https://bookreviews.localhost/

# App detrás de Traefik
curl -sk -o /dev/null -w "%{http_code}\n" https://bookreviews.localhost/books   # 200

# Balanceo de carga: instanceHost rota entre las 3 réplicas
for i in 1 2 3 4 5 6; do curl -sk https://bookreviews.localhost/session-test | grep -o '"instanceHost":"[^"]*"'; done

# Sesión compartida: con cookie, `views` sigue subiendo aunque cambie la réplica
for i in 1 2 3 4; do curl -sk -c /tmp/c.txt -b /tmp/c.txt https://bookreviews.localhost/session-test; echo; done

# Estáticos servidos en el borde por nginx (no por Express), con cache headers
kubectl exec deploy/web-app-deployment -- sh -c 'echo test > /app/uploads/books/prueba.txt'
curl -skI https://bookreviews.localhost/uploads/books/prueba.txt | grep -iE "HTTP/|cache-control|x-served-by|server"
kubectl exec deploy/web-app-deployment -- rm /app/uploads/books/prueba.txt

# Motor de búsqueda conectado (buscar por TÍTULO: el fallback de la DB solo busca en el resumen)
kubectl logs -l app=web-app --prefix --tail=-1 | grep "Search engine"   # "Search engine is available." x3

# Disponibilidad: botar una réplica no rompe la app
kubectl delete $(kubectl get pods -l app=web-app -o name | head -1)
curl -sk -o /dev/null -w "%{http_code}\n" https://bookreviews.localhost/books   # sigue 200
kubectl get pods -l app=web-app                                             # vuelve a 3
```

Dashboard de Traefik: `kubectl -n traefik port-forward deploy/traefik 8080:8080` → http://localhost:8080/dashboard/

## Problemas conocidos

- **Search en fallback después de reiniciar todo**: si los pods de la app arrancan antes que OpenSearch,
  quedan usando la búsqueda por DB hasta reiniciarlos: `kubectl rollout restart deployment/web-app-deployment`.
- **500 en `/books` con una DB antigua**: los modelos agregaron `cover_image` (Book) e `image` (Author) y
  `sequelize.sync()` no altera tablas existentes. Volver a correr el seed (paso 8).
- **`uploads-pvc` es ReadWriteOnce**: funciona porque minikube tiene un solo nodo. En un cluster multi-nodo
  se necesita `ReadWriteMany` (NFS/EFS) o un object store (S3/MinIO).
- **La llave privada del certificado está en el repo** (`traefik/certs/key.pem`): aceptable para un
  certificado self-signed local; en producción se generaría fuera del repo o se usaría cert-manager/Let's Encrypt.

## Limpieza

```bash
kubectl delete -f k8s/ingress.yaml -f k8s/static-assets.yaml -f k8s/web-app.yaml
helm uninstall traefik -n traefik
minikube stop
```
