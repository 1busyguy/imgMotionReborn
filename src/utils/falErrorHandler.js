// src/utils/falErrorHandler.js - THIS IS THE ONLY CLIENT-SIDE ERROR FILE YOU NEED

/**
 * Parse FAL.ai errors from generation records
 */
export const parseFalError = (generation) => {
    const errorType = generation?.metadata?.error_type ||
        generation?.metadata?.fal_error_details?.error_type ||
        'unknown_error';

    const statusCode = generation?.metadata?.fal_error_details?.status_code ||
        generation?.metadata?.error_analysis?.error_code;

    const userMessage = generation?.error_message || 'Generation failed';
    const technicalMessage = generation?.metadata?.fal_error_details?.technical_message;

    return {
        type: errorType,
        message: userMessage,
        technicalMessage,
        statusCode,
        isRetryable: isRetryableError(errorType),
        timestamp: generation?.completed_at || generation?.updated_at
    };
};

/**
 * Check if error is retryable
 */
export const isRetryableError = (errorType) => {
    const nonRetryable = ['content_violation', 'quota_error'];
    return !nonRetryable.includes(errorType);
};

/**
 * Get error badge color classes
 */
export const getErrorBadgeClasses = (errorType) => {
    const classes = {
        'content_violation': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'server_error': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'bad_request': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'rate_limit': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'quota_error': 'bg-red-500/20 text-red-400 border-red-500/30',
        'unknown_error': 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return classes[errorType] || classes.unknown_error;
};

/**
 * Get error icon component
 */
export const getErrorIcon = (errorType) => {
    const icons = {
        'content_violation': 'AlertTriangle',
        'server_error': 'Zap',
        'bad_request': 'X',
        'rate_limit': 'Clock',
        'quota_error': 'CreditCard',
        'unknown_error': 'AlertCircle'
    };
    return icons[errorType] || icons.unknown_error;
};

/**
 * Get error tips/suggestions
 */
export const getErrorTips = (errorType) => {
    const tips = {
        'content_violation': 'Use family-friendly content. Avoid suggestive themes or inappropriate imagery.',
        'server_error': 'This is temporary. Please wait a few minutes and try again.',
        'bad_request': 'Check your input parameters and ensure your image is valid.',
        'rate_limit': 'You\'re making requests too quickly. Please wait a moment.',
        'quota_error': 'Your API quota is exhausted. Please check your subscription or try later.',
        'unknown_error': 'Please try again. If the issue persists, contact support.'
    };
    return tips[errorType] || tips.unknown_error;
};

/**
 * Handle retry for failed generation
 */
export const handleRetryGeneration = (failedGeneration, setConfig, handleGenerate) => {
    const errorInfo = parseFalError(failedGeneration);

    // Don't retry content violations
    if (!errorInfo.isRetryable) {
        alert(`Cannot retry: ${errorInfo.message}`);
        return false;
    }

    // Restore the configuration from the failed generation
    if (failedGeneration.input_data) {
        setConfig(failedGeneration.input_data);
    }

    // Delay slightly then generate
    setTimeout(() => {
        handleGenerate();
    }, 100);

    return true;
};

/**
 * Format error for display
 */
export const formatErrorDisplay = (generation) => {
    const errorInfo = parseFalError(generation);

    return {
        title: getErrorTitle(errorInfo.type),
        message: errorInfo.message,
        badge: `Error ${errorInfo.statusCode || 'Unknown'}`,
        badgeClass: getErrorBadgeClasses(errorInfo.type),
        tips: getErrorTips(errorInfo.type),
        showRetry: errorInfo.isRetryable,
        icon: getErrorIcon(errorInfo.type)
    };
};

/**
 * Get error title
 */
const getErrorTitle = (errorType) => {
    const titles = {
        'content_violation': 'Content Policy Violation',
        'server_error': 'Server Error',
        'bad_request': 'Invalid Request',
        'rate_limit': 'Rate Limited',
        'quota_error': 'Quota Exceeded',
        'unknown_error': 'Generation Failed'
    };
    return titles[errorType] || titles.unknown_error;
};