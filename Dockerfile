# Multi-stage image: C++ moon-api + Vite static assets + nginx reverse proxy.
# syntax=docker/dockerfile:1

FROM ubuntu:22.04 AS backend-build

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        ca-certificates \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY src/backend/ ./backend/

RUN cmake -S backend -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build -j"$(nproc)"

# Runs moon_ephemeris_tests and moon_api_tests during `docker build --target test-backend`.
FROM backend-build AS test-backend
RUN ctest --test-dir /src/build --output-on-failure

FROM node:20-bookworm-slim AS frontend-build

WORKDIR /app

COPY src/frontend/package.json ./

RUN npm install

COPY src/frontend/ ./

RUN npm run build

# Runs Vitest during `docker build --target test-frontend`.
FROM node:20-bookworm-slim AS test-frontend

WORKDIR /app

COPY src/frontend/package.json ./

RUN npm install

COPY src/frontend/ ./

RUN npm test

FROM ubuntu:22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

COPY --from=backend-build /src/build/moon-api /usr/local/bin/moon-api
COPY --from=frontend-build /app/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /usr/local/bin/moon-api /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
