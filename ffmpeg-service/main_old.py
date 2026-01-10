import os
import uuid
import logging
from typing import Optional, Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import with error handling
try:
    from utils.ffmpeg_processor import FFmpegProcessor
    from utils.storage import StorageManager
    from utils.webhook import WebhookManager
    from models.schemas import (
        ThumbnailRequest, 
        WatermarkRequest, 
        VideoMetadataRequest,
        ResizeVideoRequest,
        MergeVideosRequest,
        ExtractAudioRequest,
        ProcessingResponse
    )
    logger.info("✅ All imports successful")
except Exception as e:
    logger.error(f"❌ Import error: {str(e)}")
    # Create dummy classes for healthcheck to work
    class FFmpegProcessor:
        pass
    class StorageManager:
        pass
    class WebhookManager:
        pass

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 FFmpeg microservice starting up...")
    logger.info(f"Environment: {os.getenv('RAILWAY_ENVIRONMENT', 'development')}")
    logger.info(f"Port: {os.getenv('PORT', '8000')}")
    logger.info(f"Supabase URL: {'Set' if os.getenv('SUPABASE_URL') else 'Not Set'}")
    yield
    # Shutdown
    logger.info("🛑 FFmpeg microservice shutting down...")

# Initialize FastAPI app
app = FastAPI(
    title="imgMotionMagic FFmpeg Service",
    description="Video processing microservice for imgMotionMagic",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize processors with error handling
try:
    ffmpeg_processor = FFmpegProcessor()
    storage_manager = StorageManager()
    webhook_manager = WebhookManager()
    logger.info("✅ Processors initialized")
except Exception as e:
    logger.error(f"⚠️ Failed to initialize processors: {str(e)}")
    ffmpeg_processor = None
    storage_manager = None
    webhook_manager = None

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ffmpeg-processor",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    return {
        "status": "healthy",
        "service": "ffmpeg-processor",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": {
            "railway": os.getenv("RAILWAY_ENVIRONMENT", "unknown"),
            "port": os.getenv("PORT", "8000"),
            "supabase_configured": bool(os.getenv("SUPABASE_URL"))
        }
    }

# Extract thumbnail from video
@app.post("/api/v1/extract-thumbnail")
async def extract_thumbnail(
    request: ThumbnailRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """
    Extract a thumbnail from a video at specified timestamp
    """
    if not ffmpeg_processor:
        raise HTTPException(status_code=503, detail="Service not fully initialized")
        
    try:
        logger.info(f"📸 Extracting thumbnail for generation: {request.generation_id}")
        
        # Generate processing ID
        processing_id = str(uuid.uuid4())
        
        # Process in background
        background_tasks.add_task(
            process_thumbnail_extraction,
            processing_id,
            request
        )
        
        return ProcessingResponse(
            success=True,
            processing_id=processing_id,
            message="Thumbnail extraction started",
            status="processing"
        )
        
    except Exception as e:
        logger.error(f"❌ Error starting thumbnail extraction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Add watermark to video
@app.post("/api/v1/add-watermark")
async def add_watermark(
    request: WatermarkRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """
    Add watermark to a video
    """
    if not ffmpeg_processor:
        raise HTTPException(status_code=503, detail="Service not fully initialized")
        
    try:
        logger.info(f"💧 Adding watermark for generation: {request.generation_id}")
        
        # Generate processing ID
        processing_id = str(uuid.uuid4())
        
        # Process in background
        background_tasks.add_task(
            process_watermark_addition,
            processing_id,
            request
        )
        
        return ProcessingResponse(
            success=True,
            processing_id=processing_id,
            message="Watermark addition started",
            status="processing"
        )
        
    except Exception as e:
        logger.error(f"❌ Error starting watermark addition: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Get video metadata
@app.post("/api/v1/get-metadata")
async def get_video_metadata(request: VideoMetadataRequest):
    """
    Extract metadata from a video file
    """
    if not ffmpeg_processor:
        raise HTTPException(status_code=503, detail="Service not fully initialized")
        
    try:
        logger.info(f"📊 Getting metadata for: {request.video_url}")
        
        # Download video temporarily
        video_path = await storage_manager.download_temp_file(request.video_url)
        
        # Get metadata
        metadata = await ffmpeg_processor.get_video_metadata(video_path)
        
        # Cleanup
        await storage_manager.cleanup_temp_file(video_path)
        
        return metadata
        
    except Exception as e:
        logger.error(f"❌ Error getting metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Resize/compress video
@app.post("/api/v1/resize-video")
async def resize_video(
    request: ResizeVideoRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """
    Resize or compress a video
    """
    if not ffmpeg_processor:
        raise HTTPException(status_code=503, detail="Service not fully initialized")
        
    try:
        logger.info(f"📐 Resizing video for generation: {request.generation_id}")
        
        processing_id = str(uuid.uuid4())
        
        background_tasks.add_task(
            process_video_resize,
            processing_id,
            request
        )
        
        return ProcessingResponse(
            success=True,
            processing_id=processing_id,
            message="Video resize started",
            status="processing"
        )
        
    except Exception as e:
        logger.error(f"❌ Error starting video resize: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Background processing functions
async def process_thumbnail_extraction(processing_id: str, request: ThumbnailRequest):
    """Background task to extract thumbnail"""
    try:
        logger.info(f"🎬 Processing thumbnail extraction: {processing_id}")
        
        # Download video
        video_path = await storage_manager.download_temp_file(request.video_url)
        
        # Extract thumbnail
        thumbnail_path = await ffmpeg_processor.extract_thumbnail(
            video_path=video_path,
            timestamp=request.timestamp,
            width=request.width,
            height=request.height
        )
        
        # Upload thumbnail to storage
        thumbnail_url = await storage_manager.upload_to_supabase(
            file_path=thumbnail_path,
            user_id=request.user_id,
            folder=f"thumbnails/{request.generation_id}"
        )
        
        # Cleanup temp files
        await storage_manager.cleanup_temp_file(video_path)
        await storage_manager.cleanup_temp_file(thumbnail_path)
        
        # Send webhook
        await webhook_manager.send_completion_webhook(
            generation_id=request.generation_id,
            processing_id=processing_id,
            status="completed",
            result={
                "thumbnail_url": thumbnail_url,
                "timestamp": request.timestamp
            }
        )
        
        logger.info(f"✅ Thumbnail extraction completed: {processing_id}")
        
    except Exception as e:
        logger.error(f"❌ Thumbnail extraction failed: {str(e)}")
        if webhook_manager:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="failed",
                error=str(e)
            )

async def process_watermark_addition(processing_id: str, request: WatermarkRequest):
    """Background task to add watermark"""
    try:
        logger.info(f"🎬 Processing watermark addition: {processing_id}")
        
        # Download video
        video_path = await storage_manager.download_temp_file(request.video_url)
        
        # Download or use watermark
        if request.watermark_url:
            watermark_path = await storage_manager.download_temp_file(request.watermark_url)
        else:
            # Use default watermark
            watermark_path = "assets/default_watermark.png"
        
        # Add watermark
        output_path = await ffmpeg_processor.add_watermark(
            video_path=video_path,
            watermark_path=watermark_path,
            position=request.position,
            opacity=request.opacity,
            scale=request.scale
        )
        
        # Upload watermarked video
        watermarked_url = await storage_manager.upload_to_supabase(
            file_path=output_path,
            user_id=request.user_id,
            folder=f"watermarked/{request.generation_id}"
        )
        
        # Cleanup
        await storage_manager.cleanup_temp_file(video_path)
        await storage_manager.cleanup_temp_file(output_path)
        if request.watermark_url:
            await storage_manager.cleanup_temp_file(watermark_path)
        
        # Send webhook
        await webhook_manager.send_completion_webhook(
            generation_id=request.generation_id,
            processing_id=processing_id,
            status="completed",
            result={
                "watermarked_url": watermarked_url,
                "original_url": request.video_url
            }
        )
        
        logger.info(f"✅ Watermark addition completed: {processing_id}")
        
    except Exception as e:
        logger.error(f"❌ Watermark addition failed: {str(e)}")
        if webhook_manager:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="failed",
                error=str(e)
            )

async def process_video_resize(processing_id: str, request: ResizeVideoRequest):
    """Background task to resize video"""
    try:
        logger.info(f"🎬 Processing video resize: {processing_id}")
        
        # Download video
        video_path = await storage_manager.download_temp_file(request.video_url)
        
        # Resize video
        output_path = await ffmpeg_processor.resize_video(
            video_path=video_path,
            width=request.width,
            height=request.height,
            bitrate=request.bitrate,
            preserve_aspect_ratio=request.preserve_aspect_ratio
        )
        
        # Upload resized video
        resized_url = await storage_manager.upload_to_supabase(
            file_path=output_path,
            user_id=request.user_id,
            folder=f"resized/{request.generation_id}"
        )
        
        # Get new file size
        file_size = os.path.getsize(output_path)
        
        # Cleanup
        await storage_manager.cleanup_temp_file(video_path)
        await storage_manager.cleanup_temp_file(output_path)
        
        # Send webhook
        await webhook_manager.send_completion_webhook(
            generation_id=request.generation_id,
            processing_id=processing_id,
            status="completed",
            result={
                "resized_url": resized_url,
                "original_url": request.video_url,
                "new_size": file_size,
                "dimensions": f"{request.width}x{request.height}"
            }
        )
        
        logger.info(f"✅ Video resize completed: {processing_id}")
        
    except Exception as e:
        logger.error(f"❌ Video resize failed: {str(e)}")
        if webhook_manager:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="failed",
                error=str(e)
            )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)