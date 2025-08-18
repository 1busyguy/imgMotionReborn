/**
 * Runware API Client for Supabase Edge Functions
 */

interface RunwareImageRequest {
  taskType: 'imageInference';
  model: string;
  positivePrompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  CFGScale: number;
  checkNSFW?: boolean;
  seed?: number;
  ipAdapters?: Array<{
    guideImage: string;
    model: string;
  }>;
}

interface RunwareResponse {
  data?: Array<{
    imageURL?: string;
    imageUUID?: string;
    taskUUID?: string;
    seed?: number;
  }>;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

export class RunwareClient {
  private apiKey: string;
  private baseUrl = 'https://api.runware.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async uploadImage(imageData: Uint8Array, filename: string): Promise<string> {
    console.log('Uploading image to Runware:', filename);
    
    const formData = new FormData();
    const blob = new Blob([imageData], { type: 'image/jpeg' });
    formData.append('file', blob, filename);

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Image upload response:', result);
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`Upload error: ${result.errors[0].message}`);
    }

    return result.data?.[0]?.imageUUID || result.imageUUID;
  }

  async generateImageVariation(params: {
    guideImageUUID: string;
    prompt: string;
    width: number;
    height: number;
    steps: number;
  }): Promise<RunwareResponse> {
    console.log('Generating image variation with params:', params);

    const payload: RunwareImageRequest = {
      taskType: 'imageInference',
      model: 'runware:101@1', // FLUX.1 [dev]
      positivePrompt: params.prompt,
      width: params.width,
      height: params.height,
      steps: params.steps,
      CFGScale: 7.5,
      checkNSFW: false,
      ipAdapters: [{
        guideImage: params.guideImageUUID,
        model: 'runware:105@1' // FLUX Redux IP-Adapter
      }]
    };

    console.log('Sending request to Runware API:', JSON.stringify(payload, null, 2));

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify([payload])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Runware API error:', response.status, errorText);
      throw new Error(`Runware API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Runware API response:', JSON.stringify(result, null, 2));
    
    return Array.isArray(result) ? { data: result } : result;
  }

  async generateImage(params: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    steps: number;
    guidanceScale?: number;
    seed?: number;
  }): Promise<RunwareResponse> {
    console.log('Generating image with params:', params);

    const payload: RunwareImageRequest = {
      taskType: 'imageInference',
      model: 'runware:101@1', // FLUX.1 [dev]
      positivePrompt: params.prompt,
      negativePrompt: params.negativePrompt || '',
      width: params.width,
      height: params.height,
      steps: params.steps,
      CFGScale: params.guidanceScale || 7.5,
      checkNSFW: false
    };

    // Only add seed if it's a positive number
    if (params.seed && params.seed > 0) {
      payload.seed = params.seed;
    }

    console.log('Sending request to Runware API:', JSON.stringify(payload, null, 2));

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify([payload])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Runware API error:', response.status, errorText);
      throw new Error(`Runware API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Runware API response:', JSON.stringify(result, null, 2));
    
    return Array.isArray(result) ? { data: result } : result;
  }

  async waitForCompletion(taskUUID: string, maxAttempts = 30): Promise<RunwareResponse> {
    console.log('Waiting for task completion:', taskUUID);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      try {
        const response = await fetch(`${this.baseUrl}/status/${taskUUID}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data?.[0]?.imageURL) {
            console.log('Task completed successfully');
            return result;
          }
        }
      } catch (error) {
        console.warn('Status check failed:', error);
      }
    }

    throw new Error('Task completion timeout');
  }
}

export function createRunwareClient(): RunwareClient {
  const apiKey = Deno.env.get('RUNWARE_API_KEY');
  if (!apiKey) {
    throw new Error('RUNWARE_API_KEY environment variable not set');
  }
  return new RunwareClient(apiKey);
}