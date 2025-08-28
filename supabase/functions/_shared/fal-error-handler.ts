// supabase/functions/_shared/fal-error-handler.ts

/**
 * Parse FAL.ai error responses in edge functions
 */
export function parseFalError(falResponse: Response, responseBody: string) {
    let errorMessage = `FAL.ai API error (${falResponse.status})`;
    let errorDetails = {};
    let errorType = 'api_error';
    let userFriendlyMessage = 'Generation failed. Please try again.';

    // Try to parse JSON response
    try {
        const errorData = JSON.parse(responseBody);

        // Extract error message from various possible locations
        if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string'
                ? errorData.detail
                : JSON.stringify(errorData.detail);
        } else if (errorData.error) {
            errorMessage = errorData.error;
        } else if (errorData.message) {
            errorMessage = errorData.message;
        }

        errorDetails = errorData;
    } catch (e) {
        // If not JSON, use the raw response
        errorMessage = `${errorMessage}: ${responseBody.substring(0, 200)}`;
    }

    // Categorize error based on status code
    switch (falResponse.status) {
        case 422:
            errorType = 'content_violation';
            userFriendlyMessage = 'Content policy violation: Your input was flagged by the safety system. Please use family-friendly content.';
            break;
        case 400:
            errorType = 'bad_request';
            userFriendlyMessage = 'Invalid request: Please check your input and try again.';
            break;
        case 500:
        case 503:
            errorType = 'server_error';
            userFriendlyMessage = 'The AI service is temporarily unavailable. Please try again in a few minutes.';
            break;
        case 402:
        case 403:
            errorType = 'quota_error';
            userFriendlyMessage = 'Service quota exceeded. Please try again later.';
            break;
        case 429:
            errorType = 'rate_limit';
            userFriendlyMessage = 'Too many requests. Please wait a moment before trying again.';
            break;
        default:
            // Additional detection through message content
            const lowerMessage = errorMessage.toLowerCase();
            if (lowerMessage.includes('content') || lowerMessage.includes('policy') ||
                lowerMessage.includes('inappropriate') || lowerMessage.includes('nsfw')) {
                errorType = 'content_violation';
                userFriendlyMessage = 'Content policy violation detected. Please modify your input.';
            }
    }

    return {
        errorMessage: userFriendlyMessage,  // User-facing message
        technicalMessage: errorMessage,     // Technical details
        errorType,
        errorDetails,
        statusCode: falResponse.status
    };
}

/**
 * Update generation record with error information
 */
export async function updateGenerationWithError(
    supabase: any,
    generationId: string,
    errorInfo: any,
    requestParams?: any
) {
    return await supabase
        .from('ai_generations')
        .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: errorInfo.errorMessage,  // User-friendly message
            metadata: {
                fal_error_details: {
                    status_code: errorInfo.statusCode,
                    technical_message: errorInfo.technicalMessage,
                    error_timestamp: new Date().toISOString(),
                    request_params: requestParams,
                    error_details: errorInfo.errorDetails,
                    error_type: errorInfo.errorType
                },
                error_type: errorInfo.errorType
            }
        })
        .eq('id', generationId);
}