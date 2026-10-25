FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY . .
# The studio's build tools, fonts and OCR models are declared in devDependencies.
RUN pnpm install --frozen-lockfile --prod=false
ARG VITE_CONVEX_URL=""
ARG VITE_HERCULES_OIDC_AUTHORITY=""
ARG VITE_HERCULES_OIDC_CLIENT_ID=""
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL \
    VITE_HERCULES_OIDC_AUTHORITY=$VITE_HERCULES_OIDC_AUTHORITY \
    VITE_HERCULES_OIDC_CLIENT_ID=$VITE_HERCULES_OIDC_CLIENT_ID \
    BASE_PATH=/
RUN pnpm build:studio

FROM nginx:stable-alpine AS runtime
ARG VCS_REF="unknown"
LABEL org.opencontainers.image.title="Haishen Studio" \
      org.opencontainers.image.revision=$VCS_REF
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/caishen-studio/dist/public/ /usr/share/nginx/html/
RUN find /usr/share/nginx/html -type d -exec chmod 755 {} + \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} +
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1
