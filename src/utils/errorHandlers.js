// Error handling utilities for FAL.ai and other AI services

/**
 * Check if error is related to NSFW content detection
 * @param {string} errorMessage - Error message from API
 * @returns {boolean} - True if NSFW related error
 */
export const isNSFWError = (errorMessage) => {
  if (!errorMessage) return false;
  
  const nsfwIndicators = [
    'content_policy_violation',
    'flagged as NSFW',
    'flagged by content',
    'content safety',
    'inappropriate content',
    'content filter',
    'policy violation',
    'nsfw',
    'content_checker'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return nsfwIndicators.some(indicator => lowerMessage.includes(indicator));
};

/**
 * Check if error is related to content policy (including DashScope)
 * @param {string} errorMessage - Error message from API
 * @returns {boolean} - True if content policy error
 */
export const isContentPolicyError = (errorMessage) => {
  if (!errorMessage) return false;
  
  const contentPolicyIndicators = [
    'DataInspectionFailed',
    'inappropriate content',
    'content_policy_violation',
    'flagged by content',
    'content safety',
    'content filter',
    'policy violation'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return contentPolicyIndicators.some(indicator => lowerMessage.includes(indicator.toLowerCase()));
};

/**
 * Extract NSFW error details from FAL.ai error response
 * @param {string} errorMessage - Full error message
 * @returns {object} - Parsed error details
 */
export const parseNSFWError = (errorMessage) => {
  try {
    // Try to extract JSON from error message
    const jsonMatch = errorMessage.match(/\{.*\}/);
    if (jsonMatch) {
      const errorData = JSON.parse(jsonMatch[0]);
      
      // Extract relevant details
      const details = {
        type: 'content_policy_violation',
        message: 'Image flagged by content safety system',
        technical: errorMessage,
        suggestions: [
          'Try uploading a different image',
          'Ensure image complies with content policy',
          'Use family-friendly content only'
        ]
      };
      
      return details;
    }
  } catch (e) {
    // Fallback if JSON parsing fails
  }
  
  return {
    type: 'content_policy_violation',
    message: 'Content flagged by safety system',
    technical: errorMessage,
    suggestions: [
      'Try uploading a different image',
      'Ensure content is appropriate'
    ]
  };
};

/**
 * Parse content policy error details (DashScope specific)
 * @param {string} errorMessage - Full error message
 * @returns {object} - Parsed error details
 */
export const parseContentPolicyError = (errorMessage) => {
  // Check if it's specifically a DashScope error
  if (errorMessage.includes('DataInspectionFailed')) {
    return {
      type: 'content_policy_violation',
      message: 'Content flagged by DashScope safety system',
      technical: errorMessage,
      suggestions: [
        'Use a different image that\'s clearly family-friendly',
        'Avoid prompts with violent or aggressive actions',
        'Keep descriptions positive and appropriate',
        'Try simpler, gentler motion descriptions like "walking" or "moving slowly"',
        'Ensure your image doesn\'t contain any potentially sensitive content'
      ]
    };
  }
  
  // Generic content policy error
  return {
    type: 'content_policy_violation',
    message: 'Content flagged by safety system',
    technical: errorMessage,
    suggestions: [
      'Use a different image',
      'Modify your prompt to be more family-friendly',
      'Ensure content is appropriate for all audiences'
    ]
  };
};

/**
 * Check if error is a rate limit error
 * @param {string} errorMessage - Error message from API
 * @returns {boolean} - True if rate limit error
 */
export const isRateLimitError = (errorMessage) => {
  if (!errorMessage) return false;
  
  const rateLimitIndicators = [
    'rate limit',
    'too many requests',
    'quota exceeded',
    'rate_limit_exceeded',
    '429'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return rateLimitIndicators.some(indicator => lowerMessage.includes(indicator));
};

/**
 * Check if error is a quota/billing error
 * @param {string} errorMessage - Error message from API
 * @returns {boolean} - True if quota/billing error
 */
export const isQuotaError = (errorMessage) => {
  if (!errorMessage) return false;
  
  const quotaIndicators = [
    'quota exceeded',
    'insufficient credits',
    'billing',
    'payment required',
    'subscription',
    'credits'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return quotaIndicators.some(indicator => lowerMessage.includes(indicator));
};

/**
 * Get user-friendly error message based on error type
 * @param {string} errorMessage - Original error message
 * @returns {string} - User-friendly message
 */
export const getUserFriendlyError = (errorMessage) => {
  if (isContentPolicyError(errorMessage)) {
    return 'Content flagged by safety system. Please try a different image or modify your prompt to be more family-friendly.';
  }
  
  if (isNSFWError(errorMessage)) {
    return 'Image flagged by content safety system. Please try a different image.';
  }
  
  if (isRateLimitError(errorMessage)) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (isQuotaError(errorMessage)) {
    return 'API quota exceeded. Please check your subscription or try again later.';
  }
  
  // Generic fallback
  return 'Generation failed. Please try again or contact support if the issue persists.';
};