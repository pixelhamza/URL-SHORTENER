# LinkSnap - URL Shortener & QR Code Generator

A lightweight, high-performance URL Shortener and QR Code Generator built with **Node.js (Express)**, containerized with **Docker**, and ready for instant deployment on **AWS EC2**.

---

## Features

- **Instant URL Shortening**: Generates clean, 6-character short links or custom aliases.
- **Dynamic QR Code Generation**: Instant high-resolution QR code preview and PNG download.
- **Real-Time Click Analytics**: Tracks total visits and last-accessed timestamps.
- **Sleek Glassmorphic UI**: Responsive dark-mode dashboard with instant clipboard copying.
- **Dockerized & Production-Ready**: Uses a lightweight `node:20-alpine` base image, non-root user execution, and container health checks.
- **Persistent Storage**: Retains link data and metrics across container restarts using volume mapping.




## Deploying to AWS EC2 (Step-by-Step)

See the detailed guide in [EC2_DEPLOYMENT.md](EC2_DEPLOYMENT.md) for launch configurations, security group inbound rules, and Docker installation on Amazon Linux / Ubuntu instances.

### Summary of EC2 Deployment:
1. **Launch EC2 Instance**: `t2.micro` or `t3.micro` (Free Tier eligible) with Amazon Linux 2023 or Ubuntu 22.04/24.04.
2. **Security Group Rule**: Allow **Inbound HTTP (Port 80)** from `0.0.0.0/0` and **SSH (Port 22)** from your IP.
3. **SSH into EC2** and install Docker:
   ```bash
   # Amazon Linux 2023
   sudo dnf update -y
   sudo dnf install -y docker
   sudo systemctl enable --now docker
   sudo usermod -aG docker $USER
   newgrp docker
   ```
4. **Copy or Clone Project** to EC2 and start:
   ```bash
   docker build -t linksnap .
   docker run -d -p 80:3000 -v $(pwd)/data:/app/data --restart unless-stopped --name linksnap linksnap
   ```
5. **Access Application**: Visit `http://<YOUR-EC2-PUBLIC-IP>` in your browser!

---

