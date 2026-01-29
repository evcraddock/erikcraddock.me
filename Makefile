.PHONY: dev dev-stop dev-restart dev-status dev-logs dev-tail \
        connect-app connect-css connect-docker \
        db-generate db-migrate db-studio \
        check pre-pr help

SOCKET := ./.overmind.sock

# =============================================================================
# Help
# =============================================================================

help: ## Show this help
	@echo "erikcraddock.me Development"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  dev             Start dev environment"
	@echo "  dev-stop        Stop dev environment"
	@echo "  dev-restart     Restart dev environment"
	@echo "  dev-status      Show process status"
	@echo "  dev-logs        Stream all logs (Ctrl+C to stop)"
	@echo "  dev-tail        Show last 50 lines of logs"
	@echo ""
	@echo "Connect (Ctrl+b d to detach):"
	@echo "  connect-app     Attach to app terminal"
	@echo "  connect-css     Attach to css terminal"
	@echo "  connect-docker  Attach to docker terminal"
	@echo ""
	@echo "Database:"
	@echo "  db-generate     Generate migrations from schema changes"
	@echo "  db-migrate      Run pending migrations"
	@echo "  db-studio       Open Drizzle Studio to browse database"
	@echo ""
	@echo "Quality:"
	@echo "  check           Run linting and tests"
	@echo "  pre-pr          Run pre-PR checks"

# =============================================================================
# Development Environment
# =============================================================================

dev: ## Start dev environment
	@if [ -S $(SOCKET) ] && overmind ps -s $(SOCKET) > /dev/null 2>&1; then \
		echo "Dev environment already running"; \
		overmind ps -s $(SOCKET); \
	else \
		rm -f $(SOCKET); \
		overmind start -f Procfile.dev -s $(SOCKET) -D; \
		sleep 2; \
		overmind ps -s $(SOCKET); \
		echo ""; \
		echo "Dev started: http://localhost:5000"; \
	fi

dev-stop: ## Stop dev environment
	@if [ -S $(SOCKET) ]; then overmind quit -s $(SOCKET) || true; fi
	@rm -f $(SOCKET)
	@tmux kill-session -t erikcraddock-me 2>/dev/null || true
	@for sock in /tmp/tmux-$$(id -u)/overmind-erikcraddock-me-*; do \
		if [ -S "$$sock" ]; then \
			tmux -L "$$(basename $$sock)" kill-server 2>/dev/null || true; \
		fi; \
	done

dev-restart: dev-stop dev ## Restart dev environment

dev-status: ## Show process status
	@if [ -S $(SOCKET) ] && overmind ps -s $(SOCKET) > /dev/null 2>&1; then \
		overmind ps -s $(SOCKET); \
	else \
		echo "Not running"; \
	fi

dev-logs: ## Stream all logs (Ctrl+C to stop)
	@if [ -S $(SOCKET) ]; then \
		overmind echo -s $(SOCKET); \
	else \
		echo "Dev environment not running. Start with: make dev"; \
	fi

dev-tail: ## Show last 50 lines of logs
	@if [ ! -S $(SOCKET) ]; then \
		echo "Dev environment not running. Start with: make dev"; \
	else \
		TMUX_SOCK=$$(ls -t /tmp/tmux-$$(id -u)/overmind-erikcraddock-me-* 2>/dev/null | head -1); \
		if [ -n "$$TMUX_SOCK" ]; then \
			echo "=== app ===" && \
			tmux -L "$$(basename $$TMUX_SOCK)" capture-pane -t erikcraddock-me:app -p -S -25 2>/dev/null || echo "(no output)"; \
			echo "" && \
			echo "=== css ===" && \
			tmux -L "$$(basename $$TMUX_SOCK)" capture-pane -t erikcraddock-me:css -p -S -25 2>/dev/null || echo "(no output)"; \
			echo "" && \
			echo "=== docker ===" && \
			tmux -L "$$(basename $$TMUX_SOCK)" capture-pane -t erikcraddock-me:docker -p -S -25 2>/dev/null || echo "(no output)"; \
		else \
			echo "Could not find tmux socket"; \
		fi; \
	fi

# =============================================================================
# Connect to Service Terminals
# =============================================================================

connect-app: ## Attach to app terminal (Ctrl+b d to detach)
	@if [ -S $(SOCKET) ]; then \
		overmind connect app -s $(SOCKET); \
	else \
		echo "Dev environment not running. Start with: make dev"; \
	fi

connect-css: ## Attach to css terminal (Ctrl+b d to detach)
	@if [ -S $(SOCKET) ]; then \
		overmind connect css -s $(SOCKET); \
	else \
		echo "Dev environment not running. Start with: make dev"; \
	fi

connect-docker: ## Attach to docker terminal (Ctrl+b d to detach)
	@if [ -S $(SOCKET) ]; then \
		overmind connect docker -s $(SOCKET); \
	else \
		echo "Dev environment not running. Start with: make dev"; \
	fi

# =============================================================================
# Database
# =============================================================================

db-generate: ## Generate migrations from schema changes
	@mkdir -p data
	npx drizzle-kit generate

db-migrate: ## Run pending migrations
	@mkdir -p data
	npx drizzle-kit migrate

db-studio: ## Open Drizzle Studio to browse database
	@mkdir -p data
	npx drizzle-kit studio

# =============================================================================
# Quality
# =============================================================================

check: ## Run linting and tests
	npm run lint && npm test

pre-pr: ## Run pre-PR checks
	./scripts/pre-pr.sh

garage-setup: ## Setup Garage (run once after first make dev)
	@./scripts/setup-garage.sh
