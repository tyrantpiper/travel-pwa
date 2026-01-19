#!/bin/bash

# Ryan Travel App - Oracle Cloud Deployment Script
# Usage: ./deploy_oracle.sh

set -e

echo "🚀 Starting Deployment Setup..."

# 1. Update System
echo "📦 Updating system packages..."
if [ -x "$(command -v dnf)" ]; then
    sudo dnf update -y
    sudo dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
elif [ -x "$(command -v apt-get)" ]; then
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=\"$(dpkg --print-architecture)\" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git
else
    echo "❌ Unsupported OS. Please use Oracle Linux 8/9 or Ubuntu."
    exit 1
fi

# 2. Enable Docker
echo "🐳 Enabling Docker..."
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# 3. Setup Project Directory
APP_DIR=~/ryan-travel-app
if [ -d "$APP_DIR" ]; then
    echo "📂 Directory exists, pulling latest changes..."
    cd $APP_DIR
    # git pull origin main # Uncomment if using git
else
    echo "📂 Creating app directory..."
    mkdir -p $APP_DIR
    cd $APP_DIR
fi

echo "✅ Environment ready! Please:"
echo "1. Upload your code or git clone your repo."
echo "2. Create a .env file with your secrets."
echo "3. Run 'docker compose up -d --build'"
echo "4. (Optional) Configure Cloudflare Tunnel for HTTPS."
