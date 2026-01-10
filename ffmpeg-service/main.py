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

# Import processors
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

# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 FFmpeg microservice starting up...")
    logger.info(f"Environment: {os.getenv('RAILWAY_ENVIRONMENT', 'development')}")
    logger.info(f"Port: {os.getenv('PORT', '8000')}")
    logger.info(f"Supabase URL: {'Configured' if os.getenv('SUPABASE_URL') else 'Not configured'}")
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

# Initialize processors
ffmpeg_processor = FFmpegProcessor()
storage_manager = StorageManager()
webhook_manager = WebhookManager()

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ffmpeg-processor",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": [
            "/health",
            "/api/v1/extract-thumbnail",
            "/api/v1/add-watermark",
            "/api/v1/get-metadata",
            "/api/v1/resize-video",
            "/extract-thumbnail",
            "/apply-watermark"
        ]
    }

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Railway"""
    # Test FFmpeg availability
    ffmpeg_status = await ffmpeg_processor.check_ffmpeg()
    
    return {
        "status": "healthy",
        "service": "ffmpeg-processor",
        "timestamp": datetime.utcnow().isoformat(),
        "ffmpeg_available": ffmpeg_status,
        "storage_configured": storage_manager.is_configured()
    }

# Extract thumbnail from video
@app.post("/api/v1/extract-thumbnail", response_model=ProcessingResponse)
async def extract_thumbnail(
    request: ThumbnailRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """Extract a thumbnail from a video at specified timestamp"""
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
@app.post("/api/v1/add-watermark", response_model=ProcessingResponse)
async def add_watermark(
    request: WatermarkRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """Add watermark to a video"""
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
@app.post("/api/v1/get-metadata", response_model=Dict[str, Any])
async def get_video_metadata(request: VideoMetadataRequest):
    """Extract metadata from a video file"""
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
@app.post("/api/v1/resize-video", response_model=ProcessingResponse)
async def resize_video(
    request: ResizeVideoRequest,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """Resize or compress a video"""
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

# ============================================
# COMPATIBILITY ENDPOINTS FOR EDGE FUNCTIONS
# ============================================

@app.post("/extract-thumbnail")
async def extract_thumbnail_compat(request: dict, background_tasks: BackgroundTasks):
    """Compatibility endpoint for edge functions"""
    try:
        # Convert edge function format to our format
        thumbnail_request = ThumbnailRequest(
            generation_id=request.get('generation_id'),
            video_url=request.get('video_url'),
            user_id=request.get('user_id', 'edge-function'),
            timestamp=float(request.get('extract_frame', 0.5)) * 10,
            webhook_url=request.get('webhook_url')
        )
        return await extract_thumbnail(thumbnail_request, background_tasks, None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/apply-watermark")
async def apply_watermark_compat(request: dict, background_tasks: BackgroundTasks):
    """Compatibility endpoint for edge functions"""
    try:
        # Convert edge function format to our format
        watermark_request = WatermarkRequest(
            generation_id=request.get('generation_id'),
            video_url=request.get('content_url'),
            user_id=request.get('user_id', 'edge-function'),
            position=request.get('watermark_position', 'bottom-right'),
            opacity=float(request.get('watermark_opacity', 0.7)),
            scale=float(request.get('watermark_scale', 0.15)),
            webhook_url=request.get('webhook_url')
        )
        return await add_watermark(watermark_request, background_tasks, None)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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
        
        # UPDATE DATABASE with thumbnail URL
        db_updated = await storage_manager.update_generation_thumbnail(
            generation_id=request.generation_id,
            thumbnail_url=thumbnail_url
        )
        
        if db_updated:
            logger.info(f"✅ Database updated with thumbnail URL for generation: {request.generation_id}")
        else:
            logger.warning(f"⚠️ Failed to update database for generation: {request.generation_id}")
        
        # Cleanup temp files
        await storage_manager.cleanup_temp_file(video_path)
        await storage_manager.cleanup_temp_file(thumbnail_path)
        
        # Send webhook if configured
        if request.webhook_url:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="completed",
                result={
                    "thumbnail_url": thumbnail_url,
                    "timestamp": request.timestamp,
                    "db_updated": db_updated
                },
                webhook_url=request.webhook_url
            )
        
        logger.info(f"✅ Thumbnail extraction completed: {processing_id}")
        
    except Exception as e:
        logger.error(f"❌ Thumbnail extraction failed: {str(e)}")
        if request.webhook_url:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="failed",
                error=str(e),
                webhook_url=request.webhook_url
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
        
        # UPDATE DATABASE with watermarked URL
        db_updated = await storage_manager.update_generation_watermarked(
            generation_id=request.generation_id,
            watermarked_url=watermarked_url
        )
        
        if db_updated:
            logger.info(f"✅ Database updated with watermarked URL for generation: {request.generation_id}")
        else:
            logger.warning(f"⚠️ Failed to update database for generation: {request.generation_id}")
        
        # Cleanup
        await storage_manager.cleanup_temp_file(video_path)
        await storage_manager.cleanup_temp_file(output_path)
        if request.watermark_url:
            await storage_manager.cleanup_temp_file(watermark_path)
        
        # Send webhook if configured
        if request.webhook_url:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="completed",
                result={
                    "watermarked_url": watermarked_url,
                    "original_url": request.video_url,
                    "db_updated": db_updated
                },
                webhook_url=request.webhook_url
            )
        
        logger.info(f"✅ Watermark addition completed: {processing_id}")
        
    except Exception as e:
        logger.error(f"❌ Watermark addition failed: {str(e)}")
        if request.webhook_url:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="failed",
                error=str(e),
                webhook_url=request.webhook_url
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
        
        # Send webhook if configured
        if request.webhook_url:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="completed",
                result={
                    "resized_url": resized_url,
                    "original_url": request.video_url,
                    "new_size": file_size,
                    "dimensions": f"{request.width}x{request.height}"
                },
                webhook_url=request.webhook_url
            )
        
        logger.info(f"✅ Video resize completed: {processing_id}")
        
    except Exception as e:
        logger.error(f"❌ Video resize failed: {str(e)}")
        if request.webhook_url:
            await webhook_manager.send_completion_webhook(
                generation_id=request.generation_id,
                processing_id=processing_id,
                status="failed",
                error=str(e),
                webhook_url=request.webhook_url
            )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)