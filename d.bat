docker compose --env-file infra/.env.local -f infra/docker-compose.db.yml \
  exec -T postgres psql -U postgres -d aisztens_db -c '\dn' \
  -c "SELECT has_schema_privilege('aisztens','callback','CREATE')" \
  -c "SELECT count(*) FROM (VALUES ('platform'),('callback'),('email')) s(n)
        CROSS JOIN (VALUES ('aisztens'),('tkovari'),('krak')) r(x)
        WHERE has_schema_privilege(r.x, s.n, 'USAGE')"
