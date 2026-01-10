from pydantic import BaseModel, Field
from typing import Optional, Literal

class ThumbnailRequest(BaseModel):
    generation_id: str
    video_url: str
    user_id: str
    timestamp: float = Field(default=1.0, ge=0)
    width: Optional[int] = Field(None, gt=0, le=1920)
    height: Optional[int] = Field(None, gt=0, le=1080)
    webhook_url: Optional[str] = None

class WatermarkRequest(BaseModel):
    generation_id: str
    video_url: str
    user_id: str
    position: Literal[
        "bottom-center",          # Bottom edge, centered        
        "left-center",            # Left edge, centered
        "right-center"            # Right edge, centered
    ] = "bottom-center"           # ✅ SET AS DEFAULT
    opacity: float = 0.9          # ✅ More visible
    scale: float = 0.75           # ✅ Much bigger
    watermark_url: Optional[str] = None
    webhook_url: Optional[str] = None

class VideoMetadataRequest(BaseModel):
    video_url: str

class ResizeVideoRequest(BaseModel):
    generation_id: str
    video_url: str
    user_id: str
    width: Optional[int] = Field(None, gt=0, le=3840)
    height: Optional[int] = Field(None, gt=0, le=2160)
    bitrate: Optional[str] = None
    preserve_aspect_ratio: bool = True
    webhook_url: Optional[str] = None

class MergeVideosRequest(BaseModel):
    generation_id: str
    video_urls: list[str]
    user_id: str
    transition: Optional[Literal["fade", "dissolve", "wipe", "none"]] = "none"
    webhook_url: Optional[str] = None

class ExtractAudioRequest(BaseModel):
    generation_id: str
    video_url: str
    user_id: str
    format: Literal["mp3", "aac", "wav"] = "mp3"
    bitrate: Optional[str] = "192k"
    webhook_url: Optional[str] = None

class ProcessingResponse(BaseModel):
    success: bool
    processing_id: str
    message: str
    status: str