import { supabase } from '../lib/supabaseClient';
import { createAIGeneration, updateTokenCount } from './storageHelpers';

export interface ToolExecutionOptions {
  toolType: string;
  edgeFunction: string;
  tokensRequired: number;
  generationName: string;
  input: Record<string, any>;
  onGenerationCreated?: (generation: any) => void;
}

export interface ToolExecutionResult {
  generationId: string;
  jobId: string;
  response: any;
}

const EDGE_FUNCTION_OVERRIDES: Record<string, string> = {
  fal_seedance_pro: 'fal-seedance-pro',
  fal_seedream_v4_text2image: 'fal-seedream-text2image',
  fal_seedream_v4_edit: 'fal-seedream-edit',
  fal_seedance_reference_to_video: 'fal-seedance-video',
  fal_wan_v22_img2video_lora: 'fal-wan-v22-img2video-lora',
};

const resolveEdgeFunction = (toolType: string, fallback: string) => {
  if (EDGE_FUNCTION_OVERRIDES[toolType]) {
    return EDGE_FUNCTION_OVERRIDES[toolType];
  }
  return fallback.replace(/_/g, '-');
};

export const executeToolRun = async ({
  toolType,
  edgeFunction,
  tokensRequired,
  generationName,
  input,
  onGenerationCreated,
}: ToolExecutionOptions): Promise<ToolExecutionResult> => {
  const normalizedTokens = Number.isFinite(tokensRequired) ? tokensRequired : 0;
  const resolvedFunction = resolveEdgeFunction(toolType, edgeFunction);

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData.session?.access_token;
  const userId = sessionData.session?.user?.id;

  if (!accessToken || !userId) {
    throw new Error('Unable to resolve authenticated Supabase session.');
  }

  const generation = await createAIGeneration(
    toolType,
    generationName,
    input,
    normalizedTokens,
  );

  onGenerationCreated?.(generation);

  if (normalizedTokens > 0) {
    await updateTokenCount(userId, normalizedTokens);
  }

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${resolvedFunction}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generationId: generation.id,
      ...input,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Tool execution failed.';
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorMessage;
    } catch (parseError) {
      // ignore JSON parse issues
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();

  return {
    generationId: generation.id,
    jobId: result?.jobId ?? generation.id,
    response: result,
  };
};
