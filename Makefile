CLUSTER := connectfour
# Every kubectl command names this context, so no other cluster can be touched.
KUBECTL := kubectl --context kind-$(CLUSTER)
TEST_COMPOSE := docker compose -f compose.test.yaml

.PHONY: up down test

## Recreate the cluster and run the app. Erases saved games.
up:
	docker build -t connectfour-backend:local backend
	docker build -t connectfour-frontend:local frontend
	kind delete cluster --name $(CLUSTER)
	kind create cluster --name $(CLUSTER) --config k8s/kind.yaml --wait 120s
	kind load docker-image connectfour-backend:local connectfour-frontend:local --name $(CLUSTER)
	$(KUBECTL) apply -f k8s/secret.yaml -f k8s/postgres.yaml -f k8s/backend.yaml -f k8s/frontend.yaml
	$(KUBECTL) rollout status statefulset/postgres --timeout=300s
	$(KUBECTL) rollout status deployment/backend --timeout=360s
	$(KUBECTL) rollout status deployment/frontend --timeout=180s
	@echo "Connect 4 is running at http://localhost:8080"
	@# WSL2's own address usually isn't reachable from other devices, so don't print it.
	@if grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then \
		echo "From another device on the same network, try port 8080 at the Windows computer's IP address (run ipconfig in Windows)"; \
	else \
		ip=$$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | cut -d' ' -f1); \
		if [ -n "$$ip" ]; then echo "From a phone or another computer on the same network, try http://$$ip:8080"; \
		else echo "From another device on the same network, use this computer's IP address on port 8080"; fi; \
	fi

## Delete the cluster. Erases saved games.
down:
	kind delete cluster --name $(CLUSTER)

## Run tests against a temporary Postgres, then remove it whether they pass or fail.
test:
	@trap '$(TEST_COMPOSE) down --remove-orphans' EXIT; $(TEST_COMPOSE) run --rm backend-tests && $(TEST_COMPOSE) run --rm frontend-tests
