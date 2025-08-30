// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

// ───────────────────────────────────────────────────────────────────────────────
// Env + constants
// ───────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const JWKS_URL = "https://rest.alpha.fal.ai/.well-known/jwks.json";

const FFMPEG_SERVICE_URL = Deno.env.get("FFMPEG_SERVICE_URL") ?? "";
const ENABLE_FFMPEG_PROCESSING = Deno.env.get("ENABLE_FFMPEG_PROCESSING") === "true";
const USE_EDGE_FUNCTION_ENDPOINTS = Deno.env.get("USE_EDGE_FUNCTION_ENDPOINTS") === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-fal-webhook-request-id, x-fal-webhook-user-id, x-fal-webhook-timestamp, x-fal-webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

console.log("🔧 FFmpeg Configuration:", {
  serviceUrl: FFMPEG_SERVICE_URL ? "Configured" : "Not configured",
  enabled: ENABLE_FFMPEG_PROCESSING,
  useEdgeFunctionEndpoints: USE_EDGE_FUNCTION_ENDPOINTS,
});

// One global Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Simple deduplication cache to prevent double processing
const processedWebhooks = new Map<string, number>();
const WEBHOOK_CACHE_DURATION = 60 * 1000; // 1 minute

// JWKS cache
let _jwks_cache: any[] | null = null;
let _jwks_cache_time = 0;
const JWKS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h

// ───────────────────────────────────────────────────────────────────────────────
// Helpers: media type, watermark policy, JWKS + signature
// ───────────────────────────────────────────────────────────────────────────────
function isVideoGeneration(toolType?: string, outputUrl?: string): boolean {
  const toolTypeLower = toolType?.toLowerCase() ?? "";
  const videoToolPatterns = [
    "text2video",
    "image2video",
    "wan",
    "animatediff",
    "haiper",
    "mochi",
    "minimax",
    "cogvideox",
    "ltx",
    "runway",
    "luma",
    "kling",
    "qwen",
    "video",
  ];
  const isVideoByTool = videoToolPatterns.some((p) => toolTypeLower.includes(p));
  const isVideoByUrl = !!outputUrl?.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv)$/);
  return isVideoByTool || isVideoByUrl;
}

function isImageGeneration(toolType?: string, outputUrl?: string): boolean {
  const toolTypeLower = toolType?.toLowerCase() ?? "";
  const imageToolPatterns = [
    "flux",
    "bria",
    "hidream",
    "stable-diffusion",
    "sdxl",
    "image",
    "txt2img",
    "gemini",
    "qwen",
    "img2img",
  ];
  const isImageByTool = imageToolPatterns.some((p) => toolTypeLower.includes(p));
  const isImageByUrl = !!outputUrl?.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp)$/);
  return isImageByTool || isImageByUrl;
}

async function fetchJwks() {
  const now = Date.now();
  if (_jwks_cache && now - _jwks_cache_time < JWKS_CACHE_DURATION) return _jwks_cache;
  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new Error(`Failed to fetch JWKS: ${response.status}`);
  const jwks = await response.json();
  _jwks_cache = jwks.keys;
  _jwks_cache_time = now;
  return _jwks_cache!;
}

function base64UrlDecode(str: string) {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

async function verifyFalSignature(headers: Headers, body: Uint8Array) {
  const requestId = headers.get("x-fal-webhook-request-id");
  const userId = headers.get("x-fal-webhook-user-id");
  const timestamp = headers.get("x-fal-webhook-timestamp");
  const signatureHex = headers.get("x-fal-webhook-signature");
  if (!requestId || !userId || !timestamp || !signatureHex) return false;

  const now = Math.floor(Date.now() / 1000);
  const webhookTimestamp = parseInt(timestamp);
  if (isNaN(webhookTimestamp) || Math.abs(now - webhookTimestamp) > 300) return false;

  const bodyHash = await crypto.subtle.digest("SHA-256", body);
  const bodyHashArray = new Uint8Array(bodyHash);
  const bodyHashHex = Array.from(bodyHashArray).map((b) => b.toString(16).padStart(2, "0")).join("");

  const messageToVerify = [requestId, userId, timestamp, bodyHashHex].join("\n");

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = hexToBytes(signatureHex);
  } catch {
    return false;
  }

  let publicKeys: any[];
  try {
    publicKeys = await fetchJwks();
  } catch {
    return false;
  }

  for (const key of publicKeys) {
    try {
      if (key.kty !== "OKP" || key.crv !== "Ed25519" || !key.x) continue;
      const publicKeyBytes = base64UrlDecode(key.x);
      const messageBytes = new TextEncoder().encode(messageToVerify);
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
      if (isValid) return true;
    } catch {
      // try next key
    }
  }
  return false;
}

// ───────────────────────────────────────────────────────────────────────────────
// FFmpeg service caller + video processing
// ───────────────────────────────────────────────────────────────────────────────
async function callFFmpegService(endpoint: string, data: any) {
  if (!FFMPEG_SERVICE_URL || !ENABLE_FFMPEG_PROCESSING) {
    console.log("🔇 FFmpeg processing disabled or not configured");
    return null;
  }
  try {
    let finalEndpoint = endpoint;
    if (USE_EDGE_FUNCTION_ENDPOINTS) finalEndpoint = endpoint.replace("/api/v1/", "/");

    console.log(`📡 Calling FFmpeg service: ${FFMPEG_SERVICE_URL}${finalEndpoint}`);
    const response = await fetch(`${FFMPEG_SERVICE_URL}${finalEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FFmpeg service error: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to call FFmpeg service ${endpoint}:`, error);
    return null;
  }
}

async function processVideoWithFFmpeg(generation: any, videoUrl: string, userProfile: any) {
  if (!FFMPEG_SERVICE_URL || !ENABLE_FFMPEG_PROCESSING) {
    console.log("🔇 FFmpeg processing disabled or not configured");
    return;
  }
  if (!isVideoGeneration(generation.tool_type, videoUrl)) {
    console.log(`📷 Skipping FFmpeg for non-video generation: ${generation.tool_type}`);
    return;
  }

  const tasks: Promise<any>[] = [];

  const userTier =
    userProfile?.subscription_tier || userProfile?.subscription_status || "free";
  const isFreeTier =
    !userProfile ||
    !userProfile.subscription_tier ||
    userProfile.subscription_tier.toLowerCase() === "free" ||
    userProfile.subscription_tier.toLowerCase() === "trial";

  console.log("🎬 Starting FFmpeg processing for VIDEO:", {
    generationId: generation.id,
    toolType: generation.tool_type,
    userTier,
    isVideo: true,
    isFreeTier,
  });

  const hasFalThumbnail =
    generation?.metadata?.thumbnail_url ||
    generation?.metadata?.original_thumbnail_url ||
    generation?.thumbnail_url;

  if (!hasFalThumbnail) {
    console.log("📸 No FAL thumbnail found, extracting with FFmpeg...");
    tasks.push(
      callFFmpegService("/api/v1/extract-thumbnail", {
        generation_id: generation.id,
        video_url: videoUrl,
        user_id: generation.user_id,
        timestamp: 2.0,
        width: 1280,
        height: 720,
        webhook_url: `${SUPABASE_URL}/functions/v1/ffmpeg-webhook`,
      }),
    );
  } else {
    console.log("✅ Using existing thumbnail from FAL.ai, skipping extraction");
  }

  if (isFreeTier) {
    console.log("💧 FREE tier → add watermark");
    tasks.push(
      callFFmpegService("/api/v1/add-watermark", {
        generation_id: generation.id,
        video_url: videoUrl,
        user_id: generation.user_id,
        position: "bottom-center",
        opacity: 0.95,
        scale: 1.2,
        webhook_url: `${SUPABASE_URL}/functions/v1/ffmpeg-webhook`,
      }),
    );
  } else {
    console.log("💎 PAID tier → skip watermark");
  }

  if (tasks.length > 0) {
    const results = await Promise.allSettled(tasks);
    console.log("✅ FFmpeg tasks initiated:", {
      total: results.length,
      successful: results.filter((r) => r.status === "fulfilled" && (r as any).value).length,
    });

    await supabase
      .from("ai_generations")
      .update({
        metadata: {
          ...(generation.metadata ?? {}),
          ffmpeg_processing_initiated: true,
          ffmpeg_tasks_count: results.length,
          watermark_required: isFreeTier,
          user_tier: userTier,
          media_type: "video",
        },
      })
      .eq("id", generation.id);
  } else {
    console.log("ℹ️ No FFmpeg tasks needed for this video");
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Logging + error analysis for FAL webhook
// ───────────────────────────────────────────────────────────────────────────────
function logWebhookResponse(event: any, generation: any) {
  console.log("📊 === FAL.AI WEBHOOK RESPONSE ANALYSIS ===");
  console.log("🔍 Event Status:", event.status);
  console.log("🔍 Generation ID:", generation?.id);
  console.log("🔍 Tool Type:", generation?.tool_type);
  console.log("📋 Event:", JSON.stringify(event, null, 2));
  console.log("📊 === END WEBHOOK ANALYSIS ===");
}

function handleWebhookError(event: any, _generation: any) {
  let errorMessage = "Generation failed";
  let errorCode: number | null = null;
  let contentViolation = false;
  let serverError = false;
  let badRequest = false;

  const errorSources = [event.error, event.payload?.error, event.response?.error, event.data?.error];

  for (const source of errorSources) {
    if (!source) continue;
    if (typeof source === "string") {
      errorMessage = source;
    } else if (source.message) {
      errorMessage = source.message;
    } else if (source.detail) {
      errorMessage = typeof source.detail === "string" ? source.detail : JSON.stringify(source.detail);
    } else if (source.error) {
      errorMessage = source.error;
    }
    if (source.status_code) errorCode = source.status_code;
    else if (source.code) errorCode = source.code;
    else if (source.status) errorCode = source.status;
    break;
  }

  if (!errorCode && event.status_code) errorCode = event.status_code;
  if (!errorCode && event.http_status) errorCode = event.http_status;

  const numericCode = typeof errorCode === "string" ? parseInt(errorCode) : errorCode;

  if (numericCode === 422) {
    contentViolation = true;
    if (errorMessage === "Generation failed") {
      errorMessage = "Content policy violation: The input contains inappropriate content";
    }
  } else if (numericCode === 500) {
    serverError = true;
    if (errorMessage === "Generation failed") {
      errorMessage = "Server error: FAL.ai service temporarily unavailable";
    }
  } else if (numericCode === 400) {
    badRequest = true;
    if (errorMessage === "Generation failed") {
      errorMessage = "Invalid request: Please check your input parameters";
    }
  }

  const violationKeywords = ["policy", "violation", "inappropriate", "nsfw", "content", "unsafe", "prohibited", "not allowed", "rejected"];
  if (!contentViolation && violationKeywords.some((k) => errorMessage.toLowerCase().includes(k))) {
    contentViolation = true;
  }

  return {
    errorMessage,
    errorCode: numericCode ?? null,
    contentViolation,
    serverError,
    badRequest,
    errorType: contentViolation ? "content_violation" : serverError ? "server_error" : badRequest ? "bad_request" : "unknown_error",
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// FFmpeg webhook handler (Railway → this function)
// ───────────────────────────────────────────────────────────────────────────────
async function handleFFmpegWebhook(req: Request): Promise<Response> {
  try {
    const requestBody = await req.text();
    console.log("🎬 FFmpeg webhook payload:", requestBody);

    let webhookData: any;
    try {
      webhookData = JSON.parse(requestBody);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON", bodyReceived: requestBody }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      generation_id,
      processing_id,
      status,
      // timestamp,
      thumbnail_url,
      watermarked_url,
      // result,
      error: error_message,
    } = webhookData;

    console.log("🎬 FFmpeg webhook received:", {
      generation_id,
      processing_id,
      status,
      has_thumbnail_url: !!thumbnail_url,
      has_watermarked_url: !!watermarked_url,
    });

    if (!generation_id) throw new Error("Generation ID is required");

    const { data: generation, error: fetchError } = await supabase
      .from("ai_generations")
      .select("id, user_id, metadata, tool_type, output_file_url")
      .eq("id", generation_id)
      .single();

    if (fetchError || !generation) {
      console.error("❌ Error fetching generation:", fetchError);
      throw new Error("Generation not found");
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    if (status === "completed" && thumbnail_url) {
      updateData.thumbnail_url = thumbnail_url;
      updateData.metadata = {
        ...(generation.metadata ?? {}),
        thumbnail_processing: {
          status: "completed",
          thumbnail_url,
          completed_at: new Date().toISOString(),
          processing_id,
        },
      };
      console.log("✅ Thumbnail processing completed:", thumbnail_url);
    }

    if (status === "completed" && watermarked_url) {
      updateData.output_file_url = watermarked_url;
      updateData.metadata = {
        ...(generation.metadata ?? {}),
        watermark_processing: {
          status: "completed",
          watermarked_url,
          original_url: generation.output_file_url,
          completed_at: new Date().toISOString(),
          processing_id,
          watermarked: true,
        },
      };
      console.log("✅ Watermark processing completed:", watermarked_url);
    }

    if (status === "failed") {
      updateData.metadata = {
        ...(generation.metadata ?? {}),
        ffmpeg_processing: {
          status: "failed",
          error_message,
          failed_at: new Date().toISOString(),
          processing_id,
        },
      };
      console.log("❌ FFmpeg processing failed:", error_message);
    }

    const { error: updateError } = await supabase.from("ai_generations").update(updateData).eq("id", generation_id);
    if (updateError) {
      console.error("❌ Error updating generation:", updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("💥 FFmpeg webhook error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Main HTTP entry
// ───────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  // Detect webhook type
  const falHeaders = {
    requestId: req.headers.get("x-fal-webhook-request-id"),
    userId: req.headers.get("x-fal-webhook-user-id"),
    timestamp: req.headers.get("x-fal-webhook-timestamp"),
    signature: req.headers.get("x-fal-webhook-signature"),
  };
  const hasFalHeaders = Object.values(falHeaders).every((h) => h !== null);
  const isFFmpegWebhook = !hasFalHeaders;

  console.log("🔍 Webhook type detection:", {
    hasFalHeaders,
    isFFmpegWebhook,
  });

  // FFmpeg callback (Railway → this function)
  if (isFFmpegWebhook) {
    console.log("🎬 Processing FFmpeg webhook callback");
    return await handleFFmpegWebhook(req);
  }

  // FAL webhook path
  let rawBody: Uint8Array;
  let event: any;

  try {
    rawBody = new Uint8Array(await req.arrayBuffer());

    // OPTIONAL: Skip signature for known-problem models
    let skipSignatureVerification = false;
    try {
      const tempEvent = JSON.parse(new TextDecoder().decode(rawBody));
      const tempRequestId = tempEvent?.request_id || tempEvent?.gateway_request_id;
      if (tempRequestId) {
        const { data: generation } = await supabase
          .from("ai_generations")
          .select("metadata")
          .eq("metadata->>fal_request_id", tempRequestId)
          .maybeSingle();

        const modelsWithSignatureIssues = [
          "fal-ai/flux-kontext-lora/text-to-image",
          "fal-ai/flux-kontext/dev",
        ];
        if (generation?.metadata?.model && modelsWithSignatureIssues.includes(generation.metadata.model)) {
          console.log("⚠️ Skipping signature verification for model:", generation.metadata.model);
          skipSignatureVerification = true;
        }
      }
    } catch {
      // ignore
    }

    if (!skipSignatureVerification) {
      const isValidSignature = await verifyFalSignature(req.headers, rawBody);
      if (!isValidSignature) {
        console.error("❌ Invalid webhook signature");
        return new Response("Invalid signature", { status: 403, headers: corsHeaders });
      }
      console.log("✅ Webhook signature verified successfully");
    } else {
      console.log("⭐ Signature verification skipped for this model");
    }

    event = JSON.parse(new TextDecoder().decode(rawBody));

    const requestId = event.request_id || event.gateway_request_id;
    if (!requestId) {
      return new Response("Missing request_id", { status: 400, headers: corsHeaders });
    }

    const webhookKey = `${requestId}-${event.status}`;
    const now = Date.now();
    const lastProcessed = processedWebhooks.get(webhookKey);
    if (lastProcessed && now - lastProcessed < WEBHOOK_CACHE_DURATION) {
      console.log("🔄 Duplicate webhook detected, skipping:", webhookKey);
      return new Response(JSON.stringify({ success: true, message: "Duplicate webhook ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    processedWebhooks.set(webhookKey, now);
    for (const [key, ts] of processedWebhooks) {
      if (now - ts > WEBHOOK_CACHE_DURATION) processedWebhooks.delete(key);
    }

    const { data: generation, error: findError } = await supabase
      .from("ai_generations")
      .select("id, user_id, metadata, status, tool_type")
      .eq("metadata->>fal_request_id", requestId)
      .eq("status", "processing")
      .maybeSingle();

    if (findError || !generation) {
      return new Response("Generation not found", { status: 404, headers: corsHeaders });
    }

    logWebhookResponse(event, generation);

    // ── SUCCESS
    if (["OK", "COMPLETED", "SUCCESS"].includes(event.status)) {
      let outputUrl: string | undefined;
      let thumbnailUrl: string | null = null;

      if (event.payload?.video?.url) {
        outputUrl = event.payload.video.url;
        thumbnailUrl =
          event.payload?.video?.preview?.url ||
          event.payload?.video?.thumbnail?.url ||
          event.payload?.preview?.url ||
          event.payload?.thumbnail?.url ||
          event.payload?.first_frame?.url ||
          null;
      } else if (typeof event.payload?.video === "string") {
        outputUrl = event.payload.video;
        thumbnailUrl =
          event.payload?.preview?.url ||
          event.payload?.thumbnail?.url ||
          event.payload?.first_frame?.url ||
          null;
      } else if (event.payload?.url) {
        outputUrl = event.payload.url;
        thumbnailUrl =
          event.payload?.preview?.url ||
          event.payload?.thumbnail?.url ||
          event.payload?.first_frame?.url ||
          null;
      } else if (event.payload?.images && Array.isArray(event.payload.images)) {
        outputUrl = event.payload.images[0]?.url || event.payload.images[0];
      } else if (event.payload?.image?.url) {
        outputUrl = event.payload.image.url;
      } else if (typeof event.payload?.image === "string") {
        outputUrl = event.payload.image;
      }

      if (!outputUrl) {
        await supabase
          .from("ai_generations")
          .update({
            status: "failed",
            error_message: "No output URL in webhook",
            completed_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        return new Response("No output URL", { status: 400, headers: corsHeaders });
      }

      let finalOutputUrl = outputUrl;
      const finalOutputUrls: string[] = [];
      let finalThumbnailUrl: string | null = null;

      if (event.payload?.images && Array.isArray(event.payload.images)) {
        for (let i = 0; i < event.payload.images.length; i++) {
          const imgUrl = event.payload.images[i]?.url || event.payload.images[i];
          if (!imgUrl) continue;
          try {
            const response = await fetch(imgUrl);
            if (!response.ok) throw new Error(String(response.status));
            const fileData = await response.arrayBuffer();

            const toolFolder = generation.tool_type || generation.metadata?.tool_type || "fal-generation";
            const timestamp = Date.now();
            const fileExtension = generation.metadata?.output_format === "jpeg" ? "jpg" : "png";
            const contentType = generation.metadata?.output_format === "jpeg" ? "image/jpeg" : "image/png";
            const filePath = `${generation.user_id}/${toolFolder}/${timestamp}_${i}.${fileExtension}`;

            const { error: uploadError } = await supabase
              .storage.from("user-files")
              .upload(filePath, fileData, { contentType, upsert: true });

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from("user-files").getPublicUrl(filePath);
              finalOutputUrls.push(publicUrl);
              if (i === 0) finalOutputUrl = publicUrl;
            } else {
              finalOutputUrls.push(imgUrl);
              if (i === 0) finalOutputUrl = imgUrl;
            }
          } catch (e) {
            console.warn(`Failed to store image ${i}:`, e);
            finalOutputUrls.push(imgUrl);
            if (i === 0) finalOutputUrl = imgUrl;
          }
        }
      } else {
        try {
          console.log("📥 Downloading file for permanent storage...");
          const response = await fetch(outputUrl);
          if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
          const fileData = await response.arrayBuffer();

          const toolFolder = generation.tool_type || generation.metadata?.tool_type || "fal-generation";
          let fileExtension = "mp4";
          let contentType = event.payload?.video?.content_type || "video/mp4";

          if (
            event.payload?.image ||
            generation.tool_type?.toLowerCase().includes("image") ||
            generation.tool_type?.toLowerCase().includes("flux") ||
            generation.tool_type?.toLowerCase().includes("bria") ||
            generation.tool_type?.toLowerCase().includes("hidream")
          ) {
            fileExtension = generation.metadata?.output_format === "jpeg" ? "jpg" : "png";
            contentType = generation.metadata?.output_format === "jpeg" ? "image/jpeg" : "image/png";
          } else if (
            event.payload?.audio ||
            generation.tool_type?.toLowerCase().includes("audio") ||
            generation.tool_type?.toLowerCase().includes("music") ||
            generation.tool_type?.toLowerCase().includes("sound")
          ) {
            fileExtension = "mp3";
            contentType = event.payload?.audio?.content_type || "audio/mpeg";
          } else if (event.payload?.video) {
            fileExtension = "mp4";
            contentType = event.payload?.video?.content_type || "video/mp4";
          }

          const timestamp = Date.now();
          const filePath = `${generation.user_id}/${toolFolder}/${timestamp}.${fileExtension}`;

          console.log("📁 Storing file at:", filePath);
          const { error: uploadError } = await supabase
            .storage.from("user-files")
            .upload(filePath, fileData, { contentType, upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from("user-files").getPublicUrl(filePath);
          finalOutputUrl = publicUrl;
          console.log("✅ File stored permanently:", publicUrl);
        } catch (storageError) {
          console.warn("⚠️ Storage failed, using original FAL URL:", storageError);
        }

        if (thumbnailUrl) {
          try {
            console.log("📸 Downloading thumbnail for permanent storage...");
            const thumbnailResponse = await fetch(thumbnailUrl);
            if (thumbnailResponse.ok) {
              const thumbnailData = await thumbnailResponse.arrayBuffer();
              const toolFolder = generation.tool_type || generation.metadata?.tool_type || "fal-generation";
              const timestamp = Date.now();
              const thumbnailPath = `${generation.user_id}/${toolFolder}/${timestamp}_thumbnail.jpg`;

              const { error: thumbnailUploadError } = await supabase
                .storage.from("user-files")
                .upload(thumbnailPath, thumbnailData, { contentType: "image/jpeg", upsert: true });

              if (!thumbnailUploadError) {
                const { data: { publicUrl: thumbnailPublicUrl } } = supabase
                  .storage.from("user-files")
                  .getPublicUrl(thumbnailPath);
                finalThumbnailUrl = thumbnailPublicUrl;
                console.log("✅ Thumbnail stored permanently:", thumbnailPublicUrl);
              } else {
                console.error("❌ Failed to upload thumbnail:", thumbnailUploadError);
                finalThumbnailUrl = thumbnailUrl;
              }
            } else {
              console.warn("⚠️ Failed to download thumbnail:", thumbnailResponse.status);
              finalThumbnailUrl = thumbnailUrl;
            }
          } catch (thumbnailError) {
            console.warn("⚠️ Thumbnail storage failed, using original URL:", thumbnailError);
            finalThumbnailUrl = thumbnailUrl;
          }
        }
      }

      await supabase
        .from("ai_generations")
        .update({
          status: "completed",
          output_file_url: finalOutputUrls.length > 1 ? JSON.stringify(finalOutputUrls) : finalOutputUrl,
          thumbnail_url: finalThumbnailUrl,
          completed_at: new Date().toISOString(),
          metadata: {
            ...(generation.metadata ?? {}),
            webhook_received: true,
            completed_via_webhook: true,
            file_size: event.payload?.video?.file_size,
            content_type: event.payload?.video?.content_type,
            seed: event.payload?.seed,
            original_fal_url: outputUrl,
            permanent_storage_url: finalOutputUrl !== outputUrl ? finalOutputUrl : null,
            all_urls: finalOutputUrls.length > 1 ? finalOutputUrls : undefined,
            thumbnail_url: finalThumbnailUrl ?? undefined,
            original_thumbnail_url: thumbnailUrl ?? undefined,
          },
        })
        .eq("id", generation.id);

      console.log("✅ Generation completed:", generation.id);

      if (ENABLE_FFMPEG_PROCESSING && FFMPEG_SERVICE_URL) {
        try {
          const isVideo = isVideoGeneration(generation.tool_type, finalOutputUrl);
          const isImage = isImageGeneration(generation.tool_type, finalOutputUrl);

          if (isVideo) {
            const { data: userProfile, error: profileError } = await supabase
              .from("profiles")
              .select("subscription_tier, subscription_status, id, email")
              .eq("id", generation.user_id)
              .single();

            if (profileError) {
              console.log("ℹ️ Profile lookup error (continuing):", profileError.message);
            }

            await processVideoWithFFmpeg(generation, finalOutputUrl, userProfile);
          } else if (isImage) {
            console.log("📷 Image generation detected, skipping FFmpeg processing");
          } else {
            console.log("❓ Unknown generation type, skipping FFmpeg processing");
          }
        } catch (ffmpegError) {
          console.error("FFmpeg processing error:", ffmpegError);
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Generation completed", generation_id: generation.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── FAILURE
    if (["FAILED", "ERROR", "CANCELLED"].includes(event.status)) {
      const errorAnalysis = handleWebhookError(event, generation);

      await supabase
        .from("ai_generations")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorAnalysis.contentViolation
            ? "Content Policy Violation: Your input was flagged by our content safety system. Please ensure your prompts and images comply with our content policy."
            : errorAnalysis.serverError
            ? "Server Error: The AI service is temporarily experiencing issues. Please try again in a few minutes."
            : errorAnalysis.badRequest
            ? "Invalid Request: There was an issue with your input. Please check your image and prompt, then try again."
            : errorAnalysis.errorMessage,
          metadata: {
            ...(generation.metadata ?? {}),
            webhook_received: true,
            webhook_status: event.status,
            webhook_error: event.error ?? null,
            error_analysis: {
              error_code: errorAnalysis.errorCode,
              error_type: errorAnalysis.errorType,
              content_violation: errorAnalysis.contentViolation,
              server_error: errorAnalysis.serverError,
              bad_request: errorAnalysis.badRequest,
              raw_error: errorAnalysis.errorMessage,
              full_event: event,
              analyzed_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", generation.id);

      console.log(`✅ Generation ${generation.id} marked as failed with type: ${errorAnalysis.errorType}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Failure processed",
          generation_id: generation.id,
          error_type: errorAnalysis.errorType,
          error_code: errorAnalysis.errorCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── INTERMEDIATE
    await supabase
      .from("ai_generations")
      .update({
        metadata: {
          ...(generation.metadata ?? {}),
          last_webhook_status: event.status,
          last_webhook_update: new Date().toISOString(),
        },
      })
      .eq("id", generation.id);

    return new Response(JSON.stringify({ success: true, message: "Status update received", status: event.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("💥 Webhook error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
