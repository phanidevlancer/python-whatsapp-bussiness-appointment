# AWS EC2 Deployment Guide

This guide walks you through deploying the WhatsApp Appointment Booking system on AWS from scratch.
No prior AWS or development experience required — every step is explained in detail.

---

## What You Will Need Before Starting

- An **AWS account** (sign up at https://aws.amazon.com if you don't have one)
- A **GitHub account** with access to the project repository
- A **Meta Developer account** with a WhatsApp Business App (for the WhatsApp bot)
- A **ngrok account** (free at https://ngrok.com) for HTTPS webhook support

---

## Part 1 — Launch an EC2 Instance on AWS

### 1.1 — Log in to AWS Console

1. Go to https://console.aws.amazon.com
2. Sign in with your AWS account

---

### 1.2 — Open the EC2 Dashboard

1. In the top search bar, type **EC2**
2. Click **EC2** from the results
3. Click **Launch Instance** (orange button)

---

### 1.3 — Configure the Instance

Fill in the following:

| Setting | Value |
|---------|-------|
| **Name** | `whatsapp-booking-server` |
| **AMI (Operating System)** | Amazon Linux 2023 AMI (Free tier eligible) |
| **Instance type** | `t3.small` (recommended) or `t2.micro` (free tier, slower) |
| **Key pair** | Create a new key pair (see below) |

**Creating a Key Pair:**
1. Click **Create new key pair**
2. Name it `phani2205` (or any name you prefer)
3. Key pair type: **RSA**
4. Private key file format: **.pem**
5. Click **Create key pair** — this downloads a `.pem` file to your computer
6. **Save this file safely** — you cannot download it again

---

### 1.4 — Configure Network Settings (Security Group)

In the **Network settings** section:

1. Click **Edit**
2. You will see an **Inbound security group rules** section
3. There is already an SSH rule (port 22) — keep it
4. Click **Add security group rule** and add the following rules:

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | My IP | Connect to server via terminal |
| Custom TCP | 8000 | 0.0.0.0/0 | Backend API |
| Custom TCP | 3000 | 0.0.0.0/0 | Frontend website |

> **What is a Security Group?** It's like a firewall — it controls which ports are accessible from the internet.

---

### 1.5 — Configure Storage

- Set storage to **20 GB** (the default 8 GB may not be enough for the build)

---

### 1.6 — Launch the Instance

1. Click **Launch Instance**
2. Wait 1-2 minutes for the instance to start
3. Click **View Instances**
4. Wait until **Instance State** shows **Running** and **Status Check** shows **2/2 checks passed**
5. Note down the **Public IPv4 address** (e.g. `54.88.139.77`) — you will use this throughout

---

## Part 2 — Connect to the Server from Your Computer

You will use a terminal (command line) to connect to the server.

**On Mac:** Open the **Terminal** app (search for it in Spotlight with Cmd+Space)
**On Windows:** Use **PowerShell** or install **Git Bash**

---

### 2.1 — Fix Key File Permissions

The `.pem` file needs restricted permissions before SSH will allow it.

```bash
chmod 400 '/path/to/your-key.pem'
```

Replace `/path/to/your-key.pem` with the actual path. For example, if it downloaded to your Downloads folder on Mac:

```bash
chmod 400 '/Users/yourname/Downloads/phani2205.pem'
```

> **What does this do?** It sets the file to be readable only by you, which SSH requires for security.

---

### 2.2 — Connect to the Server

```bash
ssh -i '/Users/yourname/Downloads/phani2205.pem' ec2-user@<your-ec2-public-ip>
```

Replace `<your-ec2-public-ip>` with the IP address from Step 1.6. For example:

```bash
ssh -i '/Users/yourname/Downloads/phani2205.pem' ec2-user@54.88.139.77
```

When prompted "Are you sure you want to continue connecting?", type `yes` and press Enter.

You should see the Amazon Linux banner — you are now inside the server.

> **Note:** Always use `ec2-user` as the username for Amazon Linux (not `ubuntu` or `root`)

---

## Part 3 — Install Required Software on the Server

Run all of the following commands inside the EC2 terminal.

---

### 3.1 — Update the System

```bash
sudo dnf update -y
```

> If it hangs for more than 5 minutes showing "Waiting for process with pid XXXX", run:
> ```bash
> sudo kill -9 XXXX
> sudo rm -f /var/cache/dnf/metadata_lock.pid
> sudo dnf update -y
> ```

---

### 3.2 — Install Python 3.12

```bash
sudo dnf install -y python3.12 python3.12-pip
python3.12 --version
```

Expected output: `Python 3.12.x`

---

### 3.3 — Install Docker

Docker is used to run PostgreSQL (database) and Redis (cache) as containers.

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
docker --version
```

Expected output: `Docker version 25.x.x`

---

### 3.4 — Install Docker Compose

Docker Compose lets you start multiple containers (database + redis) with one command.

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

---

### 3.5 — Install Git and Node.js 20

Git is used to download the project code. Node.js is used to run the frontend.

```bash
sudo dnf install -y git
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node --version
```

Expected output: `v20.x.x`

---

## Part 4 — Download and Configure the Project

---

### 4.1 — Clone the Repository

```bash
git clone https://github.com/phanidevlancer/python-whatsapp-bussiness-appointment.git
cd python-whatsapp-bussiness-appointment
```

Switch to the deployment branch:

```bash
git checkout campaign-main-workspace
```

> For a **private repo**, use a GitHub Personal Access Token:
> 1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
> 2. Click **Generate new token**, check the `repo` scope, copy the token
> 3. Clone with: `git clone https://<token>@github.com/<username>/<repo>.git`

---

### 4.2 — Create the Environment Configuration File

This file contains all the secret credentials and settings the app needs.

```bash
cat > .env << 'EOF'
# Application
APP_ENV=production
LOG_LEVEL=INFO

# PostgreSQL (database connection)
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/whatsapp_booking
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis (cache connection)
REDIS_URL=redis://localhost:6379/0

# Meta WhatsApp Cloud API — get these from Meta Developer Console
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_VERIFY_TOKEN=your_verify_token_here

# CORS — replace with your EC2 public IP
FRONTEND_CORS_ORIGINS=["http://54.88.139.77:3000","http://localhost:3000"]

# Booking settings
SLOT_LOCK_TTL_SECONDS=300
SESSION_TTL_SECONDS=3600
IDEMPOTENCY_TTL_SECONDS=86400
EOF
```

**Where to find your Meta credentials:**

| Variable | Where to find it |
|----------|-----------------|
| `WHATSAPP_TOKEN` | Meta Developer Console → Your App → WhatsApp → API Setup → Permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Console → Your App → WhatsApp → API Setup → Phone number ID |
| `WHATSAPP_VERIFY_TOKEN` | You choose any random string e.g. `my-secret-token-123` |

To edit the `.env` file after creating it:
```bash
nano .env
```
Save with `Ctrl+O` → Enter → `Ctrl+X`

---

## Part 5 — Set Up the Database and Backend

---

### 5.1 — Start PostgreSQL and Redis

```bash
docker-compose up -d
```

Wait for both containers to be healthy:
```bash
docker-compose ps
```

Both should show `(healthy)` under STATUS. If not, wait 30 seconds and run `docker-compose ps` again.

---

### 5.2 — Set Up Python Virtual Environment

A virtual environment keeps the project's Python packages isolated.

```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

> You will see `(venv)` at the start of your terminal prompt when the virtual environment is active.
> Every time you SSH into the server, run `source venv/bin/activate` before running Python commands.

---

### 5.3 — Run Database Migrations

Migrations create all the required database tables.

```bash
alembic upgrade head
```

You should see multiple `Running upgrade ...` lines ending without errors.

---

### 5.4 — Seed the Database

This populates the database with initial data (services, time slots, permissions).

```bash
python -m app.db.seed
python seed.py
```

Expected output from `seed.py`:
```
Created 3 services
Created 336 time slots
Seeding complete.
```

---

### 5.5 — Start the Backend Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Test it by opening this URL in your browser:
```
http://<your-ec2-public-ip>:8000/health
```

Expected response: `{"status":"ok","env":"production"}`

You can also browse the API documentation at:
```
http://<your-ec2-public-ip>:8000/docs
```

---

## Part 6 — Set Up the Frontend

Open a **second terminal window** on your Mac and SSH into the server again:

```bash
ssh -i '/Users/yourname/Downloads/phani2205.pem' ec2-user@<your-ec2-public-ip>
```

Then run:

```bash
cd python-whatsapp-bussiness-appointment/crm-frontend
npm install
npm run build
```

> The build takes **5-10 minutes** on a small instance. Do not close the terminal — wait for it to finish.

Once the build is complete, start the frontend:

```bash
npm start
```

Access the frontend in your browser:
```
http://<your-ec2-public-ip>:3000
```

---

## Part 7 — Set Up HTTPS for WhatsApp Webhook (ngrok)

Meta requires a public HTTPS URL to send WhatsApp messages to your server. ngrok provides this.

---

### 7.1 — Create a Free ngrok Account

1. Go to https://ngrok.com and sign up for a free account
2. After logging in, go to **Your Authtoken** in the dashboard
3. Copy your authtoken

---

### 7.2 — Install ngrok on EC2

In the EC2 terminal:

```bash
sudo tee /etc/yum.repos.d/ngrok.repo << 'EOF'
[ngrok]
baseurl=https://ngrok-agent.s3.amazonaws.com/rpm
enabled=1
gpgcheck=1
gpgkey=https://ngrok-agent.s3.amazonaws.com/ngrok.asc
EOF
sudo dnf install -y ngrok
```

Add your authtoken:
```bash
ngrok config add-authtoken YOUR_NGROK_TOKEN_HERE
```

---

### 7.3 — Run ngrok

```bash
ngrok http 8000
```

ngrok will display something like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:8000
```

Copy the `https://` URL — this is your public webhook URL.

> **Important:** The free ngrok URL changes every time you restart it. For a permanent URL, upgrade ngrok or set up a domain with SSL.

---

### 7.4 — Register the Webhook with Meta

1. Go to https://developers.facebook.com
2. Open your app → **WhatsApp** → **Configuration**
3. Under **Webhook**, click **Edit**
4. Set **Callback URL** to: `https://abc123.ngrok-free.app/webhook`
5. Set **Verify Token** to the same value you set in `.env` for `WHATSAPP_VERIFY_TOKEN`
6. Click **Verify and Save**
7. Under **Webhook Fields**, enable **messages**

---

## Part 8 — Keep Everything Running After Terminal Closes

By default, everything stops when you close the terminal. Follow these steps to keep it running permanently.

---

### 8.1 — Backend as a System Service (systemd)

```bash
sudo tee /etc/systemd/system/whatsapp-backend.service << 'EOF'
[Unit]
Description=WhatsApp Booking Backend
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/python-whatsapp-bussiness-appointment
ExecStart=/home/ec2-user/python-whatsapp-bussiness-appointment/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
EnvironmentFile=/home/ec2-user/python-whatsapp-bussiness-appointment/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable whatsapp-backend
sudo systemctl start whatsapp-backend
sudo systemctl status whatsapp-backend
```

The backend will now start automatically on every server reboot.

---

### 8.2 — Frontend with pm2

pm2 is a process manager for Node.js apps.

> **Important:** You must run `npm run build` before starting the frontend with pm2. Starting without a build will cause a "Could not find a production build" error and the frontend will keep crashing.

```bash
sudo npm install -g pm2
cd ~/python-whatsapp-bussiness-appointment/crm-frontend

# Build first — this takes 5-10 minutes, wait for it to complete
npm run build

# Start with pm2 only after build succeeds
pm2 start npm --name "frontend" -- start
pm2 save
pm2 startup
```

The last command (`pm2 startup`) will print another command — **copy and run it** to enable auto-start on reboot. It will look like:

```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ec2-user --hp /home/ec2-user
```

> **After a server reboot:** pm2 will auto-start the frontend using the saved build. No need to rebuild unless you deployed new code.

> **After deploying new code:** Always rebuild before restarting:
> ```bash
> cd ~/python-whatsapp-bussiness-appointment/crm-frontend
> npm run build
> pm2 restart frontend
> ```

---

## Part 9 — Deploying Code Updates

Every time you push new code to GitHub, follow these steps on the server:

```bash
# SSH into the server
ssh -i '/path/to/key.pem' ec2-user@<your-ec2-public-ip>

# Go to the project directory
cd python-whatsapp-bussiness-appointment

# Activate Python environment
source venv/bin/activate

# Pull the latest code
git pull origin campaign-main-workspace

# Apply any new database migrations
alembic upgrade head

# Restart the backend
sudo systemctl restart whatsapp-backend

# Rebuild and restart the frontend
cd crm-frontend
npm run build
pm2 restart frontend
```

---

## Quick Reference — Useful Commands

```bash
# --- Backend ---
sudo systemctl start whatsapp-backend      # Start backend
sudo systemctl stop whatsapp-backend       # Stop backend
sudo systemctl restart whatsapp-backend    # Restart backend
sudo systemctl status whatsapp-backend     # Check if running
sudo journalctl -u whatsapp-backend -f     # Live backend logs

# --- Frontend ---
pm2 start frontend                         # Start frontend
pm2 stop frontend                          # Stop frontend
pm2 restart frontend                       # Restart frontend
pm2 logs frontend                          # View frontend logs
pm2 list                                   # List all pm2 processes

# --- Database (Docker) ---
docker-compose up -d                       # Start PostgreSQL + Redis
docker-compose down                        # Stop (data preserved)
docker-compose down -v                     # Stop and DELETE all data
docker-compose ps                          # Check container status
docker-compose logs -f                     # View container logs

# --- Database shell ---
docker exec -it whatsapp_booking_postgres psql -U postgres -d whatsapp_booking

# --- Redis shell ---
docker exec -it whatsapp_booking_redis redis-cli

# --- Migrations ---
alembic upgrade head                       # Apply new migrations
alembic current                            # Show current migration
alembic history                            # List all migrations
```

---

## Troubleshooting

### Cannot SSH into the server
- Check that port 22 is open in the EC2 Security Group with your IP as source
- Verify the `.pem` file has correct permissions: `chmod 400 /path/to/key.pem`
- Use `ec2-user` as the username (not `ubuntu`)

### Backend not accessible at port 8000
- Check port 8000 is open in EC2 Security Group (source: 0.0.0.0/0)
- Verify backend is running: `sudo systemctl status whatsapp-backend`
- Check logs: `sudo journalctl -u whatsapp-backend -f`

### Frontend not accessible at port 3000
- Check port 3000 is open in EC2 Security Group
- Verify frontend is running: `pm2 list`
- Restart: `pm2 restart frontend`

### Database connection errors
- Verify containers are healthy: `docker-compose ps`
- Restart containers: `docker-compose down && docker-compose up -d`
- Check DATABASE_URL in `.env` matches the docker-compose credentials

### WhatsApp webhook verification fails
- Confirm `WHATSAPP_VERIFY_TOKEN` in `.env` exactly matches what you entered in Meta dashboard
- Make sure the backend is running and accessible via HTTPS (ngrok)

### `alembic upgrade head` fails on fresh setup
- Make sure Docker containers are healthy before running migrations
- If you see `DuplicateObjectError`, reset the database: `docker-compose down -v && docker-compose up -d`
