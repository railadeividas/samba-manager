# Makefile for Samba Manager

.PHONY: all clean build build-fe build-be run

# Binary name
BINARY_NAME=samba-manager

# GO build flags
LDFLAGS=-ldflags "-s -w"

# Set default target to all
all: clean build

# Build everything
build: build-fe build-be

# Build frontend
build-fe:
	@echo "Building frontend..."
	cd gui && npm install && npm run build

# Build backend
build-be:
	@echo "Building backend..."
	@go build $(LDFLAGS) -o $(BINARY_NAME) .

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -f $(BINARY_NAME)
	@rm -rf gui/build
	@rm -rf gui/node_modules

# Run the application
run: build
	@echo "Running..."
	@./$(BINARY_NAME)

# Install dependencies
deps:
	@echo "Installing dependencies..."
	cd gui && npm install
	@go mod tidy

# Install to system
install: build
	@echo "Installing..."
	@sudo cp $(BINARY_NAME) /usr/local/bin/

# Uninstall from system
uninstall:
	@echo "Uninstalling..."
	@sudo rm -f /usr/local/bin/$(BINARY_NAME)
