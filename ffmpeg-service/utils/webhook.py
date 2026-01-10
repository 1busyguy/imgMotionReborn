import os
import logging
import httpx
import json
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class WebhookManager:
    """Handles webhook notifications"""
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")  # Add anon key for edge functions
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")  # Service role key as backup
        self.default_webhook = f"{self.supabase_url}/functions/v1/ffmpeg-webhook"
        
        # Log configuration
        if self.supabase_anon_key:
            logger.info(f"✅ Webhook manager configured with anon key: {self.supabase_anon_key[:20]}...")
        elif self.supabase_service_key:
            logger.info(f"✅ Webhook manager using service role key: {self.supabase_service_key[:20]}...")
        else:
            logger.warning("⚠️ No Supabase keys configured for webhook authentication")
    
    async def send_completion_webhook(
        self,
        generation_id: str,
        processing_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        webhook_url: Optional[str] = None
    ):
        """Send completion webhook with proper JSON formatting and authentication"""
        try:
            url = webhook_url or self.default_webhook
            
            # Build payload step by step
            payload = {}
            payload["generation_id"] = generation_id
            payload["processing_id"] = processing_id
            payload["status"] = status
            payload["timestamp"] = datetime.utcnow().isoformat()
            
            # Clean and add result URLs
            if result:
                cleaned_result = {}
                
                # Clean each URL individually
                for key, value in result.items():
                    if isinstance(value, str) and value.startswith('http'):
                        # Remove any quotes, semicolons, or extra characters
                        cleaned_value = value.strip().strip('"').strip("'").strip(';').strip(',')
                        cleaned_result[key] = cleaned_value
                        logger.info(f"🧹 Cleaned {key}: {cleaned_value}")
                    else:
                        cleaned_result[key] = value
                
                # Add to payload
                if "thumbnail_url" in cleaned_result:
                    payload["thumbnail_url"] = cleaned_result["thumbnail_url"]
                
                if "watermarked_url" in cleaned_result:
                    payload["watermarked_url"] = cleaned_result["watermarked_url"]
                    payload["result_url"] = cleaned_result["watermarked_url"]
                
                if "resized_url" in cleaned_result:
                    payload["resized_url"] = cleaned_result["resized_url"]
                    payload["result_url"] = cleaned_result["resized_url"]
                
                # Add db_updated flag if present
                if "db_updated" in cleaned_result:
                    payload["db_updated"] = cleaned_result["db_updated"]
                
                # Store cleaned result
                payload["result"] = cleaned_result
            
            if error:
                payload["error"] = error
            
            logger.info(f"Sending webhook to: {url}")
            
            # FIXED: Use json.dumps with proper settings to avoid semicolons
            try:
                clean_json_str = json.dumps(payload, indent=2, separators=(',', ': '), ensure_ascii=False)
                logger.info(f"Webhook payload:\n{clean_json_str}")
            except Exception as log_error:
                logger.warning(f"Could not format payload for logging: {log_error}")
                logger.info(f"Webhook payload keys: {list(payload.keys())}")
            
            # Prepare headers with authentication
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "FFmpeg-Service/1.0"
            }
            
            # Add authentication headers for Supabase edge functions
            if url.startswith(self.supabase_url) and "/functions/" in url:
                # This is a Supabase edge function - add auth headers
                auth_key = self.supabase_anon_key or self.supabase_service_key
                if auth_key:
                    headers["Authorization"] = f"Bearer {auth_key}"
                    headers["apikey"] = auth_key  # Some edge functions check this too
                    logger.info("🔐 Added Supabase authentication headers for edge function")
                else:
                    logger.warning("⚠️ No Supabase key available for edge function authentication")
            
            # Send webhook
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=30.0
                )
                
                logger.info(f"Webhook response status: {response.status_code}")
                
                if response.status_code == 200:
                    logger.info("✅ Webhook sent successfully")
                    try:
                        response_data = response.json()
                        clean_response = json.dumps(response_data, indent=2, separators=(',', ': '))
                        logger.info(f"Webhook response:\n{clean_response}")
                    except Exception as resp_error:
                        logger.info(f"Webhook response text: {response.text}")
                elif response.status_code == 401:
                    logger.error(f"❌ Webhook authentication failed: {response.text}")
                    logger.error("Make sure SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is set in environment variables")
                else:
                    logger.warning(f"⚠️ Webhook failed: {response.status_code}")
                    logger.warning(f"Response: {response.text}")
                    
        except Exception as e:
            logger.error(f"❌ Webhook failed: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
    
    async def send_progress_webhook(
        self,
        generation_id: str,
        processing_id: str,
        progress: int,
        message: str,
        webhook_url: Optional[str] = None
    ):
        """Send progress update webhook with authentication"""
        try:
            url = webhook_url or self.default_webhook
            
            payload = {
                "generation_id": generation_id,
                "processing_id": processing_id,
                "status": "processing",
                "progress": progress,
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Prepare headers with authentication
            headers = {
                "Content-Type": "application/json"
            }
            
            # Add authentication headers for Supabase edge functions
            if url.startswith(self.supabase_url) and "/functions/" in url:
                auth_key = self.supabase_anon_key or self.supabase_service_key
                if auth_key:
                    headers["Authorization"] = f"Bearer {auth_key}"
                    headers["apikey"] = auth_key
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    logger.info(f"✅ Progress webhook sent: {progress}%")
                elif response.status_code == 401:
                    logger.error(f"❌ Progress webhook authentication failed")
                    
        except Exception as e:
            logger.error(f"❌ Progress webhook failed: {str(e)}")