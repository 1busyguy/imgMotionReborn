import os
import logging
import tempfile
import subprocess
from typing import Optional, Dict, Any
import asyncio
from PIL import Image, ImageDraw, ImageFont

try:
    import ffmpeg
    FFMPEG_PYTHON_AVAILABLE = True
except ImportError:
    FFMPEG_PYTHON_AVAILABLE = False
    logging.warning("ffmpeg-python not available, using subprocess fallback")

logger = logging.getLogger(__name__)

class FFmpegProcessor:
    """Handles all FFmpeg operations"""
    
    def __init__(self):
        self.temp_dir = tempfile.gettempdir()
        logger.info(f"FFmpeg processor initialized. Using temp dir: {self.temp_dir}")
    
    async def check_ffmpeg(self) -> bool:
        """Check if FFmpeg is available"""
        try:
            result = await asyncio.create_subprocess_exec(
                'ffmpeg', '-version',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
            return result.returncode == 0
        except Exception as e:
            logger.error(f"FFmpeg not available: {str(e)}")
            return False
    
    def create_default_watermark(self) -> str:
        """Create a default watermark image if none exists"""
        try:
            from PIL import Image, ImageDraw, ImageFont
            
            watermark_path = os.path.join(self.temp_dir, "default_watermark.png")
            
            # Create a transparent image
            width, height = 400, 120
            img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            # Try to use a font, fallback to default if not available
            try:
                font_size = 48
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
            except:
                # Use default font if system font not available
                font = ImageFont.load_default()
            
            # Draw text with shadow effect
            text = "imgMotionMagic"
            
            # Get text bounding box for centering
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (width - text_width) // 2
            y = (height - text_height) // 2
            
            # Draw shadow
            draw.text((x+2, y+2), text, font=font, fill=(0, 0, 0, 128))
            # Draw main text
            draw.text((x, y), text, font=font, fill=(255, 255, 255, 230))
            
            # Save the watermark
            img.save(watermark_path, 'PNG')
            logger.info(f"✅ Created default watermark at: {watermark_path}")
            
            return watermark_path
            
        except Exception as e:
            logger.error(f"Failed to create default watermark: {str(e)}")
            # Create a very simple watermark using FFmpeg as fallback
            watermark_path = os.path.join(self.temp_dir, "default_watermark.png")
            cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi',
                '-i', 'color=c=black@0.0:s=400x120',
                '-vf', "drawtext=text='imgMotionMagic':fontcolor=white@0.9:fontsize=40:x=(w-text_w)/2:y=(h-text_h)/2",
                '-frames:v', '1',
                watermark_path
            ]
            subprocess.run(cmd, capture_output=True)
            return watermark_path
        
    async def extract_thumbnail(
        self,
        video_path: str,
        timestamp: float = 1.0,
        width: Optional[int] = None,
        height: Optional[int] = None
    ) -> str:
        """Extract a thumbnail from video at specified timestamp"""
        try:
            output_path = os.path.join(
                self.temp_dir, 
                f"thumb_{os.urandom(8).hex()}.jpg"
            )
            
            if FFMPEG_PYTHON_AVAILABLE:
                # Get video info first to understand dimensions for aspect ratio preservation
                try:
                    probe = ffmpeg.probe(video_path)
                    video_stream = next((stream for stream in probe['streams'] 
                                       if stream['codec_type'] == 'video'), None)
                    
                    if video_stream:
                        original_width = int(video_stream['width'])
                        original_height = int(video_stream['height'])
                        aspect_ratio = original_width / original_height
                        logger.info(f"Original video: {original_width}x{original_height} (AR: {aspect_ratio:.2f})")
                        
                        # Calculate smart scaling to preserve aspect ratio
                        if width and height:
                            # Scale to fit within bounds while preserving AR
                            target_ar = width / height
                            if aspect_ratio > target_ar:
                                # Video is wider - fit to width
                                scale_width = width
                                scale_height = int(width / aspect_ratio)
                            else:
                                # Video is taller - fit to height  
                                scale_height = height
                                scale_width = int(height * aspect_ratio)
                            width, height = scale_width, scale_height
                            logger.info(f"Smart scaled to: {width}x{height} (preserving AR)")
                        elif width:
                            # Only width provided - calculate height to preserve AR
                            height = int(width / aspect_ratio)
                            logger.info(f"Width scaled to: {width}x{height} (preserving AR)")
                        elif height:
                            # Only height provided - calculate width to preserve AR
                            width = int(height * aspect_ratio)
                            logger.info(f"Height scaled to: {width}x{height} (preserving AR)")
                except Exception as probe_error:
                    logger.warning(f"Could not probe video for AR: {probe_error}")
                
                # Use ffmpeg-python library
                stream = ffmpeg.input(video_path, ss=timestamp)
                
                # Apply scaling if dimensions provided
                if width and height:
                    stream = ffmpeg.filter(stream, 'scale', width, height)
                elif width:
                    stream = ffmpeg.filter(stream, 'scale', width, -1)
                elif height:
                    stream = ffmpeg.filter(stream, 'scale', -1, height)
                
                stream = ffmpeg.output(
                    stream,
                    output_path,
                    vframes=1,
                    format='image2',
                    vcodec='mjpeg',
                    **{'q:v': 2}  # High quality JPEG
                )
                
                # Run FFmpeg command
                await self._run_ffmpeg_async(stream)
            else:
                # Fallback to subprocess with smart aspect ratio handling
                cmd = [
                    'ffmpeg',
                    '-ss', str(timestamp),
                    '-i', video_path,
                    '-vframes', '1',
                    '-f', 'image2',
                    '-vcodec', 'mjpeg',
                    '-q:v', '2'
                ]
                
                # Build scale filter that preserves aspect ratio
                if width and height:
                    # Use scale filter with aspect ratio preservation
                    cmd.extend(['-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease'])
                elif width:
                    cmd.extend(['-vf', f'scale={width}:-1'])
                elif height:
                    cmd.extend(['-vf', f'scale=-1:{height}'])
                
                cmd.append(output_path)
                
                await self._run_command_async(cmd)
            
            logger.info(f"✅ Thumbnail extracted: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"❌ Thumbnail extraction failed: {str(e)}")
            raise
    
    async def add_watermark(
        self,
        video_path: str,
        watermark_path: str,
        position: str = "bottom-center",
        opacity: float = 0.9,
        scale: float = 0.5
    ) -> str:
        """Add watermark to video"""
        try:
            output_path = os.path.join(
                self.temp_dir,
                f"watermarked_{os.urandom(8).hex()}.mp4"
            )
            
            # Check if watermark file exists, create default if not
            if not os.path.exists(watermark_path):
                logger.warning(f"Watermark not found at {watermark_path}, creating default...")
                watermark_path = self.create_default_watermark()
            
            # Position mapping - Clean expressions without backslashes
            positions = {
                "bottom-center": "(W-w)/2:H-h-50",      # 50px from bottom, centered
                "left-center": "10:(H-h)/2",        # Left edge, centered
                "right-center": "W-w-10:(H-h)/2"    # Right edge, centered
            }
            
            overlay_position = positions.get(position, "(W-w)/2:H-h-50")
            logger.info(f"🎯 Watermark position: {position} -> {overlay_position}")
            logger.info(f"📁 Using watermark file: {watermark_path}")
            logger.info(f"💧 Watermark settings: opacity={opacity}, scale={scale}")
            
            if FFMPEG_PYTHON_AVAILABLE:
                # Use ffmpeg-python library with FIXED overlay approach
                video = ffmpeg.input(video_path)
                watermark = ffmpeg.input(watermark_path)
                
                # Scale watermark
                watermark = ffmpeg.filter(
                    watermark,
                    'scale',
                    f'iw*{scale}',
                    f'ih*{scale}'
                )
                
                # Set opacity
                watermark = ffmpeg.filter(watermark, 'format', 'rgba')
                watermark = ffmpeg.filter(watermark, 'colorchannelmixer', aa=opacity)
                
                # FIXED: Split x:y coordinates and pass them separately to avoid colon escaping
                x_expr, y_expr = overlay_position.split(':')
                video = ffmpeg.filter(
                    [video, watermark],
                    'overlay',
                    x=x_expr,
                    y=y_expr
                )
                
                # Output with same codec
                stream = ffmpeg.output(
                    video,
                    output_path,
                    vcodec='libx264',
                    acodec='aac',
                    preset='medium',
                    crf=23,
                    movflags='+faststart'
                )
                
                await self._run_ffmpeg_async(stream)
            else:
                # Fallback to subprocess - this method works fine
                filter_complex = (
                    f"[1:v]scale=iw*{scale}:ih*{scale},"
                    f"format=rgba,colorchannelmixer=aa={opacity}[watermark];"
                    f"[0:v][watermark]overlay={overlay_position}"
                )
                
                cmd = [
                    'ffmpeg',
                    '-i', video_path,
                    '-i', watermark_path,
                    '-filter_complex', filter_complex,
                    '-vcodec', 'libx264',
                    '-acodec', 'aac',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-movflags', '+faststart',
                    output_path
                ]
                
                await self._run_command_async(cmd)
            
            logger.info(f"✅ Watermark added: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"❌ Watermark addition failed: {str(e)}")
            raise
    
    async def resize_video(
        self,
        video_path: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        bitrate: Optional[str] = None,
        preserve_aspect_ratio: bool = True
    ) -> str:
        """Resize/compress video"""
        try:
            output_path = os.path.join(
                self.temp_dir,
                f"resized_{os.urandom(8).hex()}.mp4"
            )
            
            if FFMPEG_PYTHON_AVAILABLE:
                stream = ffmpeg.input(video_path)
                
                # Apply scaling
                if width and height:
                    if preserve_aspect_ratio:
                        scale_filter = f'{width}:{height}:force_original_aspect_ratio=decrease'
                        stream = ffmpeg.filter(stream, 'scale', scale_filter)
                        stream = ffmpeg.filter(stream, 'pad', width, height, '(ow-iw)/2', '(oh-ih)/2')
                    else:
                        stream = ffmpeg.filter(stream, 'scale', width, height)
                elif width:
                    stream = ffmpeg.filter(stream, 'scale', width, -1)
                elif height:
                    stream = ffmpeg.filter(stream, 'scale', -1, height)
                
                # Output parameters
                output_args = {
                    'vcodec': 'libx264',
                    'acodec': 'aac',
                    'preset': 'medium',
                    'crf': 23,
                    'movflags': '+faststart'
                }
                
                if bitrate:
                    output_args['video_bitrate'] = bitrate
                
                stream = ffmpeg.output(stream, output_path, **output_args)
                await self._run_ffmpeg_async(stream)
            else:
                # Fallback to subprocess
                cmd = ['ffmpeg', '-i', video_path]
                
                if width and height:
                    if preserve_aspect_ratio:
                        cmd.extend([
                            '-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2'
                        ])
                    else:
                        cmd.extend(['-vf', f'scale={width}:{height}'])
                elif width:
                    cmd.extend(['-vf', f'scale={width}:-1'])
                elif height:
                    cmd.extend(['-vf', f'scale=-1:{height}'])
                
                cmd.extend([
                    '-vcodec', 'libx264',
                    '-acodec', 'aac',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-movflags', '+faststart'
                ])
                
                if bitrate:
                    cmd.extend(['-b:v', bitrate])
                
                cmd.append(output_path)
                
                await self._run_command_async(cmd)
            
            logger.info(f"✅ Video resized: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"❌ Video resize failed: {str(e)}")
            raise
    
    async def get_video_metadata(self, video_path: str) -> Dict[str, Any]:
        """Extract video metadata using ffprobe"""
        try:
            if FFMPEG_PYTHON_AVAILABLE:
                probe = ffmpeg.probe(video_path)
                
                video_stream = next(
                    (stream for stream in probe['streams'] if stream['codec_type'] == 'video'),
                    None
                )
                
                audio_stream = next(
                    (stream for stream in probe['streams'] if stream['codec_type'] == 'audio'),
                    None
                )
                
                metadata = {
                    'duration': float(probe['format'].get('duration', 0)),
                    'size': int(probe['format'].get('size', 0)),
                    'bit_rate': int(probe['format'].get('bit_rate', 0)),
                    'format': probe['format'].get('format_name', 'unknown')
                }
                
                if video_stream:
                    metadata['video'] = {
                        'codec': video_stream.get('codec_name', 'unknown'),
                        'width': video_stream.get('width', 0),
                        'height': video_stream.get('height', 0),
                        'fps': eval(video_stream.get('r_frame_rate', '0/1')),
                        'bit_rate': int(video_stream.get('bit_rate', 0))
                    }
                
                if audio_stream:
                    metadata['audio'] = {
                        'codec': audio_stream.get('codec_name', 'unknown'),
                        'sample_rate': int(audio_stream.get('sample_rate', 0)),
                        'channels': audio_stream.get('channels', 0),
                        'bit_rate': int(audio_stream.get('bit_rate', 0))
                    }
            else:
                # Fallback to subprocess with ffprobe
                cmd = [
                    'ffprobe',
                    '-v', 'quiet',
                    '-print_format', 'json',
                    '-show_format',
                    '-show_streams',
                    video_path
                ]
                
                result = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, _ = await result.communicate()
                import json
                probe_data = json.loads(stdout)
                
                metadata = {
                    'duration': float(probe_data.get('format', {}).get('duration', 0)),
                    'size': int(probe_data.get('format', {}).get('size', 0)),
                    'format': probe_data.get('format', {}).get('format_name', 'unknown')
                }
            
            return metadata
            
        except Exception as e:
            logger.error(f"❌ Metadata extraction failed: {str(e)}")
            return {'error': str(e)}
    
    async def _run_ffmpeg_async(self, stream):
        """Run FFmpeg command asynchronously using ffmpeg-python"""
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)
            )
        except Exception as e:
            if hasattr(e, 'stderr'):
                error_message = e.stderr.decode() if e.stderr else "Unknown FFmpeg error"
                logger.error(f"FFmpeg error: {error_message}")
            raise Exception(f"ffmpeg error (see stderr output for detail)")
    
    async def _run_command_async(self, cmd):
        """Run command asynchronously using subprocess"""
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                logger.error(f"Command failed: {stderr.decode()}")
                raise Exception(f"FFmpeg command failed: {stderr.decode()}")
            
            return stdout
        except Exception as e:
            logger.error(f"Command execution failed: {str(e)}")
            raise