import os
import httpx
import tempfile
import logging
import json
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class StorageManager:
    """Handles file storage operations using direct Supabase API calls"""
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.temp_dir = tempfile.gettempdir()
        
        # Log configuration status
        if not self.supabase_url or not self.supabase_key:
            logger.warning("⚠️ Supabase credentials not configured. Storage operations will be limited.")
        else:
            logger.info(f"✅ Storage manager initialized with Supabase: {self.supabase_url}")
            logger.info(f"🔑 Using service role key: {self.supabase_key[:20]}...")
            
    def is_configured(self) -> bool:
        """Check if storage is properly configured"""
        return bool(self.supabase_url and self.supabase_key)
    
    async def download_temp_file(self, url: str) -> str:
        """Download file to temporary location"""
        try:
            file_extension = os.path.splitext(url)[1] or '.mp4'
            file_path = os.path.join(
                self.temp_dir,
                f"download_{os.urandom(8).hex()}{file_extension}"
            )
            
            logger.info(f"📥 Downloading file from: {url}")
            logger.info(f"📂 Target path: {file_path}")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(url, follow_redirects=True)
                logger.info(f"📊 Download response status: {response.status_code}")
                logger.info(f"📊 Response headers: {dict(response.headers)}")
                
                response.raise_for_status()
                
                with open(file_path, 'wb') as f:
                    f.write(response.content)
            
            # Verify file was written
            if os.path.exists(file_path):
                actual_size = os.path.getsize(file_path)
                logger.info(f"✅ Downloaded file: {file_path} ({actual_size} bytes)")
                logger.info(f"📁 File exists and is readable: {os.access(file_path, os.R_OK)}")
            else:
                raise Exception(f"File was not created at {file_path}")
                
            return file_path
            
        except Exception as e:
            logger.error(f"❌ Download failed: {str(e)}")
            logger.error(f"🔍 URL: {url}")
            logger.error(f"🔍 Target path: {file_path if 'file_path' in locals() else 'undefined'}")
            raise
    
    async def upload_to_supabase(
        self,
        file_path: str,
        user_id: str,
        folder: str
    ) -> str:
        """Upload file to Supabase storage using direct API with enhanced verification"""
    
        # If Supabase not configured, return local file path
        if not self.is_configured():
            logger.warning("⚠️ Supabase not configured, returning local path")
            return file_path
        
        try:
            # Check if file exists before upload
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")
            
            file_size = os.path.getsize(file_path)
            logger.info(f"📤 Starting upload for file: {file_path}")
            logger.info(f"📊 File size: {file_size} bytes")
        
            # Read file
            with open(file_path, 'rb') as f:
                file_data = f.read()
        
            logger.info(f"📖 Read {len(file_data)} bytes from file")
        
            # Determine file extension
            ext = os.path.splitext(file_path)[1] or '.mp4'
        
            # Create storage path - FIXED: Simpler path structure
            filename = f"{os.urandom(8).hex()}{ext}"
            storage_path = f"{user_id}/{folder}/{filename}"
            logger.info(f"🗂️ Storage path: {storage_path}")
        
            # Get content type
            content_type = self._get_content_type(ext)
            logger.info(f"🏷️ Content type: {content_type}")
        
            # FIXED: Use proper Supabase upload with upsert
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": content_type,
                "Cache-Control": "3600"
            }
        
            # Upload URL - FIXED: Use upsert parameter
            upload_url = f"{self.supabase_url}/storage/v1/object/user-files/{storage_path}?upsert=true"
            logger.info(f"🌐 Upload URL: {upload_url}")
        
            # Upload file
            logger.info("📡 Starting upload request...")
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    upload_url,
                    content=file_data,
                    headers=headers
                )
            
                logger.info(f"📊 Upload response status: {response.status_code}")
                logger.info(f"📊 Upload response text: {response.text}")
            
                # FIXED: Check for both 200 and 201 (created)
                if response.status_code in [200, 201]:
                    logger.info(f"✅ Upload successful: {storage_path}")
                
                    try:
                        response_data = response.json()
                        logger.info(f"📋 Upload response data: {json.dumps(response_data, indent=2)}")
                    
                        # Check if response indicates success
                        if 'error' in response_data:
                            raise Exception(f"Supabase error: {response_data['error']}")
                        
                    except Exception as json_error:
                        logger.info(f"📋 Upload response (non-JSON): {response.text}")
                else:
                    logger.error(f"❌ Upload failed with status {response.status_code}")
                    logger.error(f"❌ Upload response: {response.text}")
                    raise Exception(f"Upload failed: {response.status_code} - {response.text}")
        
            # Construct public URL
            public_url = f"{self.supabase_url}/storage/v1/object/public/user-files/{storage_path}"
            logger.info(f"🔗 Generated public URL: {public_url}")
        
            # FIXED: Verify upload worked by checking if file exists in storage
            await self._verify_upload_success(storage_path, public_url)
        
            logger.info(f"✅ File uploaded successfully to: {public_url}")
            return public_url
        
        except Exception as e:
            logger.error(f"❌ Upload failed: {str(e)}")
            logger.error(f"🔍 File path: {file_path}")
            logger.error(f"🔍 User ID: {user_id}")
            logger.error(f"🔍 Folder: {folder}")
        
            # If upload fails, return local path as fallback
            logger.warning(f"⚠️ Falling back to local path: {file_path}")
            return file_path
    
    async def update_generation_thumbnail(self, generation_id: str, thumbnail_url: str) -> bool:
        """Update the thumbnail_url column in ai_generations table"""
        if not self.is_configured():
            logger.warning("⚠️ Supabase not configured, cannot update database")
            return False
        
        try:
            logger.info(f"📝 Updating ai_generations table for generation_id: {generation_id}")
            logger.info(f"🖼️ Setting thumbnail_url: {thumbnail_url}")
            
            # Prepare the update data
            update_data = {
                "thumbnail_url": thumbnail_url
            }
            
            # Prepare headers
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            
            # Build the update URL with filter
            update_url = f"{self.supabase_url}/rest/v1/ai_generations?id=eq.{generation_id}"
            logger.info(f"🌐 Update URL: {update_url}")
            
            # Perform the update
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.patch(
                    update_url,
                    json=update_data,
                    headers=headers
                )
                
                logger.info(f"📊 Update response status: {response.status_code}")
                logger.info(f"📊 Update response text: {response.text}")
                
                if response.status_code in [200, 204]:
                    logger.info(f"✅ Database updated successfully for generation_id: {generation_id}")
                    return True
                else:
                    logger.error(f"❌ Database update failed with status {response.status_code}")
                    logger.error(f"❌ Response: {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Database update failed: {str(e)}")
            logger.error(f"🔍 Generation ID: {generation_id}")
            logger.error(f"🔍 Thumbnail URL: {thumbnail_url}")
            return False
    
    async def update_generation_watermarked(self, generation_id: str, watermarked_url: str) -> bool:
        """Update the watermarked_url column in ai_generations table"""
        if not self.is_configured():
            logger.warning("⚠️ Supabase not configured, cannot update database")
            return False
        
        try:
            logger.info(f"📝 Updating ai_generations table for generation_id: {generation_id}")
            logger.info(f"💧 Setting watermarked_url: {watermarked_url}")
            
            # Prepare the update data
            update_data = {
                "watermarked_url": watermarked_url
            }
            
            # Prepare headers
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            
            # Build the update URL with filter
            update_url = f"{self.supabase_url}/rest/v1/ai_generations?id=eq.{generation_id}"
            logger.info(f"🌐 Update URL: {update_url}")
            
            # Perform the update
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.patch(
                    update_url,
                    json=update_data,
                    headers=headers
                )
                
                logger.info(f"📊 Update response status: {response.status_code}")
                logger.info(f"📊 Update response text: {response.text}")
                
                if response.status_code in [200, 204]:
                    logger.info(f"✅ Database updated successfully for generation_id: {generation_id}")
                    return True
                else:
                    logger.error(f"❌ Database update failed with status {response.status_code}")
                    logger.error(f"❌ Response: {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Database update failed: {str(e)}")
            logger.error(f"🔍 Generation ID: {generation_id}")
            logger.error(f"🔍 Watermarked URL: {watermarked_url}")
            return False

    async def _verify_upload_success(self, storage_path: str, public_url: str):
        """Verify that upload actually worked by checking storage API"""
        try:
            logger.info(f"🔍 Verifying upload success for: {storage_path}")
        
            # Check using Supabase storage API
            verify_url = f"{self.supabase_url}/storage/v1/object/info/user-files/{storage_path}"
            headers = {
                "apikey": self.supabase_key,
                "Authorization": f"Bearer {self.supabase_key}"
            }
        
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(verify_url, headers=headers)
            
                logger.info(f"🔍 Verification response status: {response.status_code}")
            
                if response.status_code == 200:
                    try:
                        info_data = response.json()
                        logger.info(f"✅ Upload verified - file exists in storage")
                        logger.info(f"📊 File info: {json.dumps(info_data, indent=2)}")
                    except:
                        logger.info(f"✅ Upload verified - got 200 response")
                else:
                    logger.warning(f"⚠️ Upload verification failed: {response.status_code}")
                    logger.warning(f"⚠️ Response: {response.text}")
                
                    # Also try the public URL
                    public_response = await client.head(public_url)
                    logger.info(f"🔍 Public URL test: {public_response.status_code}")
                
        except Exception as verify_error:
            logger.warning(f"⚠️ Upload verification failed: {verify_error}")
            logger.warning("File may still be uploaded correctly")
    
    async def _test_url_accessibility(self, url: str):
        """Test if uploaded file URL is accessible"""
        try:
            logger.info(f"🧪 Testing URL accessibility: {url}")
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Use HEAD request to test without downloading content
                test_response = await client.head(url, follow_redirects=True)
                
                logger.info(f"🧪 URL test status: {test_response.status_code}")
                logger.info(f"🧪 URL test headers: {dict(test_response.headers)}")
                
                if test_response.status_code == 200:
                    logger.info("✅ URL is accessible")
                    
                    # Log content details if available
                    content_length = test_response.headers.get('content-length')
                    content_type = test_response.headers.get('content-type')
                    if content_length:
                        logger.info(f"📊 Content length: {content_length} bytes")
                    if content_type:
                        logger.info(f"🏷️ Content type: {content_type}")
                        
                elif test_response.status_code == 404:
                    logger.warning("⚠️ URL returns 404 - file may not be immediately available")
                else:
                    logger.warning(f"⚠️ URL returns status {test_response.status_code}")
                    
        except Exception as test_error:
            logger.warning(f"⚠️ URL accessibility test failed: {test_error}")
            logger.warning("This doesn't necessarily mean the upload failed - could be network/timing issue")
    
    async def cleanup_temp_file(self, file_path: str):
        """Remove temporary file"""
        try:
            if file_path and os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                os.remove(file_path)
                logger.info(f"🧹 Cleaned up: {file_path} ({file_size} bytes)")
            else:
                logger.info(f"🧹 Cleanup skipped - file doesn't exist: {file_path}")
        except Exception as e:
            logger.warning(f"⚠️ Cleanup failed for {file_path}: {str(e)}")
    
    def _get_content_type(self, extension: str) -> str:
        """Get MIME type from file extension"""
        mime_types = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        }
        detected_type = mime_types.get(extension.lower(), 'application/octet-stream')
        logger.debug(f"🏷️ Extension '{extension}' mapped to MIME type: {detected_type}")
        return detected_type