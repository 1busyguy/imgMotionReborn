import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const JWKS_URL = 'https://rest.alpha.fal.ai/.well-known/jwks.json';

// FFmpeg service configuration
const FFMPEG_SERVICE_URL = Deno.env.get('FFMPEG_SERVICE_URL');
const ENABLE_FFMPEG_PROCESSING = Deno.env.get('ENABLE_FFMPEG_PROCESSING') === 'true';
const USE_EDGE_FUNCTION_ENDPOINTS = Deno.env.get('USE_EDGE_FUNCTION_ENDPOINTS') === 'true';

// Log configuration at startup
console.log('🔧 FFmpeg Configuration:', {
    serviceUrl: FFMPEG_SERVICE_URL ? 'Configured' : 'Not configured',
    enabled: ENABLE_FFMPEG_PROCESSING,
    useEdgeFunctionEndpoints: USE_EDGE_FUNCTION_ENDPOINTS
});

// Handle FFmpeg webhook callbacks (thumbnail extraction, watermarking)
async function handleFFmpegWebhook(req: Request) {
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Parse FFmpeg webhook payload
        const requestBody = await req.text();
        console.log('🎬 FFmpeg webhook payload:', requestBody);

        let webhookData;
        try {
            webhookData = JSON.parse(requestBody);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            return new Response(JSON.stringify({
                success: false,
                error: "Invalid JSON",
                bodyReceived: requestBody
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const {
            generation_id,
            processing_id,
            status,
            timestamp,
            thumbnail_url,
            watermarked_url,
            result,
            error: error_message
        } = webhookData;

        console.log('🎬 FFmpeg webhook received:', {
            generation_id,
            processing_id,
            status,
            has_thumbnail_url: !!thumbnail_url,
            has_watermarked_url: !!watermarked_url
        });

        if (!generation_id) {
            throw new Error('Generation ID is required');
        }

        // Get the generation record
        const { data: generation, error: fetchError } = await supabase
            .from('ai_generations')
            .select('user_id, metadata, tool_type, output_file_url')
            .eq('id', generation_id)
            .single();

        if (fetchError || !generation) {
            console.error('❌ Error fetching generation:', fetchError);
            throw new Error('Generation not found');
        }

        // Prepare update data
        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        // Handle thumbnail completion
        if (status === 'completed' && thumbnail_url) {
            updateData.thumbnail_url = thumbnail_url;
            updateData.metadata = {
                ...generation.metadata,
                thumbnail_processing: {
                    status: 'completed',
                    thumbnail_url: thumbnail_url,
                    completed_at: new Date().toISOString(),
                    processing_id: processing_id
                }
            };
            console.log('✅ Thumbnail processing completed:', thumbnail_url);
        }

        // Handle watermark completion
        if (status === 'completed' && watermarked_url) {
            updateData.output_file_url = watermarked_url;
            updateData.metadata = {
                ...generation.metadata,
                watermark_processing: {
                    status: 'completed',
                    watermarked_url: watermarked_url,
                    original_url: generation.output_file_url,
                    completed_at: new Date().toISOString(),
                    processing_id: processing_id,
                    watermarked: true
                }
            };
            console.log('✅ Watermark processing completed:', watermarked_url);
        }

        // Handle failures
        if (status === 'failed') {
            updateData.metadata = {
                ...generation.metadata,
                ffmpeg_processing: {
                    status: 'failed',
                    error_message: error_message,
                    failed_at: new Date().toISOString(),
                    processing_id: processing_id
                }
            };
            console.log('❌ FFmpeg processing failed:', error_message);
        }

        // Update the generation record
        const { error: updateError } = await supabase
            .from('ai_generations')
            .update(updateData)
            .eq('id', generation_id);

        if (updateError) {
            console.error('❌ Error updating generation:', updateError);
            throw new Error(`Database update failed: ${updateError.message}`);
        }

let _jwks_cache = null;
let _jwks_cache_time = 0;
const JWKS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Simple deduplication cache to prevent double processing
const processedWebhooks = new Map();
const WEBHOOK_CACHE_DURATION = 60 * 1000; // 1 minute

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fal-webhook-request-id, x-fal-webhook-user-id, x-fal-webhook-timestamp, x-fal-webhook-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to check if user should get watermarked content
function shouldWatermarkContent(profile: any): boolean {
    if (!profile) return true; // Default to watermark if no profile

    // Check various tier fields (different apps might use different field names)
    const tier = profile.subscription_tier ||
        profile.subscription_status ||
        profile.tier ||
        profile.plan ||
        'free';

    return tier.toLowerCase() === 'free';
}

// Helper function to determine if generation is a video
function isVideoGeneration(toolType: string, outputUrl: string): boolean {
    const toolTypeLower = toolType?.toLowerCase() || '';

    // Check tool type for video generation patterns
    const videoToolPatterns = [
        'text2video',
        'image2video',
        'wan',
        'animatediff',
        'haiper',
        'mochi',
        'minimax',
        'cogvideox',
        'ltx',
        'runway',
        'luma',
        'kling',
        'qwen',
        'video'
    ];

    const isVideoByTool = videoToolPatterns.some(pattern => toolTypeLower.includes(pattern));

    // Check file extension as backup
    const isVideoByUrl = outputUrl && outputUrl.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv)$/);

    return isVideoByTool || !!isVideoByUrl;
}

// Helper function to determine if generation is an image
function isImageGeneration(toolType: string, outputUrl: string): boolean {
    const toolTypeLower = toolType?.toLowerCase() || '';

    // Check tool type for image generation patterns
    const imageToolPatterns = [
        'flux',
        'bria',
        'hidream',
        'stable-diffusion',
        'sdxl',
        'image',
        'txt2img',
        'gemini',
        'qwen',
        'img2img'
    ];

    const isImageByTool = imageToolPatterns.some(pattern => toolTypeLower.includes(pattern));

    // Check file extension as backup
    const isImageByUrl = outputUrl && outputUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);

    return isImageByTool || !!isImageByUrl;
}

// Helper function to call FFmpeg service with support for both endpoint patterns
async function callFFmpegService(endpoint: string, data: any) {
    if (!FFMPEG_SERVICE_URL || !ENABLE_FFMPEG_PROCESSING) {
        console.log('🔇 FFmpeg processing disabled or not configured');
        return null;
    }

    try {
        // Determine which endpoint pattern to use
        let finalEndpoint = endpoint;

        // If we're using edge function endpoints (shorter URLs)
        if (USE_EDGE_FUNCTION_ENDPOINTS) {
            // Convert /api/v1/extract-thumbnail to /extract-thumbnail
            finalEndpoint = endpoint.replace('/api/v1/', '/');
        }

        console.log(`📡 Calling FFmpeg service: ${FFMPEG_SERVICE_URL}${finalEndpoint}`);

        const response = await fetch(`${FFMPEG_SERVICE_URL}${finalEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`FFmpeg service error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`Failed to call FFmpeg service ${endpoint}:`, error);
        return null; // Don't throw, just return null to continue processing
    }
}

// Process VIDEO ONLY with FFmpeg (frame extraction + conditional watermarking)
async function processVideoWithFFmpeg(generation: any, videoUrl: string, userProfile: any) {
    if (!FFMPEG_SERVICE_URL || !ENABLE_FFMPEG_PROCESSING) {
        console.log('🔇 FFmpeg processing disabled or not configured');
        return;
    }

    // CRITICAL: Only process if this is actually a video generation
    const isVideo = isVideoGeneration(generation.tool_type, videoUrl);
    
    if (!isVideo) {
        console.log(`📷 Skipping FFmpeg for non-video generation: ${generation.tool_type}`);
        return;
    }

    const tasks = [];
    
    // FIXED: Use the correct field and logic for tier detection
    const userTier = userProfile?.subscription_tier ||
        userProfile?.subscription_status ||
        'free';

    // FIXED: Proper tier detection - check for actual paid tier values
    const isFreeTier = !userProfile || 
        !userProfile.subscription_tier || 
        userProfile.subscription_tier.toLowerCase() === 'free' ||
        userProfile.subscription_tier.toLowerCase() === 'trial';

    console.log('🔍 FFMPEG TIER DEBUGGING:', {
        user_id: generation.user_id,
        user_profile_exists: !!userProfile,
        subscription_tier: userProfile?.subscription_tier,
        subscription_status: userProfile?.subscription_status,
        calculated_tier: userTier,
        is_free_tier: isFreeTier,
        will_add_watermark: isFreeTier
    });

    console.log('🎬 Starting FFmpeg processing for VIDEO:', {
        generationId: generation.id,
        toolType: generation.tool_type,
        userTier,
        isVideo: true,
        isFreeTier,
        watermarkDecision: isFreeTier ? 'WILL_WATERMARK' : 'WILL_SKIP_WATERMARK'
    });

    // Extract thumbnail if not already provided by FAL
    const hasFalThumbnail = generation.metadata?.thumbnail_url ||
        generation.metadata?.original_thumbnail_url ||
        generation.thumbnail_url;

    if (!hasFalThumbnail) {
        console.log('📸 No FAL thumbnail found, extracting with FFmpeg...');
        tasks.push(
            callFFmpegService('/api/v1/extract-thumbnail', {
                generation_id: generation.id,
                video_url: videoUrl,
                user_id: generation.user_id,
                timestamp: 2.0,
                width: 1280,
                height: 720,
                webhook_url: `${SUPABASE_URL}/functions/v1/ffmpeg-webhook`
            })
        );
    } else {
        console.log('✅ Using existing thumbnail from FAL.ai, skipping extraction');
    }

    // Add watermark ONLY for FREE tier users
    if (isFreeTier) {
        console.log('💧 User is on FREE tier, adding watermark to VIDEO');
        console.log('💧 WATERMARK REASONING: subscription_tier=' + userProfile?.subscription_tier + ', isFreeTier=' + isFreeTier);
        tasks.push(
            callFFmpegService('/api/v1/add-watermark', {
                generation_id: generation.id,
                video_url: videoUrl,
                user_id: generation.user_id,
                position: 'bottom-center',
                opacity: 0.95,
                scale: 1.2,
                webhook_url: `${SUPABASE_URL}/functions/v1/ffmpeg-webhook`
            })
        );
    } else {
        console.log('💎 User is on PAID tier, skipping watermark');
        console.log('💎 SKIP REASONING: subscription_tier=' + userProfile?.subscription_tier + ', isFreeTier=' + isFreeTier);
    }

    // Execute tasks if there are any
    if (tasks.length > 0) {
        const results = await Promise.allSettled(tasks);

        console.log('✅ FFmpeg tasks initiated:', {
            total: results.length,
            successful: results.filter(r => r.status === 'fulfilled' && r.value).length
        });

        // Update generation metadata to track FFmpeg processing
        await supabase
            .from('ai_generations')
            .update({
                metadata: {
                    ...generation.metadata,
                    ffmpeg_processing_initiated: true,
                    ffmpeg_tasks_count: results.length,
                    watermark_required: isFreeTier,
                    user_tier: userTier,
                    media_type: 'video'
                }
            })
            .eq('id', generation.id);
    } else {
        console.log('ℹ️ No FFmpeg tasks needed for this video');
    }
}

// Enhanced logging function for FAL.ai webhook responses
function logWebhookResponse(event: any, generation: any) {
    console.log('📊 === FAL.AI WEBHOOK RESPONSE ANALYSIS ===');
    console.log('🔍 Event Status:', event.status);
    console.log('🔍 Event Type:', typeof event);
    console.log('🔍 Generation ID:', generation?.id);
    console.log('🔍 Tool Type:', generation?.tool_type);
    console.log('🔍 User ID:', generation?.user_id);

    // Log the complete event structure
    console.log('📋 Complete Event Object:', JSON.stringify(event, null, 2));

    // Check for error indicators
    if (event.error) {
        console.log('❌ Error Object Found:', JSON.stringify(event.error, null, 2));
    }

    // Check for status codes in various locations
    if (event.status_code) {
        console.log('📢 Status Code in Event:', event.status_code);
    }

    if (event.payload?.error) {
        console.log('❌ Payload Error:', JSON.stringify(event.payload.error, null, 2));
    }

    // Log payload structure
    if (event.payload) {
        console.log('📦 Payload Keys:', Object.keys(event.payload));
        console.log('📦 Payload Structure:', JSON.stringify(event.payload, null, 2));
    }

    console.log('📊 === END WEBHOOK ANALYSIS ===');
}

// Replace the handleWebhookError function in fal-webhook/index.ts:

function handleWebhookError(event: any, generation: any) {
    console.log('🚨 === PROCESSING WEBHOOK ERROR ===');

    let errorMessage = 'Generation failed';
    let errorCode = null;
    let contentViolation = false;
    let serverError = false;
    let badRequest = false;

    // Check all possible error locations in FAL webhook response
    const errorSources = [
        event.error,
        event.payload?.error,
        event.response?.error,
        event.data?.error
    ];

    for (const source of errorSources) {
        if (source) {
            if (typeof source === 'string') {
                errorMessage = source;
            } else if (source.message) {
                errorMessage = source.message;
            } else if (source.detail) {
                errorMessage = typeof source.detail === 'string'
                    ? source.detail
                    : JSON.stringify(source.detail);
            } else if (source.error) {
                errorMessage = source.error;
            }

            // Extract status code
            if (source.status_code) {
                errorCode = source.status_code;
            } else if (source.code) {
                errorCode = source.code;
            } else if (source.status) {
                errorCode = source.status;
            }

            if (errorMessage !== 'Generation failed') break;
        }
    }

    // Also check direct event properties
    if (!errorCode && event.status_code) {
        errorCode = event.status_code;
    }
    if (!errorCode && event.http_status) {
        errorCode = event.http_status;
    }

    // Parse error code if it's a string
    const numericCode = typeof errorCode === 'string' ? parseInt(errorCode) : errorCode;

    // Categorize error based on code and message
    if (numericCode === 422) {
        contentViolation = true;
        if (errorMessage === 'Generation failed') {
            errorMessage = 'Content policy violation: The input contains inappropriate content';
        }
    } else if (numericCode === 500) {
        serverError = true;
        if (errorMessage === 'Generation failed') {
            errorMessage = 'Server error: FAL.ai service temporarily unavailable';
        }
    } else if (numericCode === 400) {
        badRequest = true;
        if (errorMessage === 'Generation failed') {
            errorMessage = 'Invalid request: Please check your input parameters';
        }
    }

    // Additional content violation detection through message content
    const violationKeywords = [
        'policy', 'violation', 'inappropriate', 'nsfw', 'content',
        'unsafe', 'prohibited', 'not allowed', 'rejected'
    ];

    if (!contentViolation && violationKeywords.some(keyword =>
        errorMessage.toLowerCase().includes(keyword))) {
        contentViolation = true;
    }

    console.log('📊 Error Analysis Complete:', {
        errorCode: numericCode,
        contentViolation,
        serverError,
        badRequest,
        errorMessage: errorMessage.substring(0, 200)
    });

    return {
        errorMessage,
        errorCode: numericCode,
        contentViolation,
        serverError,
        badRequest,
        errorType: contentViolation ? 'content_violation' :
            serverError ? 'server_error' :
                badRequest ? 'bad_request' :
                    'unknown_error'
    };
}

// Fetch and cache JWKS
async function fetchJwks() {
    const now = Date.now();
    if (_jwks_cache && now - _jwks_cache_time < JWKS_CACHE_DURATION) {
        return _jwks_cache;
    }

    const response = await fetch(JWKS_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }

    const jwks = await response.json();
    _jwks_cache = jwks.keys;
    _jwks_cache_time = now;
    return _jwks_cache;
}

// Base64URL decode
function base64UrlDecode(str) {
    const padded = str + '='.repeat((4 - str.length % 4) % 4);
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Convert hex to bytes
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// Verify FAL webhook signature
async function verifyFalSignature(headers, body) {
    const requestId = headers.get("x-fal-webhook-request-id");
    const userId = headers.get("x-fal-webhook-user-id");
    const timestamp = headers.get("x-fal-webhook-timestamp");
    const signatureHex = headers.get("x-fal-webhook-signature");

    if (!requestId || !userId || !timestamp || !signatureHex) {
        return false;
    }

    // Check timestamp (within ±5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const webhookTimestamp = parseInt(timestamp);
    if (isNaN(webhookTimestamp) || Math.abs(now - webhookTimestamp) > 300) {
        return false;
    }

    // Compute SHA-256 hash of body
    const bodyHash = await crypto.subtle.digest("SHA-256", body);
    const bodyHashArray = new Uint8Array(bodyHash);
    const bodyHashHex = Array.from(bodyHashArray).map(b => b.toString(16).padStart(2, '0')).join('');

    // Construct message to verify
    const messageToVerify = [
        requestId,
        userId,
        timestamp,
        bodyHashHex
    ].join('\n');

    // Decode signature
    let signatureBytes;
    try {
        signatureBytes = hexToBytes(signatureHex);
    } catch (error) {
        return false;
    }

    // Fetch public keys
    let publicKeys;
    try {
        publicKeys = await fetchJwks();
    } catch (error) {
        return false;
    }

    // Try verification with each key
    for (const key of publicKeys) {
        try {
            if (!key.x) continue;

            const publicKeyBytes = base64UrlDecode(key.x);
            const messageBytes = new TextEncoder().encode(messageToVerify);
            const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

            if (isValid) {
                return true;
            }
        } catch (error) {
            continue;
        }
    }

    return false;
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Only accept POST
    if (req.method !== 'POST') {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: corsHeaders
        });
    }

    // Check if this is an FFmpeg webhook callback (no FAL headers)
    const falHeaders = {
        requestId: req.headers.get('x-fal-webhook-request-id'),
        userId: req.headers.get('x-fal-webhook-user-id'),
        timestamp: req.headers.get('x-fal-webhook-timestamp'),
        signature: req.headers.get('x-fal-webhook-signature')
    };

    const hasFalHeaders = Object.values(falHeaders).every(h => h !== null);
    const isFFmpegWebhook = !hasFalHeaders;

    console.log('🔍 Webhook type detection:', {
        hasFalHeaders,
        isFFmpegWebhook,
        headers: Object.fromEntries(req.headers.entries())
    });

    // Handle FFmpeg webhook callbacks (from Railway service)
    if (isFFmpegWebhook) {
        console.log('🎬 Processing FFmpeg webhook callback');
        return await handleFFmpegWebhook(req);
    }

    // Check for FAL headers
    if (!hasFalHeaders) {
        return new Response(JSON.stringify({
            error: 'Not a valid FAL.ai webhook'
        }), {
            status: 400,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }

    let rawBody;
    let event;

    try {
        // Read body
        rawBody = await req.arrayBuffer();
        rawBody = new Uint8Array(rawBody);

        // QUICK FIX: Parse body early to check model type
        const tempBodyText = new TextDecoder().decode(rawBody);
        let tempEvent;
        try {
            tempEvent = JSON.parse(tempBodyText);
        } catch (e) {
            // If we can't parse, continue with normal signature verification
            tempEvent = null;
        }

        // Check if this is a model with signature issues
        let skipSignatureVerification = false;

        if (tempEvent && (tempEvent.request_id || tempEvent.gateway_request_id)) {
            const tempRequestId = tempEvent.request_id || tempEvent.gateway_request_id;

            // Get the generation to check the model
            const { data: generation } = await supabase
                .from('ai_generations')
                .select('metadata')
                .eq('metadata->>fal_request_id', tempRequestId)
                .maybeSingle();

            // List of models that have signature verification issues
            const modelsWithSignatureIssues = [
                'fal-ai/flux-kontext-lora/text-to-image',
                'fal-ai/flux-kontext/dev'
            ];

            if (generation?.metadata?.model && modelsWithSignatureIssues.includes(generation.metadata.model)) {
                console.log('⚠️ Skipping signature verification for model:', generation.metadata.model);
                skipSignatureVerification = true;
            }
        }

        // Verify signature (unless we're skipping for problematic models)
        if (!skipSignatureVerification) {
            const isValidSignature = await verifyFalSignature(req.headers, rawBody);

            if (!isValidSignature) {
                console.error('❌ Invalid webhook signature');
                return new Response("Invalid signature", {
                    status: 403,
                    headers: corsHeaders
                });
            }

            console.log('✅ Webhook signature verified successfully');
        } else {
            console.log('⭐ Signature verification skipped for this model');
        }

        // Parse body (this is the original bodyText declaration)
        const bodyText = new TextDecoder().decode(rawBody);
        event = JSON.parse(bodyText);

        // Extract request ID
        const requestId = event.request_id || event.gateway_request_id;
        if (!requestId) {
            return new Response("Missing request_id", {
                status: 400,
                headers: corsHeaders
            });
        }

        // Deduplication check
        const webhookKey = `${requestId}-${event.status}`;
        const now = Date.now();
        
        if (processedWebhooks.has(webhookKey)) {
            const lastProcessed = processedWebhooks.get(webhookKey);
            if (now - lastProcessed < WEBHOOK_CACHE_DURATION) {
                console.log('🔄 Duplicate webhook detected, skipping:', webhookKey);
                return new Response(JSON.stringify({
                    success: true,
                    message: "Duplicate webhook ignored"
                }), {
                    status: 200,
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
        
        // Mark as processed
        processedWebhooks.set(webhookKey, now);
        
        // Clean up old entries
        for (const [key, timestamp] of processedWebhooks) {
            if (now - timestamp > WEBHOOK_CACHE_DURATION) {
                processedWebhooks.delete(key);
            }
        }

        // Find matching generation
        const { data: generation, error: findError } = await supabase
            .from('ai_generations')
            .select('id, user_id, metadata, status, tool_type')
            .eq('metadata->>fal_request_id', requestId)
            .eq('status', 'processing')
            .maybeSingle();

        if (findError || !generation) {
            return new Response("Generation not found", {
                status: 404,
                headers: corsHeaders
            });
        }

        // Enhanced logging for all webhook responses
        logWebhookResponse(event, generation);

        // Handle successful completion
        if (event.status === "OK" || event.status === "COMPLETED" || event.status === "SUCCESS") {
            // Extract output URL based on the structure we discovered
            let outputUrl;
            let thumbnailUrl = null;

            if (event.payload?.video?.url) {
                outputUrl = event.payload.video.url;
                // Extract thumbnail for video generations
                thumbnailUrl = event.payload?.video?.preview?.url ||
                    event.payload?.video?.thumbnail?.url ||
                    event.payload?.preview?.url ||
                    event.payload?.thumbnail?.url ||
                    event.payload?.first_frame?.url;
            } else if (typeof event.payload?.video === 'string') {
                outputUrl = event.payload.video;
                // Check for thumbnail in other payload locations
                thumbnailUrl = event.payload?.preview?.url ||
                    event.payload?.thumbnail?.url ||
                    event.payload?.first_frame?.url;
            } else if (event.payload?.url) {
                outputUrl = event.payload.url;
                // Check for thumbnail alongside main URL
                thumbnailUrl = event.payload?.preview?.url ||
                    event.payload?.thumbnail?.url ||
                    event.payload?.first_frame?.url;
            } else if (event.payload?.images && Array.isArray(event.payload.images)) {
                // Handle multiple images from models like flux-kontext-lora
                outputUrl = event.payload.images[0]?.url || event.payload.images[0];
            } else if (event.payload?.image?.url) {
                outputUrl = event.payload.image.url;
            } else if (typeof event.payload?.image === 'string') {
                outputUrl = event.payload.image;
            }

            if (!outputUrl) {
                await supabase
                    .from('ai_generations')
                    .update({
                        status: 'failed',
                        error_message: 'No output URL in webhook',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', generation.id);

                return new Response("No output URL", {
                    status: 400,
                    headers: corsHeaders
                });
            }

            let finalOutputUrl = outputUrl;
            let finalOutputUrls = [];
            let finalThumbnailUrl = null;

            // Handle multiple outputs if present
            if (event.payload?.images && Array.isArray(event.payload.images)) {
                // Multiple images case
                for (let i = 0; i < event.payload.images.length; i++) {
                    const imgUrl = event.payload.images[i]?.url || event.payload.images[i];
                    if (imgUrl) {
                        try {
                            const response = await fetch(imgUrl);
                            if (response.ok) {
                                const fileData = await response.arrayBuffer();
                                const toolFolder = generation.tool_type || generation.metadata?.tool_type || 'fal-generation';
                                const timestamp = Date.now();
                                const fileExtension = generation.metadata?.output_format === 'jpeg' ? 'jpg' : 'png';
                                const contentType = generation.metadata?.output_format === 'jpeg' ? 'image/jpeg' : 'image/png';
                                const filePath = `${generation.user_id}/${toolFolder}/${timestamp}_${i}.${fileExtension}`;

                                const { error: uploadError } = await supabase.storage
                                    .from('user-files')
                                    .upload(filePath, fileData, {
                                        contentType: contentType,
                                        upsert: true
                                    });

                                if (!uploadError) {
                                    const { data: { publicUrl } } = supabase.storage
                                        .from('user-files')
                                        .getPublicUrl(filePath);

                                    finalOutputUrls.push(publicUrl);
                                    if (i === 0) finalOutputUrl = publicUrl;
                                } else {
                                    finalOutputUrls.push(imgUrl);
                                    if (i === 0) finalOutputUrl = imgUrl;
                                }
                            }
                        } catch (e) {
                            console.warn(`Failed to store image ${i}:`, e);
                            finalOutputUrls.push(imgUrl);
                            if (i === 0) finalOutputUrl = imgUrl;
                        }
                    }
                }
            } else {
                // Single output case
                try {
                    console.log('📥 Downloading file for permanent storage...');
                    const response = await fetch(outputUrl);

                    if (!response.ok) {
                        throw new Error(`Failed to download file: ${response.status}`);
                    }

                    const fileData = await response.arrayBuffer();

                    // Use the tool_type from the generation record directly
                    const toolFolder = generation.tool_type || generation.metadata?.tool_type || 'fal-generation';

                    // Determine file extension and content type based on the output
                    let fileExtension = 'mp4'; // Default to video
                    let contentType = event.payload?.video?.content_type || 'video/mp4';

                    // Check if it's an image based on the payload or tool type
                    if (event.payload?.image ||
                        generation.tool_type?.toLowerCase().includes('image') ||
                        generation.tool_type?.toLowerCase().includes('flux') ||
                        generation.tool_type?.toLowerCase().includes('bria') ||
                        generation.tool_type?.toLowerCase().includes('hidream')) {
                        fileExtension = generation.metadata?.output_format === 'jpeg' ? 'jpg' : 'png';
                        contentType = generation.metadata?.output_format === 'jpeg' ? 'image/jpeg' : 'image/png';
                    }
                    // Check if it's audio
                    else if (event.payload?.audio ||
                        generation.tool_type?.toLowerCase().includes('audio') ||
                        generation.tool_type?.toLowerCase().includes('music') ||
                        generation.tool_type?.toLowerCase().includes('sound')) {
                        fileExtension = 'mp3';
                        contentType = event.payload?.audio?.content_type || 'audio/mpeg';
                    }
                    // If payload has video, it's video
                    else if (event.payload?.video) {
                        fileExtension = 'mp4';
                        contentType = event.payload?.video?.content_type || 'video/mp4';
                    }

                    // Create file path: user_id/tool_type/timestamp.extension
                    const timestamp = Date.now();
                    const filePath = `${generation.user_id}/${toolFolder}/${timestamp}.${fileExtension}`;

                    console.log('📁 Storing file at:', filePath);
                    console.log('🔧 Tool type:', generation.tool_type);
                    console.log('📄 File type:', fileExtension);

                    // Upload to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from('user-files')
                        .upload(filePath, fileData, {
                            contentType: contentType,
                            upsert: true
                        });

                    if (uploadError) {
                        throw uploadError;
                    }

                    // Get public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('user-files')
                        .getPublicUrl(filePath);

                    finalOutputUrl = publicUrl;
                    console.log('✅ File stored permanently:', publicUrl);

                } catch (storageError) {
                    console.warn('⚠️ Storage failed, using original FAL URL:', storageError);
                    // Continue with original URL if storage fails
                }

                // Store thumbnail if available from FAL.ai
                if (thumbnailUrl) {
                    try {
                        console.log('📸 Downloading thumbnail for permanent storage...');
                        const thumbnailResponse = await fetch(thumbnailUrl);

                        if (thumbnailResponse.ok) {
                            const thumbnailData = await thumbnailResponse.arrayBuffer();
                            const toolFolder = generation.tool_type || generation.metadata?.tool_type || 'fal-generation';
                            const timestamp = Date.now();
                            const thumbnailPath = `${generation.user_id}/${toolFolder}/${timestamp}_thumbnail.jpg`;

                            console.log('📁 Storing thumbnail at:', thumbnailPath);

                            const { error: thumbnailUploadError } = await supabase.storage
                                .from('user-files')
                                .upload(thumbnailPath, thumbnailData, {
                                    contentType: 'image/jpeg',
                                    upsert: true
                                });

                            if (!thumbnailUploadError) {
                                const { data: { publicUrl: thumbnailPublicUrl } } = supabase.storage
                                    .from('user-files')
                                    .getPublicUrl(thumbnailPath);

                                finalThumbnailUrl = thumbnailPublicUrl;
                                console.log('✅ Thumbnail stored permanently:', thumbnailPublicUrl);
                            } else {
                                console.error('❌ Failed to upload thumbnail:', thumbnailUploadError);
                                finalThumbnailUrl = thumbnailUrl; // Keep original URL if upload fails
                            }
                        } else {
                            console.warn('⚠️ Failed to download thumbnail:', thumbnailResponse.status);
                            finalThumbnailUrl = thumbnailUrl; // Keep original URL
                        }
                    } catch (thumbnailError) {
                        console.warn('⚠️ Thumbnail storage failed, using original URL:', thumbnailError);
                        finalThumbnailUrl = thumbnailUrl;
                    }
                }
            }

            // Update as completed with thumbnail URL if available
            await supabase
                .from('ai_generations')
                .update({
                    status: 'completed',
                    output_file_url: finalOutputUrls.length > 1 ? JSON.stringify(finalOutputUrls) : finalOutputUrl,
                    thumbnail_url: finalThumbnailUrl, // Store in dedicated column if FAL provided it
                    completed_at: new Date().toISOString(),
                    metadata: {
                        ...generation.metadata,
                        webhook_received: true,
                        completed_via_webhook: true,
                        file_size: event.payload?.video?.file_size,
                        content_type: event.payload?.video?.content_type,
                        seed: event.payload?.seed,
                        original_fal_url: outputUrl,
                        permanent_storage_url: finalOutputUrl !== outputUrl ? finalOutputUrl : null,
                        all_urls: finalOutputUrls.length > 1 ? finalOutputUrls : undefined,
                        thumbnail_url: finalThumbnailUrl,
                        original_thumbnail_url: thumbnailUrl
                    }
                })
                .eq('id', generation.id);

            console.log('✅ Generation completed:', generation.id);

            // UPDATED: Only trigger FFmpeg processing for VIDEO generations
            if (ENABLE_FFMPEG_PROCESSING && FFMPEG_SERVICE_URL) {
                try {
                    // Check if this is a video generation before calling FFmpeg
                    const isVideo = isVideoGeneration(generation.tool_type, finalOutputUrl);
                    const isImage = isImageGeneration(generation.tool_type, finalOutputUrl);

                    if (isVideo) {
                        console.log('🎬 Video generation detected, proceeding with FFmpeg processing');

                        // ENHANCED PROFILE DEBUGGING
                        console.log('🔍 STARTING PROFILE LOOKUP:', {
                            looking_for_user_id: generation.user_id,
                            user_id_type: typeof generation.user_id,
                            user_id_length: generation.user_id?.length
                        });

                        const { data: userProfile, error: profileError } = await supabase
                            .from('profiles')
                            .select('subscription_tier, subscription_status, id, email')
                            .eq('id', generation.user_id)
                            .single();

                        console.log('🔍 PROFILE QUERY RESULT:', {
                            profile_found: !!userProfile,
                            profile_error: profileError,
                            error_code: profileError?.code,
                            error_message: profileError?.message,
                            raw_profile_data: userProfile
                        });

                        // If no profile found, let's check if user exists at all
                        if (!userProfile || profileError) {
                            console.log('❌ Profile not found, checking if user exists in profiles table...');
                            
                            const { data: allProfileIds, error: listError } = await supabase
                                .from('profiles')
                                .select('id, email, subscription_tier')
                                .limit(10);
                                
                            console.log('📋 Sample profiles in database:', {
                                count: allProfileIds?.length,
                                sample_profiles: allProfileIds,
                                list_error: listError
                            });
                            
                            // Check if the user_id format matches what's in the database
                            const { data: exactMatch, error: exactError } = await supabase
                                .from('profiles')
                                .select('*')
                                .eq('id', generation.user_id);
                                
                            console.log('🎯 Exact ID match check:', {
                                exact_match_found: !!exactMatch?.length,
                                exact_match_data: exactMatch,
                                exact_error: exactError
                            });
                        }

                        // Continue with your existing tier logic but with more detailed logging
                        if (userProfile) {
                            console.log('✅ PROFILE FOUND - DETAILED ANALYSIS:', {
                                profile_id: userProfile.id,
                                email: userProfile.email,
                                subscription_tier: userProfile.subscription_tier,
                                subscription_tier_type: typeof userProfile.subscription_tier,
                                subscription_status: userProfile.subscription_status,
                                raw_object: JSON.stringify(userProfile, null, 2)
                            });
                        } else {
                            console.log('❌ NO PROFILE FOUND FOR USER:', generation.user_id);
                        }

                        console.log('🔍 USER TIER DEBUGGING:', {
                            generation_user_id: generation.user_id,
                            profile_found: !!userProfile,
                            profile_error: profileError,
                            full_profile: userProfile,
                            subscription_tier: userProfile?.subscription_tier,
                            subscription_status: userProfile?.subscription_status,
                            user_email: userProfile?.email
                        });

                        // FIXED: Use the correct field that exists
                        const userTier = userProfile?.subscription_tier ||
                            userProfile?.subscription_status ||
                            'free';

                        // FIXED: Check for your actual pro tier value
                        const isFreeTier = !userProfile || 
                            !userProfile.subscription_tier || 
                            userProfile.subscription_tier.toLowerCase() === 'free';

                        console.log('🎯 TIER DECISION:', {
                            detected_tier: userTier,
                            subscription_tier_value: userProfile?.subscription_tier,
                            is_free_tier: isFreeTier,
                            should_watermark: isFreeTier
                        });

                        // Process video with FFmpeg (frame extraction + conditional watermarking)
                        await processVideoWithFFmpeg(generation, finalOutputUrl, userProfile);
                    } else if (isImage) {
                        console.log('📷 Image generation detected, skipping FFmpeg processing');
                        console.log('📷 Tool type:', generation.tool_type);
                        console.log('📷 File URL:', finalOutputUrl);
                    } else {
                        console.log('❓ Unknown generation type, skipping FFmpeg processing');
                        console.log('❓ Tool type:', generation.tool_type);
                        console.log('❓ File URL:', finalOutputUrl);
                    }
                } catch (ffmpegError) {
                    console.error('FFmpeg processing error:', ffmpegError);
                    // Don't fail the webhook, just log the error
                }
            }

            return new Response(JSON.stringify({
                success: true,
                message: "Generation completed",
                generation_id: generation.id
            }), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } else if (event.status === "FAILED" || event.status === "ERROR" || event.status === "CANCELLED") {
            const errorAnalysis = handleWebhookError(event, generation);

            console.log('🚨 Processing webhook failure:', {
                generationId: generation.id,
                status: event.status,
                errorType: errorAnalysis.errorType,
                errorCode: errorAnalysis.errorCode
            });

            // Create user-friendly error message based on error type
            let userFriendlyMessage = errorAnalysis.errorMessage;

            if (errorAnalysis.contentViolation) {
                userFriendlyMessage = `Content Policy Violation: Your input was flagged by our content safety system. Please ensure your prompts and images comply with our content policy.`;
            } else if (errorAnalysis.serverError) {
                userFriendlyMessage = `Server Error: The AI service is temporarily experiencing issues. Please try again in a few minutes.`;
            } else if (errorAnalysis.badRequest) {
                userFriendlyMessage = `Invalid Request: There was an issue with your input. Please check your image and prompt, then try again.`;
            }

            await supabase
                .from('ai_generations')
                .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: userFriendlyMessage,
                    metadata: {
                        ...generation.metadata,
                        webhook_received: true,
                        webhook_status: event.status,
                        webhook_error: event.error,
                        error_analysis: {
                            error_code: errorAnalysis.errorCode,
                            error_type: errorAnalysis.errorType,
                            content_violation: errorAnalysis.contentViolation,
                            server_error: errorAnalysis.serverError,
                            bad_request: errorAnalysis.badRequest,
                            raw_error: errorAnalysis.errorMessage,
                            full_event: event,
                            analyzed_at: new Date().toISOString()
                        }
                    }
                })
                .eq('id', generation.id);

            console.log(`✅ Generation ${generation.id} marked as failed with type: ${errorAnalysis.errorType}`);

            return new Response(JSON.stringify({
                success: true,
                message: "Failure processed",
                generation_id: generation.id,
                error_type: errorAnalysis.errorType,
                error_code: errorAnalysis.errorCode
            }), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Handle other statuses (queued, processing, etc)
        await supabase
            .from('ai_generations')
            .update({
                metadata: {
                    ...generation.metadata,
                    last_webhook_status: event.status,
                    last_webhook_update: new Date().toISOString()
                }
            })
            .eq('id', generation.id);

        return new Response(JSON.stringify({
            success: true,
            message: "Status update received",
            status: event.status
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        console.error('💥 Webhook error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});