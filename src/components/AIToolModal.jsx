import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createAIGeneration, updateTokenCount } from '../utils/storageHelpers';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Download,
  Zap
} from 'lucide-react';

const AIToolModal = ({ tool, isOpen, onClose, user, profile, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Input, 2: Processing, 3: Complete
  const [formData, setFormData] = useState({
    prompt: '',
    style: 'realistic',
    animationType: 'zoom',
    duration: 3,
    width: 512,
    height: 512
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [generationId, setGenerationId] = useState(null);

  if (!isOpen || !tool) return null;

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = tool.category === 'video' 
      ? ['video/mp4', 'video/mov', 'video/avi']
      : ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      setError(`Please select a valid ${tool.category} file`);
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }

    try {
      setError('');
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/uploads/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('user-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-files')
        .getPublicUrl(filePath);

      setUploadedFile(file);
      setUploadedFileUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Error uploading file. Please try again.');
    }
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setProcessing(true);
      setStep(2);
      setProgress(10);

      // Check if user has enough tokens
      if (profile.tokens < tool.tokensRequired) {
        throw new Error('Insufficient tokens. Please upgrade your plan.');
      }

      // Create generation record
      const toolTypeMap = {
        1: 'gen_01', 2: 'gen_02', 3: 'gen_03',
        4: 'gen_04', 5: 'gen_05', 6: 'gen_06'
      };

      const generation = await createAIGeneration(
        toolTypeMap[tool.id],
        formData.prompt || `${tool.name} - ${Date.now()}`,
        {
          ...formData,
          uploadedFileUrl: uploadedFileUrl || null
        },
        tool.tokensRequired
      );

      setGenerationId(generation.id);
      setProgress(30);

      // Deduct tokens immediately
      await updateTokenCount(user.id, tool.tokensRequired);
      setProgress(50);

      // Call appropriate Edge Function
      const endpoint = getEndpointForTool(tool.id);
      const payload = buildPayloadForTool(tool.id, formData, uploadedFileUrl, generation.id);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      setProgress(80);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      setProgress(100);
      setResult(result);
      setStep(3);

      // Notify parent component of success
      if (onSuccess) {
        onSuccess(result);
      }

    } catch (error) {
      console.error('Error generating:', error);
      setError(error.message);
      setProcessing(false);
      setStep(1);
    }
  };

  const getEndpointForTool = (toolId) => {
    const endpoints = {
      1: 'ai-image-generator',
      2: 'motion-graphics-creator',
      3: 'video-style-transfer',
      4: 'background-remover',
      5: 'face-swap-ai',
      6: 'video-upscaler'
    };
    return endpoints[toolId];
  };

  const buildPayloadForTool = (toolId, formData, fileUrl, generationId) => {
    const basePayload = { generationId };

    switch (toolId) {
      case 1: // AI Image Generator
        return {
          ...basePayload,
          prompt: formData.prompt,
          style: formData.style,
          width: formData.width,
          height: formData.height
        };
      case 2: // Motion Graphics Creator
        return {
          ...basePayload,
          imageUrl: fileUrl,
          animationType: formData.animationType,
          duration: formData.duration
        };
      case 3: // Video Style Transfer
        return {
          ...basePayload,
          videoUrl: fileUrl,
          styleUrl: formData.styleImageUrl
        };
      case 4: // Background Remover
        return {
          ...basePayload,
          inputUrl: fileUrl
        };
      case 5: // Face Swap AI
        return {
          ...basePayload,
          sourceUrl: fileUrl,
          targetUrl: formData.targetImageUrl
        };
      case 6: // Video Upscaler
        return {
          ...basePayload,
          videoUrl: fileUrl,
          scaleFactor: formData.scaleFactor || 2
        };
      default:
        return basePayload;
    }
  };

  const handleClose = () => {
    if (!processing) {
      setStep(1);
      setFormData({
        prompt: '',
        style: 'realistic',
        animationType: 'zoom',
        duration: 3,
        width: 512,
        height: 512
      });
      setUploadedFile(null);
      setUploadedFileUrl('');
      setResult(null);
      setError('');
      setProgress(0);
      onClose();
    }
  };

  const handleDownload = async () => {
    if (result?.output_file_url) {
      const link = document.createElement('a');
      link.href = result.output_file_url;
      link.download = `${tool.name}-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{tool.name}</h2>
              <div className="flex items-center space-x-2 text-sm text-purple-200">
                <Zap className="w-4 h-4" />
                <span>{tool.tokensRequired} tokens</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={processing}
            className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center text-white transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Tool-specific inputs */}
              {tool.id === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Prompt *
                    </label>
                    <textarea
                      value={formData.prompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                      placeholder="Describe the image you want to generate..."
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Style
                      </label>
                      <select
                        value={formData.style}
                        onChange={(e) => setFormData(prev => ({ ...prev, style: e.target.value }))}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="realistic">Realistic</option>
                        <option value="artistic">Artistic</option>
                        <option value="cartoon">Cartoon</option>
                        <option value="abstract">Abstract</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Size
                      </label>
                      <select
                        value={`${formData.width}x${formData.height}`}
                        onChange={(e) => {
                          const [width, height] = e.target.value.split('x').map(Number);
                          setFormData(prev => ({ ...prev, width, height }));
                        }}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="512x512">512x512</option>
                        <option value="768x768">768x768</option>
                        <option value="1024x1024">1024x1024</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {(tool.id === 2 || tool.id === 3 || tool.id === 4 || tool.id === 6) && (
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Upload {tool.category === 'video' ? 'Video' : 'Image'} *
                  </label>
                  <div className="border-2 border-dashed border-white/30 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept={tool.category === 'video' ? 'video/*' : 'image/*'}
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="w-8 h-8 text-purple-300 mx-auto mb-2" />
                      <p className="text-purple-200">
                        {uploadedFile ? uploadedFile.name : `Click to upload ${tool.category}`}
                      </p>
                      <p className="text-purple-300 text-sm mt-1">
                        Max 50MB • {tool.category === 'video' ? 'MP4, MOV, AVI' : 'JPG, PNG, WebP'}
                      </p>
                    </label>
                  </div>
                </div>
              )}

              {tool.id === 2 && uploadedFile && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Animation Type
                    </label>
                    <select
                      value={formData.animationType}
                      onChange={(e) => setFormData(prev => ({ ...prev, animationType: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="zoom">Zoom</option>
                      <option value="pan">Pan</option>
                      <option value="rotate">Rotate</option>
                      <option value="fade">Fade</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.duration}
                      onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={
                    (tool.id === 1 && !formData.prompt) ||
                    ((tool.id === 2 || tool.id === 3 || tool.id === 4 || tool.id === 6) && !uploadedFile) ||
                    profile.tokens < tool.tokensRequired
                  }
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Generate ({tool.tokensRequired} tokens)
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Processing...</h3>
              <p className="text-purple-200 mb-6">Your {tool.name.toLowerCase()} is being generated</p>
              
              <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-purple-300 text-sm">{progress}% complete</p>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Generation Complete!</h3>
              <p className="text-purple-200 mb-6">Your {tool.name.toLowerCase()} has been generated successfully</p>
              
              {result?.output_file_url && (
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  {tool.category === 'video' ? (
                    <video 
                      src={result.output_file_url} 
                      controls 
                      className="w-full max-h-64 rounded-lg"
                    />
                  ) : (
                    <img 
                      src={result.output_file_url} 
                      alt="Generated content" 
                      className="w-full max-h-64 object-contain rounded-lg"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center space-x-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIToolModal;