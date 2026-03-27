# Setup Guide

Step-by-step instructions to get the WhatsApp Appointment Booking system running locally.

---

## Prerequisites

Before you begin, make sure you have the following installed and running:

- **Python 3.12+** — `python3 --version`
- **Docker + Docker Compose** — for PostgreSQL and Redis
- **ngrok** (or Cloudflare Tunnel) — for exposing localhost to Meta
- A **Meta Developer account** with a WhatsApp Business App configured

---

## Step 1 — Create Virtual Environment

```bash
python3.12 -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows
```

---

## Step 2 — Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
# Application
APP_ENV=development
LOG_LEVEL=INFO

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/whatsapp_booking

# Redis
REDIS_URL=redis://localhost:6379/0

# Meta WhatsApp Cloud API  ← get these from Meta Developer Console
WHATSAPP_TOKEN=your_permanent_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_VERIFY_TOKEN=any_random_string_you_choose
```

### Where to find Meta credentials

| Variable | Where to find it |
|---|---|
| `WHATSAPP_TOKEN` | Meta Developer Console → Your App → WhatsApp → API Setup → Temporary/Permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Console → Your App → WhatsApp → API Setup → Phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | You choose this — any random string (e.g. `my-secret-verify-token-123`) |

---

## Step 4 — Start PostgreSQL and Redis with Docker

```bash
docker compose up -d
```

This starts two containers:

| Container | Port | Credentials |
|---|---|---|
| `whatsapp_booking_postgres` | `5432` | user: `postgres` / password: `password` / db: `whatsapp_booking` |
| `whatsapp_booking_redis` | `6379` | no auth (local dev) |

Both containers have health checks and persist data in named Docker volumes (`postgres_data`, `redis_data`) so data survives restarts.

Wait until both are healthy:

```bash
docker compose ps
# Both should show "healthy" under Status
```

### Useful Docker commands

```bash
docker compose up -d        # Start containers in background
docker compose down         # Stop containers (data is preserved)
docker compose down -v      # Stop and DELETE all data (full reset)
docker compose logs -f      # Tail logs for all containers
docker compose logs postgres # Logs for PostgreSQL only
docker compose logs redis    # Logs for Redis only
```

### Connect to PostgreSQL directly

```bash
docker exec -it whatsapp_booking_postgres psql -U postgres -d whatsapp_booking
```

### Connect to Redis CLI

```bash
docker exec -it whatsapp_booking_redis redis-cli
```

---

## Step 5 — Run Database Migrations

```bash
# Generate the initial migration from your models
alembic revision --autogenerate -m "initial schema"

# Apply the migration to the database
alembic upgrade head
```

### Useful Alembic commands

```bash
alembic current          # Show which migration is currently applied
alembic history          # List all migrations
alembic downgrade -1     # Roll back the last migration
```

---

## Step 6 — Seed Sample Data

Populates the database with 3 sample services and time slots for the next 7 days.

```bash
python seed.py
```

Output:
```
Created 3 services
Created 336 time slots
Seeding complete.
```

---

## Step 7 — Run the Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Verify it's running:

```bash
curl http://localhost:8000/health
# {"status":"ok","env":"development"}
```

Browse the auto-generated API docs:
```
http://localhost:8000/docs
```

---

## Step 8 — Expose Localhost with ngrok

Meta requires a public HTTPS URL to deliver webhook events to your local machine.

```bash
ngrok http 8000
```

ngrok will print something like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:8000
```

Copy the `https://...` URL — you'll need it in the next step.

> **Alternative:** Cloudflare Tunnel
> ```bash
> cloudflared tunnel --url http://localhost:8000
> ```

---

## Step 9 — Register the Webhook with Meta

1. Go to [Meta Developer Console](https://developers.facebook.com)
2. Open your app → **WhatsApp** → **Configuration**
3. Under **Webhook**, click **Edit**
4. Set **Callback URL** to: `https://your-ngrok-url/webhook`
5. Set **Verify Token** to the same value you put in `.env` for `WHATSAPP_VERIFY_TOKEN`
6. Click **Verify and Save**
7. Under **Webhook Fields**, subscribe to **messages**

### Test the verification manually

```bash
curl "http://localhost:8000/webhook\
?hub.mode=subscribe\
&hub.verify_token=YOUR_VERIFY_TOKEN\
&hub.challenge=test123"

# Expected response: test123
```

---

## Step 10 — Test the Full Flow

Send a WhatsApp message from the test number linked in your Meta app to your bot number:

| Message | Expected Bot Response |
|---|---|
| `hi` | Interactive list of services |
| Select a service | Interactive list of time slots |
| Select a time slot | Confirmation button (Confirm / Cancel) |
| Tap **Confirm** | Booking confirmation with reference number |
| `hi` again | Resets and shows service list again |

---

## Troubleshooting

### `alembic upgrade head` fails with connection error
- Check `DATABASE_URL` in `.env` is correct
- Confirm containers are running and healthy: `docker compose ps`
- If containers aren't started: `docker compose up -d`

### `uvicorn` starts but webhook verification fails (403)
- Confirm `WHATSAPP_VERIFY_TOKEN` in `.env` exactly matches what you entered in Meta's dashboard

### Messages arrive but bot doesn't respond
- Check server logs for errors: `uvicorn main:app --reload --log-level debug`
- Confirm Redis container is running: `docker exec -it whatsapp_booking_redis redis-cli ping` should return `PONG`
- Confirm the WhatsApp test number has been added in Meta Developer Console → WhatsApp → API Setup → To

### Pylance shows "Import could not be resolved" warnings
- These appear if packages aren't installed in your editor's selected Python interpreter
- Fix: select the venv interpreter in VS Code (`Cmd+Shift+P` → "Python: Select Interpreter" → choose `venv`)
- Or simply run `pip install -r requirements.txt` and reload the window

---

## Quick Reference

```bash
# Start infrastructure
docker compose up -d

# Start the app
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
ngrok http 8000

# Re-run after model changes
alembic revision --autogenerate -m "describe change"
alembic upgrade head

# Check DB directly (via Docker)
docker exec -it whatsapp_booking_postgres \
  psql -U postgres -d whatsapp_booking -c "SELECT * FROM appointments;"

docker exec -it whatsapp_booking_postgres \
  psql -U postgres -d whatsapp_booking -c "SELECT * FROM user_sessions;"

# Check Redis keys (via Docker)
docker exec -it whatsapp_booking_redis redis-cli keys "whatsapp:*"

# Full reset (wipes all data)
docker compose down -v && docker compose up -d
```
