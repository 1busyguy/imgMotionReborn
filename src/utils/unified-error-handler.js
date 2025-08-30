// Unified Error Handler - Single source of truth for all error parsing
export const ERROR_TYPES = {
    CONTENT_VIOLATION: 'content_violation',
    SERVER_ERROR: 'server_error',
    BAD_REQUEST: 'bad_request',
    RATE_LIMIT: 'rate_limit',
    QUOTA_ERROR: 'quota_error',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown_error'
};

/**
 * Parse any error from FAL.ai (webhook, edge function, or client)
 */
export function parseError(error, statusCode = null) {
    // Extract status code from various sources
    const code = statusCode ||
        error?.status ||
        error?.statusCode ||
        extractStatusFromString(error?.message || error?.error || String(error));

    // Determine error type based on status code
    let errorType = ERROR_TYPES.UNKNOWN;
    let userMessage = 'Generation failed';
    let isRetryable = true;

    switch (code) {
        case 422:
            errorType = ERROR_TYPES.CONTENT_VIOLATION;
            userMessage = 'Content policy violation detected';
            isRetryable = false;
            break;
        case 500:
        case 503:
            errorType = ERROR_TYPES.SERVER_ERROR;
            userMessage = 'AI service temporarily unavailable';
            break;
        case 400:
            errorType = ERROR_TYPES.BAD_REQUEST;
            userMessage = 'Invalid request parameters';
            break;
        case 429:
            errorType = ERROR_TYPES.RATE_LIMIT;
            userMessage = 'Too many requests, please wait';
            break;
        case 402:
        case 403:
            errorType = ERROR_TYPES.QUOTA_ERROR;
            userMessage = 'Service quota exceeded';
            isRetryable = false;
            break;
    }

    return {
        error_type: errorType,
        error_message: userMessage,
        status_code: code,
        is_retryable: isRetryable,
        raw_error: String(error?.message || error)
    };
}

/**
 * Extract status code from error string like "Unexpected status code: 422"
 */
function extractStatusFromString(str) {
    const match = str.match(/status\s*code:\s*(\d{3})/i) ||
        str.match(/\b(4\d{2}|5\d{2})\b/);
    return match ? parseInt(match[1]) : null;
}

/**
 * Update generation record with standardized error info
 */
export async function updateGenerationError(supabase, generationId, error, additionalData = {}) {
    const errorInfo = parseError(error);

    return await supabase
        .from('ai_generations')
        .update({
            status: 'failed',
            error_type: errorInfo.error_type,  // New column
            error_message: errorInfo.error_message,
            completed_at: new Date().toISOString(),
            metadata: {
                ...additionalData,
                error_details: errorInfo,
                timestamp: new Date().toISOString()
            }
        })
        .eq('id', generationId);
}
