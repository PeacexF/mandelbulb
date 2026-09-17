.DEFAULT_GOAL := help

.PHONY: help install dev build preview wasm test vet lint check fmt clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install Go module dependencies and npm packages
	go mod download
	cd web && npm install

dev: ## Run the Vite dev server (builds the WASM core first)
	cd web && npm run dev

build: ## Production build: WASM core + TypeScript + Vite bundle
	cd web && npm run build

preview: ## Preview the production build
	cd web && npm run preview

wasm: ## Build the Go core to WASM and refresh the JS glue script
	cd web && npm run wasm

test: ## Run Go tests
	go test -race ./...

vet: ## Run go vet
	go vet ./...

lint: ## Run golangci-lint (host target and js/wasm target)
	golangci-lint run ./...
	GOOS=js GOARCH=wasm golangci-lint run ./wasm/...

check: vet lint test ## Run vet, lint and tests together
	cd web && npx tsc -b --noEmit

fmt: ## Format Go source
	gofmt -l -w .

clean: ## Remove build artifacts (dist, generated WASM, node_modules)
	rm -rf web/dist web/public/mandelbulb.wasm web/public/wasm_exec.js web/node_modules web/tsconfig.tsbuildinfo
