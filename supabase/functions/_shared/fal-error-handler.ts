// supabase/functions/_shared/fal-error-handler.ts

export function parseFalError(falResponse: Response, responseBody: string) {
  let errorMessage = `FAL.ai API error (${falResponse.status})`;
  let errorDetails = {};
  let errorType = 'api_error';
  let userFriendlyMessage = 'Generation failed. Please try again.';
  
  try {
    const errorData = JSON.parse(responseBody);
    
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
    errorMessage = `${errorMessage}: ${responseBody.substring(0, 200)}`;
  }
  
  // Categorize based on status code
  switch (falResponse.status) {
    case 422:
      errorType = 'content_violation';
      userFriendlyMessage = 'Content policy violation: Your input was flagged by the safety system.';
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
    case 429:
      errorType = 'rate_limit';
      userFriendlyMessage = 'Too many requests. Please wait a moment before trying again.';
      break;
  }
  
  return {
    errorMessage: userFriendlyMessage,
    technicalMessage: errorMessage,
    errorType,
    errorDetails,
    statusCode: falResponse.status
  };
}

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
      error_message: errorInfo.errorMessage,
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