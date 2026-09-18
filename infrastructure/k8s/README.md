# TeeDesk Kubernetes manifests

These manifests are the Kubernetes counterpart to
`infrastructure/docker/docker-compose.prod.yml` (the docker-compose file
remains the source of truth for what each service needs — env vars, ports,
volumes — these manifests just re-express that on a cluster).

## Prerequisites

- A Kubernetes cluster (1.24+) with an ingress controller installed — these
  manifests assume **ingress-nginx** (`ingressClassName: nginx`).
- A default `StorageClass`, or set `storageClassName` explicitly in the PVCs
  in `postgres.yaml`, `redis.yaml`, `ollama.yaml`, and `api.yaml`.
- A container registry to push the `api` and `web` images to. Neither image
  is published anywhere yet — build them yourself:
  - **api / worker / beat** (same image): `docker build -t <your-registry>/teedesk-api:latest -f services/api/Dockerfile services/api`
  - **web**: `docker build -t <your-registry>/teedesk-web:latest -f apps/web/Dockerfile apps/web`
    (this Dockerfile is new — apps/web had none before)
  Then replace the `image:` placeholders in `api.yaml`, `worker.yaml`,
  `beat.yaml`, and `web.yaml`.
- `kubectl` configured against the target cluster.

## Provisioning real secrets (do this before applying anything else)

`secret.yaml.example` is a placeholder template only — **do not** `kubectl
apply -f` it as-is, and never commit a filled-in copy to git. Either:

1. Copy it to `secret.yaml` (add that filename to `.gitignore` if you do this)
   and fill in real values, generating passwords with e.g. `openssl rand -hex 32`; or
2. Create the Secret directly on the cluster without writing plaintext to
   disk (see the `kubectl create secret generic ...` example inside
   `secret.yaml.example`); or
3. Use a proper secrets pipeline instead of a raw Secret manifest — External
   Secrets Operator, Sealed Secrets, SOPS, or a cloud provider's secret
   store are all better fits for production than option 1 or 2.

Whichever you choose, the Secret must be named `teedesk-secrets` in the
`teedesk` namespace and contain the keys `POSTGRES_PASSWORD`,
`REDIS_PASSWORD`, `SECRET_KEY`, `DATABASE_URL`, and `REDIS_URL` (the last two
are pre-composed connection strings, since Kubernetes can't interpolate one
Secret key into another the way docker-compose's `${VAR}` substitution does —
if you change a password you must update the corresponding URL too).

## Apply order

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml        # your real, filled-in copy — see above
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml
kubectl apply -f ollama.yaml
kubectl apply -f api.yaml
kubectl apply -f worker.yaml
kubectl apply -f beat.yaml
kubectl apply -f web.yaml
kubectl apply -f ingress.yaml
```

(Or just `kubectl apply -f infrastructure/k8s/` — object dependencies like
namespace-must-exist-first are soft in practice since `api.yaml` etc. won't
schedule successfully until their ConfigMap/Secret exist, but applying in
the order above avoids transient errors.)

After `ollama` is running, pull the model into it (there's no model baked
into the image or auto-pulled on start):

```bash
kubectl -n teedesk exec deploy/ollama -- ollama pull mistral:7b-instruct
```

Run database migrations (alembic) against `postgres` before or right after
first deploying `api` — these manifests don't run migrations automatically;
do it as a one-off `kubectl run`/`kubectl exec` job using the api image.

## What's missing for full HA

This is a working single-cluster deployment, not a highly-available one.
Deliberately left out of scope for this pass:

- **Postgres has no replication/failover.** It's a single StatefulSet
  replica — a Patroni/CloudNativePG-style HA setup (or a managed Postgres)
  is needed to survive a node loss without downtime or manual intervention.
- **Redis has no replication/sentinel/cluster mode.** Single instance, same
  caveat as Postgres — losing that pod loses the Celery broker and any
  cached/rate-limit state until it reschedules.
- **No autoscaling (HPA) and no PodDisruptionBudgets** on `api`/`worker`/`web`,
  so a node drain or traffic spike isn't handled gracefully.
- **`ollama` is a single pod with no GPU scheduling and no request queuing** —
  it'll serialize/slow down under concurrent load, and there's no shared
  model cache across replicas if you did scale it out.
- **No TLS/cert-manager wired up by default** (see the commented-out
  annotation in `ingress.yaml`), no NetworkPolicies, and no resource
  quotas at the namespace level.
