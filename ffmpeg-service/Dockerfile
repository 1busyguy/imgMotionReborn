FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install system dependencies including build tools
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    gcc \
    g++ \
    python3-dev \
    libffi-dev \
    libssl-dev \
    imagemagick \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Upgrade pip first
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements
COPY requirements.txt .

# Install Python dependencies with verbose output for debugging
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p assets

# Create a default watermark using ImageMagick (or copy your own)
RUN convert -size 300x100 xc:transparent \
    -font DejaVu-Sans-Bold -pointsize 24 \
    -fill 'rgba(255,255,255,0.8)' \
    -gravity center -annotate +0+0 'imgMotion' \
    -fill 'rgba(0,0,0,0.3)' \
    -gravity center -annotate +2+2 'imgMotion' \
    assets/default_watermark.png

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]