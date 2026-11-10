# Makefile for Samba Manager

.PHONY: all build build-fe build-be test test-go test-fe lint fmt run clean distclean deps \
        install uninstall docker up down logs e2e dist

BINARY_NAME=samba-manager
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS=-ldflags "-s -w -X main.version=$(VERSION)"

all: build

# Build everything: web UI first (it is embedded), then the Go binary
build: build-fe build-be

build-fe:
	@echo "Building frontend..."
	cd gui && npm ci && REACT_APP_BUILD_DATE=$$(date +%F) npm run build
	@touch gui/build/.gitkeep

build-be:
	@echo "Building backend $(VERSION)..."
	@CGO_ENABLED=0 go build -trimpath $(LDFLAGS) -o $(BINARY_NAME) .

# Tests
test: test-go test-fe

test-go:
	go test -race ./...

test-fe:
	cd gui && CI=true npm test -- --watchAll=false

# Formatting and static checks
fmt:
	gofmt -w .

lint:
	@test -z "$$(gofmt -l .)" || (echo "gofmt needed on:"; gofmt -l .; exit 1)
	go vet ./...

# Run locally (needs root and Samba installed; see "doctor")
run: build
	sudo ./$(BINARY_NAME) serve

# Check dependencies of this machine
doctor: build-be
	./$(BINARY_NAME) doctor

# Install / upgrade as a systemd service (re-run after building a new version)
install: build
	sudo ./$(BINARY_NAME) install

uninstall:
	sudo ./$(BINARY_NAME) uninstall

# Docker
docker:
	docker compose build

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

# End-to-end test: builds the image, starts it, and talks to it over HTTP and SMB
e2e:
	./scripts/e2e.sh

# Static binaries for releases (UI must be built first: make build-fe)
dist:
	@mkdir -p dist
	@for arch in amd64 arm64; do \
	  echo "Building linux/$$arch..."; \
	  CGO_ENABLED=0 GOOS=linux GOARCH=$$arch go build -trimpath $(LDFLAGS) -o dist/$(BINARY_NAME)-linux-$$arch . || exit 1; \
	done
	@cd dist && sha256sum $(BINARY_NAME)-linux-* > SHA256SUMS && cat SHA256SUMS

# Remove build output (keeps node_modules)
clean:
	@rm -f $(BINARY_NAME)
	@rm -rf dist
	@find gui/build -mindepth 1 ! -name .gitkeep -delete 2>/dev/null || true

# Also remove node_modules
distclean: clean
	@rm -rf gui/node_modules

deps:
	cd gui && npm ci
	@go mod tidy
