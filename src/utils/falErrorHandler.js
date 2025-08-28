// src/utils/falErrorHandler.js - COMPLETE FILE

/**
 * Parse FAL.ai errors from generation records
 */
export const parseFalError = (generation) => {
  // Handle both generation objects and simple error objects
  const errorType = generation?.metadata?.error_type || 
                    generation?.metadata?.fal_error_details?.error_type ||
                    generation?.metadata?.error_analysis?.error_type ||
                    'unknown_error';
  
  const statusCode = generation?.metadata?.fal_error_details?.status_code ||
                     generation?.metadata?.error_analysis?.error_code ||
                     generation?.statusCode;
  
  const userMessage = generation?.error_message || 'Generation failed';
  const technicalMessage = generation?.metadata?.fal_error_details?.technical_message ||
                          generation?.metadata?.error_analysis?.raw_error ||
                          generation?.message;
  
  return {
    type: errorType,
    message: userMessage,
    technicalMessage,
    statusCode,
    isRetryable: isRetryableError(errorType),
    timestamp: generation?.completed_at || generation?.updated_at || new Date().toISOString()
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
 * Get error icon component name
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
 * Get error title
 */
export const getErrorTitle = (errorType) => {
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
 * Parse error from string message or error object
 */
export const parseErrorMessage = (error, statusCode = null) => {
  // Default values
  let errorType = 'unknown_error';
  let userMessage = 'Generation failed. Please try again.';
  let isRetryable = true;
  
  // Get error message string
  const errorMessage = typeof error === 'string' ? error : 
                      error?.message || error?.error || '';
  const lowerMessage = errorMessage.toLowerCase();
  
  // Check status code first (most reliable)
  if (statusCode === 422) {
    errorType = 'content_violation';
    userMessage = 'Content policy violation: Your input was flagged by the safety system.';
    isRetryable = false;
  } else if (statusCode === 500 || statusCode === 503) {
    errorType = 'server_error';
    userMessage = 'The AI service is temporarily unavailable. Please try again in a few minutes.';
  } else if (statusCode === 400) {
    errorType = 'bad_request';
    userMessage = 'Invalid request: Please check your input and try again.';
  } else if (statusCode === 402 || statusCode === 403) {
    errorType = 'quota_error';
    userMessage = 'Service quota exceeded. Please try again later.';
    isRetryable = false;
  } else if (statusCode === 429) {
    errorType = 'rate_limit';
    userMessage = 'Too many requests. Please wait a moment before trying again.';
  }
  // Fallback to message parsing if no status code
  else if (lowerMessage.includes('content') || lowerMessage.includes('policy') || 
           lowerMessage.includes('inappropriate') || lowerMessage.includes('nsfw')) {
    errorType = 'content_violation';
    userMessage = 'Content policy violation detected. Please modify your input.';
    isRetryable = false;
  } else if (lowerMessage.includes('server') || lowerMessage.includes('internal')) {
    errorType = 'server_error';
    userMessage = 'Server error occurred. Please try again later.';
  } else if (lowerMessage.includes('rate') || lowerMessage.includes('limit')) {
    errorType = 'rate_limit';
    userMessage = 'Rate limit reached. Please wait before trying again.';
  } else if (lowerMessage.includes('quota') || lowerMessage.includes('credit')) {
    errorType = 'quota_error';
    userMessage = 'Quota exceeded. Please check your subscription.';
    isRetryable = false;
  }
  
  return {
    type: errorType,
    message: userMessage,
    technicalMessage: errorMessage,
    statusCode: statusCode,
    isRetryable: isRetryable
  };
};

// ============================================
// BACKWARD COMPATIBILITY FUNCTIONS
// For components still using old error handlers
// ============================================

/**
 * Check if error is NSFW/content policy related (backward compatibility)
 */
export const isNSFWError = (errorMessage) => {
  if (!errorMessage) return false;
  const lowerMessage = errorMessage.toLowerCase();
  return lowerMessage.includes('content_policy_violation') ||
         lowerMessage.includes('nsfw') ||
         lowerMessage.includes('inappropriate') ||
         lowerMessage.includes('flagged') ||
         lowerMessage.includes('content safety') ||
         lowerMessage.includes('policy violation');
};

/**
 * Parse NSFW error (backward compatibility)
 */
export const parseNSFWError = (errorMessage) => {
  return {
    type: 'content_violation',
    message: 'Content flagged by safety system',
    technical: errorMessage,
    suggestions: [
      'Try uploading a different image',
      'Ensure content is appropriate',
      'Use family-friendly content only'
    ]
  };
};

/**
 * Check if error is content policy related (backward compatibility)
 */
export const isContentPolicyError = (errorMessage) => {
  if (!errorMessage) return false;
  const lowerMessage = errorMessage.toLowerCase();
  return lowerMessage.includes('content_policy_violation') ||
         lowerMessage.includes('content') ||
         lowerMessage.includes('policy') ||
         lowerMessage.includes('inappropriate') ||
         lowerMessage.includes('nsfw') ||
         lowerMessage.includes('flagged') ||
         lowerMessage.includes('DataInspectionFailed');
};

/**
 * Parse content policy error (backward compatibility)
 */
export const parseContentPolicyError = (errorMessage) => {
  // Check if it's specifically a DashScope error
  if (errorMessage && errorMessage.includes('DataInspectionFailed')) {
    return {
      type: 'content_violation',
      message: 'Content flagged by DashScope safety system',
      technical: errorMessage,
      suggestions: [
        'Use a different image that\'s clearly family-friendly',
        'Avoid prompts with violent or aggressive actions',
        'Keep descriptions positive and appropriate',
        'Try simpler, gentler motion descriptions',
        'Ensure your image doesn\'t contain any potentially sensitive content'
      ]
    };
  }
  
  return {
    type: 'content_violation',
    message: 'Content flagged by safety system',
    technical: errorMessage,
    suggestions: [
      'Use family-friendly content',
      'Avoid suggestive or inappropriate imagery',
      'Modify your prompt to be more appropriate'
    ]
  };
};

/**
 * Check if error is rate limit (backward compatibility)
 */
export const isRateLimitError = (errorMessage) => {
  if (!errorMessage) return false;
  const lowerMessage = errorMessage.toLowerCase();
  return lowerMessage.includes('rate limit') ||
         lowerMessage.includes('too many requests') ||
         lowerMessage.includes('429');
};

/**
 * Check if error is quota related (backward compatibility)
 */
export const isQuotaError = (errorMessage) => {
  if (!errorMessage) return false;
  const lowerMessage = errorMessage.toLowerCase();
  return lowerMessage.includes('quota') ||
         lowerMessage.includes('credit') ||
         lowerMessage.includes('billing') ||
         lowerMessage.includes('subscription');
};

/**
 * Get user-friendly error message (backward compatibility)
 */
export const getUserFriendlyError = (errorMessage) => {
  const parsed = parseErrorMessage(errorMessage);
  return parsed.message;
};