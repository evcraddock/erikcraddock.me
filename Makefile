.PHONY: dev dev-stop dev-status dev-logs check pre-pr help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

dev: ## Start the dev environment
	@if [ "$$(make -s dev-status)" = "running" ]; then \
		echo "Dev environment already running"; \
	else \
		overmind start -f Procfile.dev; \
	fi

dev-stop: ## Stop the dev environment
	overmind quit || true

dev-status: ## Check if dev environment is running
	@if pgrep -f "overmind start" > /dev/null 2>&1; then echo "running"; else echo "stopped"; fi

dev-logs: ## Connect to dev environment logs
	overmind connect

check: ## Run linting and tests
	npm run lint && npm test

pre-pr: ## Run pre-PR checks
	./scripts/pre-pr.sh
