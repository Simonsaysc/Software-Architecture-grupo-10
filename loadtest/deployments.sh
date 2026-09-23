# Mapeo deployment -> compose file (lo usan prepare.sh y run.sh)
# single: 1 instancia de la app detrás de Traefik, con cache y search
# x3:     3 instancias detrás de Traefik como load balancer, con cache y search
compose_file_for() {
  case "$1" in
    single) echo "docker-compose.app-db-proxy-search-cache.yml" ;;
    x3)     echo "docker-compose.yml" ;;
    *) echo "Deployment desconocido: $1 (usar single | x3)" >&2; return 1 ;;
  esac
}
