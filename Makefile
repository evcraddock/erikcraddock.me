.PHONY: dev dev-stop dev-logs check pre-pr

dev:
	overmind start -f Procfile.dev

dev-stop:
	overmind quit || true

dev-logs:
	overmind connect

check:
	npm run lint && npm test

pre-pr:
	./scripts/pre-pr.sh
