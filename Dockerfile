# syntax=docker/dockerfile:1

# ---- 1. web UI ---------------------------------------------------------
FROM node:20-bookworm-slim AS ui
WORKDIR /ui
COPY gui/package.json gui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY gui/ ./
ARG BUILD_DATE
ARG VERSION=dev
ENV REACT_APP_BUILD_DATE=${BUILD_DATE} GENERATE_SOURCEMAP=false
# show the release version in the UI footer
RUN case "$VERSION" in v[0-9]*) npm pkg set version="${VERSION#v}" ;; esac \
 && npm run build

# ---- 2. Go binary (UI embedded) ------------------------------------------
FROM golang:1.23-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=ui /ui/build ./gui/build
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/samba-manager .

# ---- 3. runtime ------------------------------------------------------------
FROM debian:bookworm-slim
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      samba samba-vfs-modules samba-common-bin acl attr smbclient tini \
      wsdd2 avahi-daemon dbus ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 # the packaged smb.conf is replaced by a generated one on first start
 && rm -f /etc/samba/smb.conf \
 && mkdir -p /srv/samba /var/lib/samba-manager

COPY --from=build /out/samba-manager /usr/local/bin/samba-manager

ENV SAMBA_MANAGER_SUPERVISE=true \
    SAMBA_MANAGER_HOST=0.0.0.0 \
    SAMBA_MANAGER_PORT=8080 \
    SAMBA_MANAGER_STATE_DIR=/var/lib/samba-manager \
    SAMBA_MANAGER_ALLOWED_ROOTS=/srv/samba

# config, Samba password database, manager state (users/backups/admin hash),
# shared data, user home directories and logs
VOLUME ["/etc/samba", "/var/lib/samba", "/var/lib/samba-manager", "/srv/samba", "/home", "/var/log/samba"]

EXPOSE 8080 445 139 137/udp 138/udp

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["samba-manager", "healthcheck"]

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/samba-manager"]
CMD ["serve"]
