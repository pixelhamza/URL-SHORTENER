# ☁️ AWS EC2 Deployment Guide (Assessment Step-by-Step)

This guide walks you through deploying the Dockerized URL Shortener project on an AWS EC2 instance from start to finish.

---

## Part 1: Launch an AWS EC2 Instance

1. Log in to the [AWS Management Console](https://console.aws.amazon.com/ec2/).
2. Navigate to **EC2** $\rightarrow$ Click **Launch Instance**.
3. **Instance Configuration**:
   - **Name**: `linksnap-server`
   - **AMI (OS)**: **Amazon Linux 2023 AMI** (or **Ubuntu 24.04 LTS**) *(Free Tier Eligible)*
   - **Instance Type**: `t2.micro` or `t3.micro` *(Free Tier Eligible)*
   - **Key pair (login)**: Select an existing `.pem` key pair or create a new one (e.g. `ec2-key.pem`) and download it.
4. **Network Settings (Crucial for Assessment Demo)**:
   - Click **Edit** under Network Settings.
   - Ensure **Auto-assign Public IP** is enabled.
   - Configure **Security Group Inbound Rules**:
     | Type | Port Range | Source | Purpose |
     |---|---|---|---|
     | **SSH** | `22` | `My IP` (or `0.0.0.0/0`) | Accessing terminal |
     | **HTTP** | `80` | `0.0.0.0/0` (Anywhere) | Serving web app to the public |
     | **Custom TCP** (Optional) | `3000` | `0.0.0.0/0` | Direct Node.js access if not port-mapped to 80 |
5. Click **Launch Instance**.

---

## Part 2: Connect & Install Docker on EC2

### 1. SSH into the Instance
On your local terminal (where your `.pem` key is saved):
```bash
chmod 400 ec2-key.pem

# For Amazon Linux:
ssh -i ec2-key.pem ec2-user@<YOUR-EC2-PUBLIC-IP>

# (Or for Ubuntu):
ssh -i ec2-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
```

### 2. Install Docker

#### If you selected Amazon Linux 2023:
```bash
# Update package manager
sudo dnf update -y

# Install Docker
sudo dnf install -y docker

# Start and enable Docker service
sudo systemctl enable --now docker

# Add user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker ec2-user
newgrp docker
```

#### If you selected Ubuntu 22.04 / 24.04:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Verify Docker is Running
```bash
docker --version
docker ps
```

---

## Part 3: Deploy the Application on EC2

### Option A: Transfer files using SCP (from your local machine)
On your local machine terminal:
```bash
# From your project directory (/Users/nashit/Documents/aws/deploy)
scp -i /path/to/ec2-key.pem -r . ec2-user@<YOUR-EC2-PUBLIC-IP>:~/app
```

Then in your EC2 SSH session:
```bash
cd ~/app
docker build -t linksnap-service .
docker run -d -p 80:3000 --name linksnap --restart unless-stopped linksnap-service
```

---

### Option B: Push to Docker Hub and Pull on EC2 *(Recommended for Assessment)*

1. **On your local machine**:
   ```bash
   # Login to Docker Hub
   docker login

   # Build & Tag image
   docker build -t <your-dockerhub-username>/linksnap:latest .

   # Push to Docker Hub
   docker push <your-dockerhub-username>/linksnap:latest
   ```

2. **On your EC2 terminal**:
   ```bash
   # Pull and run directly
   docker run -d -p 80:3000 \
     --name linksnap \
     --restart unless-stopped \
     <your-dockerhub-username>/linksnap:latest
   ```

---

## Part 4: Testing & Verification

1. Open your browser and navigate to:
   ```
   http://<YOUR-EC2-PUBLIC-IP>
   ```
2. Test the **Health Check endpoint**:
   ```
   http://<YOUR-EC2-PUBLIC-IP>/health
   ```
3. Test Shortening a URL:
   - Paste `https://aws.amazon.com`
   - Test the short redirect: `http://<YOUR-EC2-PUBLIC-IP>/<code-or-alias>`
   - Scan the generated QR code with your mobile phone camera to verify it opens the destination.

---

## 🛠️ Handy Docker Commands for Teacher Demo

| Command | Purpose |
|---|---|
| `docker ps` | Shows running container, ports mapped, and uptime |
| `docker logs -f linksnap` | Displays live request logs and server console output |
| `docker stats` | Demonstrates memory/CPU isolation of the container |
| `docker stop linksnap` / `docker start linksnap` | Demonstrates container lifecycle management |
