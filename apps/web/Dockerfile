# Minimal multi-stage build: Vite build -> nginx:alpine static serve.
#
# Build context is THIS directory (apps/web), e.g.:
#   docker build -t teedesk-web:latest -f apps/web/Dockerfile apps/web
#
# NOTE: this app is part of an npm-workspaces monorepo (root package-lock.json
# covers apps/*, packages/*), but apps/web's own dependencies are all regular
# (non-workspace) packages today and packages/shared-types is not yet wired in
# (see src/types/index.ts). So a self-contained build from this directory is
# sufficient for now. If shared-types (or another workspace package) becomes a
# real dependency, this Dockerfile will need to build from the monorepo root
# instead and copy in the relevant workspace package.json files before install.
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
