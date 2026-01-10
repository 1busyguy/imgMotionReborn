# FFmpeg Video Processing Service

A Python/FastAPI microservice for video processing operations, designed to run on Railway. This service handles video post-processing tasks like thumbnail extraction, watermarking, resizing, and metadata extraction.

## Features

- **Thumbnail Extraction** - Extract frames from videos at specified timestamps
- **Watermark Addition** - Add image watermarks to videos with configurable position, opacity, and scale
- **Video Resizing** - Resize/compress videos while preserving aspect ratio
- **Metadata Extraction** - Get video duration, resolution, codec info, etc.
- **Audio Extraction** - Extract audio tracks from videos (MP3, AAC, WAV)
- **Video Merging** - Combine multiple videos with optional transitions

## Tech Stack

- **Framework**: FastAPI
- **Video Processing**: FFmpeg (via ffmpeg-python)
- **Image Processing**: Pillow
- **Storage**: Supabase Storage
- **Deployment**: Railway (Docker)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (used by Railway) |
| `/api/v1/extract-thumbnail` | POST | Extract thumbnail from video |
| `/api/v1/add-watermark` | POST | Add watermark to video |
| `/api/v1/get-metadata` | POST | Get video metadata |
| `/api/v1/resize-video` | POST | Resize/compress video |
| `/extract-thumbnail` | POST | Compatibility endpoint for Edge Functions |
| `/apply-watermark` | POST | Compatibility endpoint for Edge Functions |

## Environment Variables

Configure these in Railway Dashboard → Variables:

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
PORT=8000
RAILWAY_ENVIRONMENT=production
```

## Request/Response Schemas

### Thumbnail Extraction

```json
// Request
{
  "generation_id": "uuid",
  "video_url": "https://...",
  "user_id": "uuid",
  "timestamp": 1.0,
  "width": 1280,
  "height": 720,
  "webhook_url": "https://..."
}

// Response
{
  "success": true,
  "processing_id": "uuid",
  "message": "Thumbnail extraction started",
  "status": "processing"
}
```

### Watermark Addition

```json
// Request
{
  "generation_id": "uuid",
  "video_url": "https://...",
  "user_id": "uuid",
  "position": "bottom-center",  // or "left-center", "right-center"
  "opacity": 0.9,
  "scale": 0.75,
  "watermark_url": "https://...",  // optional, uses default if not provided
  "webhook_url": "https://..."
}
```

### Video Resize

```json
// Request
{
  "generation_id": "uuid",
  "video_url": "https://...",
  "user_id": "uuid",
  "width": 1920,
  "height": 1080,
  "bitrate": "5M",
  "preserve_aspect_ratio": true,
  "webhook_url": "https://..."
}
```

## Deployment to Railway

### Option 1: Deploy from GitHub

1. Connect your GitHub repository to Railway
2. Railway will auto-detect the `Dockerfile`
3. Configure environment variables in Railway dashboard
4. Deploy

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project (from ffmpeg-service directory)
cd ffmpeg-service
railway init

# Deploy
railway up
```

### Configuration Files

- `railway.toml` - Railway deployment configuration
- `Dockerfile` - Docker build configuration
- `nixpacks.toml` - Nixpacks build configuration (alternative to Docker)

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL=your_url
export SUPABASE_SERVICE_ROLE_KEY=your_key

# Run server
python main.py
# or
uvicorn main:app --reload --port 8000
```

## Project Structure

```
ffmpeg-service/
├── main.py                 # FastAPI application entry point
├── models/
│   └── schemas.py          # Pydantic request/response models
├── utils/
│   ├── ffmpeg_processor.py # FFmpeg operations
│   ├── storage.py          # Supabase storage operations
│   └── webhook.py          # Webhook notifications
├── assets/
│   └── default_watermark.png
├── Dockerfile              # Docker configuration
├── railway.toml            # Railway deployment config
├── requirements.txt        # Python dependencies
└── README.md
```

## Integration with Main App

This service integrates with the main imgMotion application:

1. **Edge Functions** call this service for video processing
2. **Processing** happens asynchronously in the background
3. **Webhooks** notify the main app when processing completes
4. **Results** are stored in Supabase Storage and database is updated

### Webhook Payload

When processing completes, webhooks are sent with:

```json
{
  "generation_id": "uuid",
  "processing_id": "uuid",
  "status": "completed",  // or "failed"
  "result": {
    "thumbnail_url": "https://...",
    "db_updated": true
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Watermark Configuration

The default watermark is located at `assets/default_watermark.png`. You can:

1. Replace it with your own watermark image
2. Provide a custom `watermark_url` in the request
3. Adjust position, opacity, and scale per request

### Watermark Positions

- `bottom-center` - Bottom edge, centered (default)
- `left-center` - Left edge, centered
- `right-center` - Right edge, centered

## License

This service is part of the imgMotion project, licensed under Apache 2.0.
