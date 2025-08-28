import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseFalError, updateGenerationWithError } from '../_shared/fal-error-handler.ts';
import { shouldWatermark, addWatermarkMetadata } from '../_shared/watermark-utils.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let generationId;
    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Authenticate user
        const authHeader = req.headers.get('Authorization');
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);

        if (!user) {
            throw new Error('Unauthorized');
        }

        // Get user profile to check subscription status
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_tier, subscription_status')
            .eq('id', user.id)
            .single();

        const needsWatermark = shouldWatermark(profile);
        console.log('🎨 Watermark needed for user:', needsWatermark);

        // Parse request body
        const {
            generationId: reqGenerationId,
            imageUrl,
            prompt,
            numImages = 1,
            guidanceScale = 7.5,
            steps = 30,
            seed = -1,
            enableSafetyChecker = true,
            outputFormat = "jpeg",
            resolutionMode = "1:1",
            imageAnalysis,
            acceleration = "none"
        } = await req.json();

        generationId = reqGenerationId;

        console.log('🎨 FLUX Kontext generation request:', {
            generationId,
            hasImageUrl: !!imageUrl,
            prompt: prompt?.substring(0, 50) + '...',
            numImages,
            resolutionMode
        });

        // Validate required parameters
        if (!generationId) {
            throw new Error('Generation ID is required');
        }
        if (!imageUrl) {
            throw new Error('Image URL is required');
        }
        if (!prompt?.trim()) {
            throw new Error('Prompt is required');
        }

        // Update generation status to processing
        await supabase
            .from('ai_generations')
            .update({
                status: 'processing',
                updated_at: new Date().toISOString()
            })
            .eq('id', generationId)
            .eq('user_id', user.id);

        // Get FAL API key from environment
        const falApiKey = Deno.env.get('FAL_API_KEY');
        if (!falApiKey) {
            throw new Error('FAL_API_KEY not configured');
        }

        // Check if we should use polling (for models with unreliable webhooks)
        const USE_POLLING = Deno.env.get('FAL_FLUX_KONTEXT_USE_POLLING') !== 'false'; // Default to true

        // Prepare webhook URL even if we're polling (belt and suspenders)
        const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fal-webhook`;

        const falParams: any = {
            image_url: imageUrl,
            prompt: prompt,
            guidance_scale: Math.max(1.0, Math.min(20.0, guidanceScale)),
            num_images: Math.max(1, Math.min(4, numImages)),
            num_inference_steps: Math.max(10, Math.min(50, steps)),
            enable_safety_checker: enableSafetyChecker,
            output_format: outputFormat,
            resolution_mode: resolutionMode,
            acceleration: acceleration
        };

        // Add webhook URL (even if polling, as a fallback)
        if (!USE_POLLING || Deno.env.get('FAL_INCLUDE_WEBHOOK_ALWAYS') === 'true') {
            falParams.webhook_url = webhookUrl;
            falParams.webhook_events_filter = ["completed", "failed"];
            console.log('📡 Including webhook URL:', webhookUrl);
        }

        // Only add seed if it's a positive number
        if (seed && seed > 0) {
            falParams.seed = seed;
        }

        console.log('📡 Calling FAL.ai API with params:', JSON.stringify(falParams, null, 2));
        console.log('⚙️ Mode:', USE_POLLING ? 'POLLING' : 'WEBHOOK');

        // Call FAL.ai API
        const falResponse = await fetch('https://fal.run/fal-ai/flux-kontext/dev', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${falApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(falParams)
        });

        const responseBody = await falResponse.text();

        // Handle errors
        if (!falResponse.ok) {
            console.log('❌ FAL.ai submission error:', falResponse.status);
            const errorInfo = parseFalError(falResponse, responseBody);

            // Ensure we properly mark as failed with correct error type
            await supabase
                .from('ai_generations')
                .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: errorInfo.errorMessage,
                    metadata: {
                        ...falParams,
                        error_type: errorInfo.errorType,
                        error_code: errorInfo.statusCode,
                        error_details: errorInfo.errorDetails,
                        failed_at: new Date().toISOString(),
                        failed_during: 'submission'
                    }
                })
                .eq('id', generationId);

            console.log(`✅ Generation ${generationId} marked as failed (${errorInfo.errorType}) during submission`);

            // Return error response instead of throwing
            return new Response(JSON.stringify({
                success: false,
                error: errorInfo.errorMessage,
                generation_id: generationId,
                error_type: errorInfo.errorType
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                },
                status: 200 // Return 200 since we handled it gracefully
            });
        }

        // Parse successful response
        let submitResult;
        try {
            submitResult = JSON.parse(responseBody);
        } catch (parseError) {
            console.error('❌ Error parsing FAL.ai response JSON:', parseError);
            throw new Error(`Invalid JSON response from FAL.ai: ${responseBody}`);
        }

        console.log('📋 FAL.ai submission result:', JSON.stringify(submitResult, null, 2));

        // Check if we got immediate result or need to poll/wait
        let finalResult = submitResult;
        let requestId = submitResult.request_id || submitResult.gateway_request_id;

        // If we have a request_id and are using polling, poll for completion
        if (requestId && USE_POLLING) {
            console.log('🔄 Using POLLING mode for request_id:', requestId);

            // Update generation with request ID
            await supabase
                .from('ai_generations')
                .update({
                    metadata: {
                        fal_request_id: requestId,
                        processing_started: new Date().toISOString(),
                        status: 'polling_for_completion',
                        tool_type: 'flux-kontext',
                        needs_watermark: needsWatermark,
                        mode: 'polling',
                        ...addWatermarkMetadata({}, needsWatermark)
                    }
                })
                .eq('id', generationId);

            // Poll for completion (max 5 minutes)
            const maxAttempts = 30;
            let attempts = 0;
            let generationFailed = false;

            while (attempts < maxAttempts && !generationFailed) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                attempts++;

                console.log(`🔍 Polling attempt ${attempts}/${maxAttempts} for request ${requestId}`);

                try {
                    const statusResponse = await fetch(
                        `https://fal.run/fal-ai/flux-kontext/dev/requests/${requestId}/status`,
                        {
                            headers: {
                                'Authorization': `Key ${falApiKey}`
                            }
                        }
                    );

                    if (statusResponse.ok) {
                        const statusResult = await statusResponse.json();
                        console.log(`📊 Status check ${attempts}:`, statusResult.status);

                        if (statusResult.status === 'COMPLETED') {
                            // Get the final result
                            const resultResponse = await fetch(
                                `https://fal.run/fal-ai/flux-kontext/dev/requests/${requestId}`,
                                {
                                    headers: {
                                        'Authorization': `Key ${falApiKey}`
                                    }
                                }
                            );

                            if (resultResponse.ok) {
                                finalResult = await resultResponse.json();
                                console.log('🎉 Got final result from FAL.ai');
                                break;
                            } else {
                                // Handle error when fetching completed result
                                const errorText = await resultResponse.text();
                                console.error('❌ Failed to get result:', resultResponse.status, errorText);

                                const errorInfo = parseFalError(resultResponse, errorText);
                                await updateGenerationWithError(
                                    supabase,
                                    generationId,
                                    errorInfo,
                                    falParams
                                );

                                throw new Error(errorInfo.errorMessage);
                            }
                        } else if (statusResult.status === 'FAILED' || statusResult.status === 'ERROR') {
                            console.log('❌ Generation failed during polling:', statusResult);

                            // Extract error details from status result
                            let errorMessage = 'Generation failed during processing';
                            let errorCode = 500;
                            let errorType = 'processing_error';

                            // Check for content policy violation indicators
                            if (statusResult.error) {
                                const errorStr = typeof statusResult.error === 'string'
                                    ? statusResult.error
                                    : JSON.stringify(statusResult.error);

                                if (errorStr.toLowerCase().includes('content') ||
                                    errorStr.toLowerCase().includes('policy') ||
                                    errorStr.toLowerCase().includes('nsfw') ||
                                    errorStr.toLowerCase().includes('inappropriate')) {
                                    errorCode = 422;
                                    errorType = 'content_violation';
                                    errorMessage = 'Content policy violation: Your input was flagged by the safety system.';
                                } else {
                                    errorMessage = errorStr;
                                }
                            }

                            // Also check the full result for error details
                            try {
                                const fullResultResponse = await fetch(
                                    `https://fal.run/fal-ai/flux-kontext/dev/requests/${requestId}`,
                                    {
                                        headers: {
                                            'Authorization': `Key ${falApiKey}`
                                        }
                                    }
                                );

                                if (fullResultResponse.ok) {
                                    const fullResult = await fullResultResponse.json();
                                    console.log('📋 Full error result:', fullResult);

                                    // Check for 422 or content violation in the full result
                                    if (fullResult.status_code === 422 ||
                                        (fullResult.error && fullResult.error.toString().toLowerCase().includes('content'))) {
                                        errorCode = 422;
                                        errorType = 'content_violation';
                                        errorMessage = 'Content policy violation: Your input was flagged by the safety system.';
                                    }
                                }
                            } catch (e) {
                                console.warn('Could not fetch full error details:', e);
                            }

                            // Update generation with proper error status
                            await supabase
                                .from('ai_generations')
                                .update({
                                    status: 'failed',
                                    completed_at: new Date().toISOString(),
                                    error_message: errorMessage,
                                    metadata: {
                                        ...falParams,
                                        fal_request_id: requestId,
                                        error_type: errorType,
                                        error_code: errorCode,
                                        polling_attempt: attempts,
                                        failed_at: new Date().toISOString(),
                                        status_result: statusResult
                                    }
                                })
                                .eq('id', generationId);

                            console.log(`✅ Generation ${generationId} marked as failed (${errorType})`);

                            // Set flag to exit polling loop
                            generationFailed = true;

                            // Don't throw here - just return a proper response
                            return new Response(JSON.stringify({
                                success: false,
                                error: errorMessage,
                                generation_id: generationId,
                                error_type: errorType
                            }), {
                                headers: {
                                    ...corsHeaders,
                                    'Content-Type': 'application/json'
                                },
                                status: 200 // Return 200 since we handled it gracefully
                            });
                        }
                    }
                } catch (pollError) {
                    console.warn(`⚠️ Polling attempt ${attempts} failed:`, pollError.message);
                    if (attempts === maxAttempts) {
                        throw new Error('Polling failed after maximum attempts');
                    }
                }
            }

            if (attempts >= maxAttempts) {
                throw new Error('Generation timed out after 5 minutes');
            }

            // Process the completed result
            await processCompletedGeneration(
                finalResult,
                generationId,
                user.id,
                outputFormat,
                requestId,
                needsWatermark,
                imageAnalysis,
                guidanceScale,
                steps,
                resolutionMode,
                attempts,
                supabase
            );

            return new Response(JSON.stringify({
                success: true,
                message: 'Generation completed via polling',
                generation_id: generationId,
                mode: 'polling'
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } else if (requestId && !USE_POLLING) {
            // Webhook mode - return immediately
            console.log('⏳ Using WEBHOOK mode for request_id:', requestId);

            await supabase
                .from('ai_generations')
                .update({
                    metadata: {
                        fal_request_id: requestId,
                        processing_started: new Date().toISOString(),
                        status: 'submitted_to_fal',
                        tool_type: 'flux-kontext',
                        needs_watermark: needsWatermark,
                        mode: 'webhook',
                        webhook_url: webhookUrl,
                        image_analysis: imageAnalysis,
                        ...addWatermarkMetadata({}, needsWatermark)
                    }
                })
                .eq('id', generationId);

            return new Response(JSON.stringify({
                success: true,
                message: 'Generation submitted. Webhook will handle completion.',
                generation_id: generationId,
                request_id: requestId,
                mode: 'webhook'
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } else if (!requestId && (submitResult.images || submitResult.image)) {
            // Immediate result
            console.log('🎉 Got immediate result from FAL.ai');

            await processCompletedGeneration(
                submitResult,
                generationId,
                user.id,
                outputFormat,
                null,
                needsWatermark,
                imageAnalysis,
                guidanceScale,
                steps,
                resolutionMode,
                0,
                supabase
            );

            return new Response(JSON.stringify({
                success: true,
                message: 'Generation completed immediately',
                generation_id: generationId,
                mode: 'immediate'
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        } else {
            throw new Error('Unexpected response from FAL.ai - no request_id or result');
        }

    } catch (error) {
        console.error('❌ Error in fal-flux-kontext:', error);

        // Try to update generation status to failed
        if (generationId) {
            try {
                const supabase = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                );

                await supabase
                    .from('ai_generations')
                    .update({
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        error_message: error.message,
                        metadata: {
                            error_details: error.toString(),
                            failed_at: new Date().toISOString()
                        }
                    })
                    .eq('id', generationId);
            } catch (updateError) {
                console.error('❌ Error updating failed generation:', updateError);
            }
        }

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            generation_id: generationId
        }), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            },
            status: 500
        });
    }
});

// Helper function to process completed generation
async function processCompletedGeneration(
    finalResult: any,
    generationId: string,
    userId: string,
    outputFormat: string,
    requestId: string | null,
    needsWatermark: boolean,
    imageAnalysis: any,
    guidanceScale: number,
    steps: number,
    resolutionMode: string,
    pollingAttempts: number,
    supabase: any
) {
    // Extract image URLs from FAL.ai response
    let outputUrls = [];
    let primaryUrl = null;

    if (finalResult.images && Array.isArray(finalResult.images)) {
        for (const img of finalResult.images) {
            if (img && typeof img === 'object' && img.url) {
                outputUrls.push(img.url);
            }
        }
        primaryUrl = outputUrls[0];
    } else if (finalResult.image && finalResult.image.url) {
        primaryUrl = finalResult.image.url;
        outputUrls = [primaryUrl];
    }

    if (!primaryUrl) {
        throw new Error('No images generated by FAL.ai API');
    }

    console.log('📸 Generated image URLs:', outputUrls);

    // Store images permanently
    let finalUrls = [];
    let finalPrimaryUrl = primaryUrl;

    try {
        console.log('📥 Storing images permanently...');

        for (let i = 0; i < outputUrls.length; i++) {
            const imageUrl = outputUrls[i];
            const response = await fetch(imageUrl);

            if (response.ok) {
                const imageData = await response.arrayBuffer();
                const timestamp = Date.now();
                const fileExtension = outputFormat === 'jpeg' ? 'jpg' : 'png';
                const filePath = `${userId}/flux-kontext/${timestamp}_${i}.${fileExtension}`;

                const { error: uploadError } = await supabase.storage
                    .from('user-files')
                    .upload(filePath, imageData, {
                        contentType: `image/${outputFormat}`,
                        upsert: true
                    });

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('user-files')
                        .getPublicUrl(filePath);

                    finalUrls.push(publicUrl);
                    if (i === 0) {
                        finalPrimaryUrl = publicUrl;
                    }
                    console.log(`✅ Image ${i + 1} stored permanently:`, publicUrl);
                } else {
                    console.error(`❌ Failed to upload image ${i + 1}:`, uploadError);
                    finalUrls.push(imageUrl);
                }
            }
        }
    } catch (storageError) {
        console.warn('⚠️ Storage failed, using original URLs:', storageError);
        finalUrls = outputUrls;
    }

    // Update generation with result
    const { error: updateError } = await supabase
        .from('ai_generations')
        .update({
            output_file_url: finalUrls.length === 1 ? finalPrimaryUrl : JSON.stringify(finalUrls),
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
                fal_request_id: requestId || finalResult.request_id,
                processing_time: finalResult.processing_time || 'unknown',
                num_images_generated: finalUrls.length,
                primary_url: finalPrimaryUrl,
                all_urls: finalUrls,
                original_urls: outputUrls,
                model: 'flux-kontext-dev',
                tool_type: 'flux-kontext',
                guidance_scale: guidanceScale,
                steps: steps,
                seed: finalResult.seed || 'random',
                resolution_mode: resolutionMode,
                output_format: outputFormat,
                input_image_analysis: imageAnalysis || null,
                has_nsfw_concepts: finalResult.has_nsfw_concepts || [],
                polling_attempts: pollingAttempts,
                needs_watermark: needsWatermark,
                ...addWatermarkMetadata({}, needsWatermark)
            }
        })
        .eq('id', generationId);

    if (updateError) {
        console.error('❌ Error updating generation record:', updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log('✅ Generation completed successfully');
}