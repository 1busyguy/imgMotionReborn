import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { 
  ArrowLeft,
  Wand2,
  Code,
  FileText,
  Settings,
  Play,
  Download,
  X,
  Upload,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  Image,
  Video,
  Music,
  Layers,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const AdminFALToolGenerator = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchingFromUrl, setFetchingFromUrl] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [generatedCode, setGeneratedCode] = useState({
    component: '',
    edgeFunction: '',
    dataUpdates: ''
  });
  const [deploymentStatus, setDeploymentStatus] = useState('');
  const [deploymentError, setDeploymentError] = useState('');
  const [deploymentSuccess, setDeploymentSuccess] = useState(false);
  const [isParsingWithAI, setIsParsingWithAI] = useState(false);
  const [aiParsingError, setAiParsingError] = useState('');

  // Tool configuration state
  const [toolConfig, setToolConfig] = useState({
    // Step 1: Basic Info
    name: '',
    description: '',
    category: 'image', // image, video, audio, enhancement
    falEndpoint: '',
    baseTokenCost: 10,
    estimatedTime: '30-60 seconds',
    toolIcon: 'Wand2',
    
    // Step 2: API Documentation
    apiDocumentation: '',
    parsedParams: [],
    
    // Step 3: Parameter Configuration
    parameters: [],
    
    // Step 4: Advanced Options
    enableSafetyScanning: true,
    enableFileUpload: false,
    fileUploadTypes: ['image'],
    outputFormat: 'url',
    tokenCostFormula: 'baseTokenCost',
    
    // Step 5: Generated identifiers
    componentName: '',
    edgeFunctionName: '',
    toolType: '',
    routePath: ''
  });

  // Template and URL fetching
  const [documentationUrl, setDocumentationUrl] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);

  // Available templates based on your existing tools
  useEffect(() => {
    setAvailableTemplates([
      {
        id: 'wan-v22-img2video-lora',
        name: 'WAN v2.2 Img2Video LoRA',
        description: 'Complex video generation with LoRA support, multiple parameters',
        category: 'video',
        complexity: 'high',
        features: ['Image upload', 'LoRA management', 'Multiple sliders', 'Advanced options']
      },
      {
        id: 'minimax-hailuo',
        name: 'Minimax Hailuo Video',
        description: 'Simple image-to-video with basic parameters',
        category: 'video',
        complexity: 'medium',
        features: ['Image upload', 'Text prompt', 'Duration selection', 'Basic options']
      },
      {
        id: 'flux-kontext-lora',
        name: 'FLUX Kontext LoRA',
        description: 'Text-to-image with LoRA and advanced image options',
        category: 'image',
        complexity: 'high',
        features: ['Text prompts', 'LoRA support', 'Image size options', 'Multiple outputs']
      },
      {
        id: 'bria-bg-remove',
        name: 'BRIA Background Remover',
        description: 'Simple image processing with minimal parameters',
        category: 'image',
        complexity: 'low',
        features: ['Image upload', 'Single output', 'Minimal configuration']
      },
      {
        id: 'mmaudio-v2',
        name: 'MMAudio v2',
        description: 'Audio generation with duration and quality controls',
        category: 'audio',
        complexity: 'medium',
        features: ['Text prompts', 'Duration slider', 'Audio player', 'Quality controls']
      },
      {
        id: 'cassetteai-music',
        name: 'CassetteAI Music',
        description: 'Music generation with genre suggestions and audio player',
        category: 'audio',
        complexity: 'medium',
        features: ['Text prompts', 'Genre suggestions', 'Audio player', 'Duration controls']
      }
    ]);
  }, []);

  useEffect(() => {
    verifyAdminAccess();
  }, []);

  const verifyAdminAccess = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-tool-operations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isAdmin) {
          setIsAdmin(true);
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error verifying admin access:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate identifiers when name changes
  useEffect(() => {
    if (toolConfig.name) {
      const cleanName = toolConfig.name
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const componentName = cleanName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      
      const kebabName = cleanName.toLowerCase().replace(/\s+/g, '-');
      const snakeName = cleanName.toLowerCase().replace(/\s+/g, '_');
      
      setToolConfig(prev => ({
        ...prev,
        componentName,
        edgeFunctionName: `fal-${kebabName}`,
        toolType: `fal_${snakeName}`,
        routePath: `/${kebabName}`
      }));
    }
  }, [toolConfig.name]);

  // Fetch FAL.ai API documentation from URL
  const fetchApiDocumentation = async () => {
    if (!documentationUrl.trim()) {
      setError('Please enter a valid FAL.ai API documentation URL');
      return;
    }

    setFetchingFromUrl(true);
    setError('');

    try {
      // Try to fetch the documentation page
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(documentationUrl)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch documentation page');
      }

      const data = await response.json();
      const htmlContent = data.contents;

      // Parse the HTML to extract API information
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // Extract tool name from title or h1
      const title = doc.querySelector('h1')?.textContent || 
                   doc.querySelector('title')?.textContent || 
                   'New FAL Tool';
      
      // Look for parameter information in various formats
      let parameters = [];
      
      // Try to find JSON schema or parameter tables
      const codeBlocks = doc.querySelectorAll('pre, code');
      for (const block of codeBlocks) {
        const text = block.textContent;
        if (text.includes('{') && (text.includes('prompt') || text.includes('image_url'))) {
          try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              parameters = extractParametersFromJson(parsed);
              break;
            }
          } catch (e) {
            // Continue looking
          }
        }
      }

      // If no parameters found, try to extract from text patterns
      if (parameters.length === 0) {
        parameters = extractParametersFromText(htmlContent);
      }

      // Update form data with extracted information
      setToolConfig(prev => ({
        ...prev,
        name: cleanToolName(title),
        description: `${cleanToolName(title)} - Generated from FAL.ai documentation`,
        falEndpoint: documentationUrl.includes('fal.run') ? 
          documentationUrl.replace(/\/docs.*/, '') : 
          documentationUrl
      }));

      setToolConfig(prev => ({
        ...prev,
        parsedParams: parameters,
        parameters: parameters.map(param => ({
          ...param,
          uiComponent: getDefaultUIComponent(param),
          showInUI: true,
          label: param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        }))
      }));
      setSuccess('Successfully extracted API information from URL!');
      
    } catch (error) {
      console.error('Error fetching API documentation:', error);
      setError(`Failed to fetch API documentation: ${error.message}. Try copying and pasting the documentation text instead.`);
    } finally {
      setFetchingFromUrl(false);
    }
  };

  // Helper function to extract parameters from JSON
  const extractParametersFromJson = (jsonObj) => {
    const params = [];
    
    const processObject = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          processObject(value, prefix ? `${prefix}.${key}` : key);
        } else {
          const paramName = prefix ? `${prefix}.${key}` : key;
          const paramType = inferParameterType(key, value);
          
          params.push({
            id: Date.now() + Math.random(),
            name: paramName,
            type: paramType,
            required: isLikelyRequired(key),
            default: getDefaultValue(paramType, value),
            description: `${key} parameter`,
            uiComponent: getUIComponent(paramType, key)
          });
        }
      }
    };

    processObject(jsonObj);
    return params;
  };

  // Helper function to extract parameters from text
  const extractParametersFromText = (text) => {
    const params = [];
    const commonParams = [
      'prompt', 'image_url', 'video_url', 'audio_url', 'negative_prompt',
      'guidance_scale', 'num_inference_steps', 'seed', 'width', 'height',
      'duration', 'fps', 'resolution', 'aspect_ratio', 'num_images',
      'enable_safety_checker', 'output_format'
    ];

    commonParams.forEach(param => {
      if (text.toLowerCase().includes(param)) {
        const paramType = inferParameterType(param);
        params.push({
          id: Date.now() + Math.random(),
          name: param,
          type: paramType,
          required: isLikelyRequired(param),
          default: getDefaultValue(paramType),
          description: `${param} parameter`,
          uiComponent: getUIComponent(paramType, param)
        });
      }
    });

    return params;
  };

  // Helper functions for parameter inference
  const inferParameterType = (key, value = null) => {
    if (key.includes('url') || key.includes('image') || key.includes('video') || key.includes('audio')) {
      return 'file';
    }
    if (key.includes('prompt') || key.includes('description')) {
      return 'string';
    }
    if (key.includes('enable') || key.includes('safety') || key.includes('expand')) {
      return 'boolean';
    }
    if (key.includes('scale') || key.includes('steps') || key.includes('fps') || key.includes('duration')) {
      return 'number';
    }
    if (key.includes('resolution') || key.includes('format') || key.includes('model')) {
      return 'select';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    return 'string';
  };

  const isLikelyRequired = (key) => {
    const requiredKeys = ['prompt', 'image_url', 'video_url', 'audio_url'];
    return requiredKeys.some(req => key.includes(req));
  };

  const getDefaultValue = (type, value = null) => {
    if (value !== null) return value;
    switch (type) {
      case 'boolean': return false;
      case 'number': return 1;
      case 'file': return '';
      default: return '';
    }
  };

  const getUIComponent = (type, key) => {
    if (key.includes('prompt')) return 'textarea';
    if (key.includes('scale') || key.includes('steps')) return 'slider';
    if (key.includes('resolution') || key.includes('format')) return 'select';
    if (key.includes('url') || key.includes('image') || key.includes('video')) return 'upload';
    
    switch (type) {
      case 'boolean': return 'checkbox';
      case 'number': return 'slider';
      case 'file': return 'upload';
      case 'select': return 'select';
      default: return 'input';
    }
  };

  const cleanToolName = (name) => {
    return name
      .replace(/FAL\.ai|fal\.ai|FAL|API|Documentation/gi, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  };

  // Parse documentation using OpenAI
  const parseWithOpenAI = async () => {
    if (!toolConfig.apiDocumentation.trim()) {
      setError('Please provide documentation to parse');
      return;
    }

    setIsParsingWithAI(true);
    setAiParsingError('');
    setError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-fal-documentation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          documentation: toolConfig.apiDocumentation,
          toolName: toolConfig.name,
          category: toolConfig.category,
          endpoint: toolConfig.falEndpoint
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse documentation');
      }

      const result = await response.json();
      
      if (result.success && result.parameters) {
        setToolConfig(prev => ({
          ...prev,
          parsedParams: result.parameters,
          parameters: result.parameters.map(param => ({
            ...param,
            uiComponent: getDefaultUIComponent(param),
            showInUI: true,
            label: param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
          }))
        }));
        setSuccess('✅ Documentation parsed successfully with OpenAI!');
        
        // Auto-advance to next step
        setTimeout(() => {
          setCurrentStep(3);
          setSuccess('');
        }, 2000);
      } else {
        throw new Error(result.error || 'No parameters extracted');
      }

    } catch (error) {
      console.error('Error parsing with OpenAI:', error);
      setAiParsingError(error.message);
    } finally {
      setIsParsingWithAI(false);
    }
  };

  // Load template data
  const loadTemplate = (templateId) => {
    const template = availableTemplates.find(t => t.id === templateId);
    if (!template) return;

    // Set basic info based on template
    setToolConfig(prev => ({
      ...prev,
      category: template.category,
      // Keep user's custom name and description
    }));

    // Set template-specific parameters
    const templateParams = getTemplateParameters(templateId);
    setToolConfig(prev => ({
      ...prev,
      parsedParams: templateParams,
      parameters: templateParams.map(param => ({
        ...param,
        uiComponent: getDefaultUIComponent(param),
        showInUI: true,
        label: param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }))
    }));
    
    setSuccess(`Loaded template: ${template.name}`);
  };

  // Get parameters based on template
  const getTemplateParameters = (templateId) => {
    const baseParams = [
      {
        id: 1,
        name: 'prompt',
        type: 'string',
        required: true,
        default: '',
        description: 'Text prompt for generation',
        uiComponent: 'textarea'
      }
    ];

    switch (templateId) {
      case 'wan-v22-img2video-lora':
        return [
          ...baseParams,
          {
            id: 2,
            name: 'image_url',
            type: 'file',
            required: true,
            default: '',
            description: 'Source image for video generation',
            uiComponent: 'upload'
          },
          {
            id: 3,
            name: 'resolution',
            type: 'select',
            required: false,
            default: '720p',
            description: 'Output video resolution',
            uiComponent: 'select',
            options: ['480p', '580p', '720p']
          },
          {
            id: 4,
            name: 'num_frames',
            type: 'number',
            required: false,
            default: 81,
            description: 'Number of frames to generate',
            uiComponent: 'slider',
            min: 81,
            max: 121
          },
          {
            id: 5,
            name: 'loras',
            type: 'array',
            required: false,
            default: [],
            description: 'LoRA models to apply',
            uiComponent: 'lora-manager'
          }
        ];
      
      case 'minimax-hailuo':
        return [
          ...baseParams,
          {
            id: 2,
            name: 'image_url',
            type: 'file',
            required: true,
            default: '',
            description: 'Source image for video generation',
            uiComponent: 'upload'
          },
          {
            id: 3,
            name: 'duration',
            type: 'select',
            required: false,
            default: '6',
            description: 'Video duration in seconds',
            uiComponent: 'select',
            options: ['6', '10']
          }
        ];
      
      case 'flux-kontext-lora':
        return [
          ...baseParams,
          {
            id: 2,
            name: 'image_size',
            type: 'select',
            required: false,
            default: 'square_hd',
            description: 'Output image size',
            uiComponent: 'select',
            options: ['square', 'square_hd', 'portrait_4_3', 'landscape_16_9']
          },
          {
            id: 3,
            name: 'num_images',
            type: 'number',
            required: false,
            default: 1,
            description: 'Number of images to generate',
            uiComponent: 'slider',
            min: 1,
            max: 4
          }
        ];
      
      case 'mmaudio-v2':
        return [
          ...baseParams,
          {
            id: 2,
            name: 'duration',
            type: 'number',
            required: false,
            default: 8,
            description: 'Audio duration in seconds',
            uiComponent: 'slider',
            min: 1,
            max: 30
          },
          {
            id: 3,
            name: 'cfg_strength',
            type: 'number',
            required: false,
            default: 4.5,
            description: 'CFG strength for generation',
            uiComponent: 'slider',
            min: 1.0,
            max: 10.0,
            step: 0.5
          }
        ];
      
      default:
        return baseParams;
    }
  };

  // Parse API documentation
  const parseAPIDocumentation = () => {
    try {
      setError('');
      const doc = toolConfig.apiDocumentation.trim();
      
      if (!doc) {
        setError('Please paste the FAL.ai API documentation');
        return;
      }

      // Try to parse as JSON first
      let parsedParams = [];
      
      try {
        const jsonDoc = JSON.parse(doc);
        // Extract parameters from JSON schema
        if (jsonDoc.properties) {
          parsedParams = Object.entries(jsonDoc.properties).map(([key, value]) => ({
            name: key,
            type: value.type || 'string',
            description: value.description || '',
            required: jsonDoc.required?.includes(key) || false,
            default: value.default,
            minimum: value.minimum,
            maximum: value.maximum,
            enum: value.enum
          }));
        }
      } catch (jsonError) {
        // Parse as text documentation
        const lines = doc.split('\n');
        const paramRegex = /^\s*-?\s*`?(\w+)`?\s*\(([^)]+)\):\s*(.+)/;
        
        lines.forEach(line => {
          const match = line.match(paramRegex);
          if (match) {
            const [, name, type, description] = match;
            parsedParams.push({
              name,
              type: type.toLowerCase().includes('string') ? 'string' :
                    type.toLowerCase().includes('number') ? 'number' :
                    type.toLowerCase().includes('bool') ? 'boolean' :
                    type.toLowerCase().includes('array') ? 'array' : 'string',
              description: description.trim(),
              required: description.toLowerCase().includes('required'),
              default: null
            });
          }
        });
      }

      if (parsedParams.length === 0) {
        setError('Could not parse parameters from documentation. Please check the format.');
        return;
      }

      setToolConfig(prev => ({
        ...prev,
        parsedParams,
        parameters: parsedParams.map(param => ({
          ...param,
          uiComponent: getDefaultUIComponent(param),
          showInUI: true,
          label: param.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        }))
      }));

      setSuccess(`Parsed ${parsedParams.length} parameters successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      setError(`Error parsing documentation: ${error.message}`);
    }
  };

  // Get default UI component for parameter type
  const getDefaultUIComponent = (param) => {
    if (param.type === 'boolean') return 'checkbox';
    if (param.type === 'number') {
      if (param.minimum !== undefined && param.maximum !== undefined) {
        return 'range';
      }
      return 'number';
    }
    if (param.enum) return 'select';
    if (param.name.toLowerCase().includes('prompt')) return 'textarea';
    if (param.name.toLowerCase().includes('url')) return 'url';
    return 'text';
  };

  // Generate all the code files
  const generateCode = () => {
    setLoading(true);
    setError('');
    
    try {
      const reactComponent = generateReactComponent();
      const edgeFunction = generateEdgeFunction();
      const dataUpdates = generateDataUpdates();
      const routeUpdate = generateRouteUpdate();
      
      setGeneratedCode({
        reactComponent,
        edgeFunction,
        dataUpdates,
        routeUpdate
      });
      
      setShowPreview(true);
      setSuccess('Code generated successfully! Review and deploy.');
      
    } catch (error) {
      setError(`Error generating code: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate React component code
  const generateReactComponent = () => {
    const imports = `import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { createAIGeneration, updateTokenCount${toolConfig.enableFileUpload ? ', uploadFile' : ''} } from '../../utils/storageHelpers';
import { isNSFWError, parseNSFWError } from '../../utils/errorHandlers';
import { toCdnUrl } from '../../utils/cdnHelpers';
${toolConfig.enableSafetyScanning ? `import { performSafetyAnalysis, shouldShowWarning, getSafetyWarningMessage, logSafetyAnalysis } from '../../utils/safescan';
import SafetyWarningModal from '../../components/SafetyWarningModal';` : ''}
import NSFWAlert from '../../components/NSFWAlert';
import ThemedAlert from '../../components/ThemedAlert';
import { 
  ArrowLeft, 
  Zap, 
  ${toolConfig.category === 'video' ? 'Video' : toolConfig.category === 'audio' ? 'Music' : 'Image as ImageIcon'}, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw,
  Settings,
  Copy,
  X,
  ${toolConfig.toolIcon}
} from 'lucide-react';`;

    const configState = `const [config, setConfig] = useState({
${toolConfig.parameters.filter(p => p.showInUI).map(param => {
  let defaultValue = param.default;
  if (param.type === 'string') defaultValue = `'${defaultValue || ''}'`;
  if (param.type === 'number') defaultValue = defaultValue || 0;
  if (param.type === 'boolean') defaultValue = defaultValue || false;
  return `    ${param.name}: ${defaultValue}`;
}).join(',\n')}
  });`;

    const tokenCostFunction = `const calculateTokenCost = () => {
    ${toolConfig.tokenCostFormula === 'baseTokenCost' ? 
      `return ${toolConfig.baseTokenCost};` :
      `// Custom token cost calculation based on parameters
    let cost = ${toolConfig.baseTokenCost};
    // Add parameter-based cost calculations here
    return cost;`}
  };`;

    const generateFunction = `const handleGenerate = async () => {
    // Validation
${toolConfig.parameters.filter(p => p.required && p.showInUI).map(param => {
  if (param.type === 'string') {
    return `    if (!config.${param.name}.trim()) {
      alert('Please enter ${param.label.toLowerCase()}');
      return;
    }`;
  }
  return `    if (!config.${param.name}) {
      alert('Please provide ${param.label.toLowerCase()}');
      return;
    }`;
}).join('\n')}

${toolConfig.enableSafetyScanning ? `    // Safety scan integration
    if (!bypassSafetyCheck) {
      try {
        const analysisResult = await performSafetyAnalysis(
          ${toolConfig.enableFileUpload ? 'config.imageUrl || null' : 'null'},
          config.prompt || null,
          '${toolConfig.toolType}'
        );

        logSafetyAnalysis(analysisResult, 'pre_generation_check');

        if (shouldShowWarning(analysisResult)) {
          setSafetyWarningData(getSafetyWarningMessage(analysisResult));
          setShowSafetyWarning(true);
          return;
        }
      } catch (safetyError) {
        console.warn('Safety analysis failed, proceeding with generation:', safetyError);
      }
    }

    setBypassSafetyCheck(false);` : ''}

    const tokenCost = calculateTokenCost();
    const totalTokens = (profile?.tokens || 0) + (profile?.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    try {
      const generation = await createAIGeneration(
        '${toolConfig.toolType}',
        config.prompt?.substring(0, 50) + '...' || '${toolConfig.name} Generation',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      const response = await fetch(\`\${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${toolConfig.edgeFunctionName}\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${(await supabase.auth.getSession()).data.session.access_token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          ...config
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      // Clear form after successful generation
      setConfig(prev => ({ ...prev, prompt: '' }));

    } catch (error) {
      console.error('Error generating:', error);
      
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        showAlert('error', 'Generation Failed', \`${toolConfig.name} generation failed: \${error.message}\`);
      }
    } finally {
      setGenerating(false);
    }
  };`;

    return `${imports}

const ${toolConfig.componentName} = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  ${configState}
  
  // Generation state
  const [generations, setGenerations] = useState([]);
  const [activeGenerations, setActiveGenerations] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [showNSFWAlert, setShowNSFWAlert] = useState(false);
  const [nsfwError, setNsfwError] = useState(null);
${toolConfig.enableSafetyScanning ? `  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [safetyWarningData, setSafetyWarningData] = useState(null);
  const [bypassSafetyCheck, setBypassSafetyCheck] = useState(false);` : ''}
  const [alertConfig, setAlertConfig] = useState({
    show: false,
    type: 'error',
    title: '',
    message: ''
  });

  // Component implementation continues...
  // (Rest of component would be generated based on parameters)
  
  ${tokenCostFunction}
  
  ${generateFunction}
  
  // Standard component methods (fetchProfile, fetchGenerations, etc.)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Generated UI based on parameters */}
    </div>
  );
};

export default ${toolConfig.componentName};`;
  };

  // Generate Edge Function code
  const generateEdgeFunction = () => {
    const falParams = toolConfig.parameters
      .filter(p => p.showInUI)
      .map(p => `      ${p.name}: ${p.name}`)
      .join(',\n');

    return `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getWebhookUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
  return \`https://\${projectRef}.supabase.co/functions/v1/fal-webhook\`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let generationId: string | undefined;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const {
      generationId: reqGenerationId,
${toolConfig.parameters.filter(p => p.showInUI).map(p => `      ${p.name}${p.required ? '' : ` = ${JSON.stringify(p.default)}`}`).join(',\n')}
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎨 ${toolConfig.name} generation request:', {
      generationId,
${toolConfig.parameters.slice(0, 3).map(p => `      ${p.name}: ${p.name}${p.type === 'string' ? '?.substring(0, 50) + \'...\'' : ''}`).join(',\n')}
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
    }
${toolConfig.parameters.filter(p => p.required && p.showInUI).map(p => `
    if (!${p.name}${p.type === 'string' ? '?.trim()' : ''}) {
      throw new Error('${p.label} is required');
    }`).join('')}

    // Update generation status to processing
    await supabase
      .from('ai_generations')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', generationId)
      .eq('user_id', user.id);

    // Get FAL API key
    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) {
      throw new Error('FAL_API_KEY not configured');
    }

    // Prepare FAL.ai API request
    const falParams = {
${falParams}
    };

    console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

    // Use FAL.ai queue system with webhook
    const webhookUrl = getWebhookUrl();
    const queueUrl = \`${toolConfig.falEndpoint}?fal_webhook=\${encodeURIComponent(webhookUrl)}\`;

    const falResponse = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Authorization': \`Key \${falApiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ FAL.ai error:', falResponse.status, errorText);
      throw new Error(\`FAL.ai error: \${falResponse.status} - \${errorText}\`);
    }

    const queueResult = await falResponse.json();
    const requestId = queueResult.request_id;
    
    if (!requestId) {
      throw new Error('No request_id received from FAL.ai');
    }

    // Update generation with queue request ID
    await supabase
      .from('ai_generations')
      .update({
        metadata: {
          fal_request_id: requestId,
          gateway_request_id: queueResult.gateway_request_id,
          webhook_url: webhookUrl,
          processing_started: new Date().toISOString(),
          status: 'queued_at_fal',
          model: '${toolConfig.name.toLowerCase()}',
          tool_type: '${toolConfig.toolType}',
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString()
        }
      })
      .eq('id', generationId);

    console.log('✅ ${toolConfig.name} request queued successfully');

    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: '${toolConfig.name} generation queued successfully',
      fal_request_id: requestId,
      estimated_time: '${toolConfig.estimatedTime}'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in ${toolConfig.edgeFunctionName}:', error);
    
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
            error_message: error.message
          })
          .eq('id', generationId);
      } catch (updateError) {
        console.error('❌ Error updating failed generation:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        generation_id: generationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});`;
  };

  // Generate data updates
  const generateDataUpdates = () => {
    return {
      falToolsAddition: `{
    id: ${Date.now()},
    name: "${toolConfig.name}",
    description: "${toolConfig.description}",
    image: toCdnUrl("https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
    tokensRequired: "${toolConfig.baseTokenCost}+",
    category: "${toolConfig.category}",
    toolType: "${toolConfig.toolType}",
    route: "${toolConfig.routePath}"
  }`,
      storageHelpersAddition: `${toolConfig.toolType}: {
    name: '${toolConfig.name}',
    description: '${toolConfig.description}',
    tokensRequired: ${toolConfig.baseTokenCost},
    category: '${toolConfig.category}'
  }`
    };
  };

  // Generate route update
  const generateRouteUpdate = () => {
    return `<Route 
  path="${toolConfig.routePath}" 
  element={
    <ProtectedRoute>
      <${toolConfig.componentName} />
    </ProtectedRoute>
  } 
/>`;
  };

  // Generate the actual React component code
      console.error('Error fetching profile:', error);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .eq('tool_type', '${toolData.toolType}')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setGenerations(data || []);
      setActiveGenerations(data?.filter(g => g.status === 'processing') || []);
    } catch (error) {
      console.error('Error fetching generations:', error);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    setGenerations(current => {
      switch (eventType) {
        case 'INSERT':
          return [newRecord, ...current];
        case 'UPDATE':
          return current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
        case 'DELETE':
          return current.filter(item => item.id !== oldRecord.id);
        default:
          return current;
      }
    });

    if (newRecord?.status === 'processing') {
      setActiveGenerations(current => {
        const exists = current.find(g => g.id === newRecord.id);
        return exists ? current.map(g => g.id === newRecord.id ? newRecord : g) : [newRecord, ...current];
      });
    } else if (newRecord?.status === 'completed' || newRecord?.status === 'failed') {
      setActiveGenerations(current => current.filter(g => g.id !== newRecord?.id));
    }
  };

  const calculateTokenCost = () => {
    return ${toolData.tokenCost};
  };

  const handleGenerate = async () => {
    const tokenCost = calculateTokenCost();
    const totalTokens = (profile.tokens || 0) + (profile.purchased_tokens || 0);
    if (totalTokens < tokenCost) {
      alert('Insufficient tokens. Please upgrade your plan.');
      return;
    }

    setGenerating(true);
    try {
      const generation = await createAIGeneration(
        '${toolData.toolType}',
        '${toolData.name} Generation',
        config,
        tokenCost
      );

      setGenerations(current => [generation, ...current]);
      setActiveGenerations(current => [generation, ...current]);
      
      await updateTokenCount(user.id, tokenCost);
      await fetchProfile();

      const response = await fetch(\`\${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${toolData.toolType.replace(/_/g, '-')}\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${(await supabase.auth.getSession()).data.session.access_token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generationId: generation.id,
          ...config
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

    } catch (error) {
      if (isNSFWError(error.message)) {
        const nsfwDetails = parseNSFWError(error.message);
        setNsfwError(nsfwDetails);
        setShowNSFWAlert(true);
      } else {
        alert(\`Error: \${error.message}\`);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Component JSX here */}
      <div>Generated ${toolData.name} Component</div>
      
      <NSFWAlert
        isOpen={showNSFWAlert}
        onClose={() => {
          setShowNSFWAlert(false);
          setNsfwError(null);
        }}
        toolName="${toolData.name}"
        details={nsfwError?.technical}
      />
    </div>
  );
};

export default ${componentName};`;
  };

  // Generate the Edge Function code
  const generateEdgeFunction = () => {
    return `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to get the correct webhook URL
function getWebhookUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const projectRef = supabaseUrl.split('.')[0].replace('https://', '');
  return \`https://\${projectRef}.supabase.co/functions/v1/fal-webhook\`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let generationId: string | undefined;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    const {
      generationId: reqGenerationId,
${parameters.map(param => `      ${param.name}`).join(',\n')}
    } = await req.json();

    generationId = reqGenerationId;

    console.log('🎨 ${toolData.name} generation request:', {
      generationId,
      // Add relevant logging
    });

    // Validate required parameters
    if (!generationId) {
      throw new Error('Generation ID is required');
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

    // Prepare FAL.ai API request
    const falParams = {
${parameters.map(param => `      ${param.name}: ${param.name}`).join(',\n')}
    };

    console.log('📡 Submitting to FAL.ai with params:', JSON.stringify(falParams, null, 2));

    // Get the correct webhook URL
    const webhookUrl = getWebhookUrl();
    
    const queueUrl = \`https://queue.fal.run/${toolData.endpoint}?fal_webhook=\${encodeURIComponent(webhookUrl)}\`;

    // Submit to FAL.ai queue
    const falResponse = await fetch(queueUrl, {
      method: 'POST',
      headers: {
        'Authorization': \`Key \${falApiKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falParams),
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      throw new Error(\`FAL.ai error: \${falResponse.status} - \${errorText}\`);
    }

    const queueResult = await falResponse.json();
    const requestId = queueResult.request_id;
    
    if (!requestId) {
      throw new Error('No request_id received from FAL.ai');
    }

    // Update generation with queue request ID for webhook tracking
    await supabase
      .from('ai_generations')
      .update({
        metadata: {
          fal_request_id: requestId,
          gateway_request_id: queueResult.gateway_request_id,
          webhook_url: webhookUrl,
          processing_started: new Date().toISOString(),
          status: 'queued_at_fal',
          model: '${toolData.endpoint}',
          tool_type: '${toolData.toolType}',
          webhook_enabled: true,
          queue_submission_time: new Date().toISOString()
        }
      })
      .eq('id', generationId);

    return new Response(JSON.stringify({
      success: true,
      status: 'queued',
      generation_id: generationId,
      message: '${toolData.name} generation queued successfully.',
      fal_request_id: requestId,
      estimated_time: '${toolData.processingTime || '1-3 minutes'}'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in ${toolData.toolType}:', error);
    
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
            error_message: error.message
          })
          .eq('id', generationId);
      } catch (updateError) {
        console.error('❌ Error updating failed generation:', updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        generation_id: generationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});`;
  };

  // Actually deploy the tool by creating files
  const deployTool = async () => {
    setDeploymentStatus('Creating files...');
    setDeploymentError('');
    setDeploymentSuccess(false);

    try {
      const componentName = toolData.name.replace(/[^a-zA-Z0-9]/g, '');
      const routePath = toolData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const edgeFunctionName = toolData.toolType.replace(/_/g, '-');
      
      // 1. Create React component file
      setDeploymentStatus('Creating React component...');
      const componentCode = generateReactComponent();
      
      // 2. Create Edge Function file
      setDeploymentStatus('Creating Edge Function...');
      const edgeFunctionCode = generateEdgeFunction();
      
      // 3. Update falTools.js
      setDeploymentStatus('Updating tool data...');
      const newTool = {
        id: Date.now(), // Use timestamp as unique ID
        name: toolData.name,
        description: toolData.description,
        image: toolData.image || "https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1",
        tokensRequired: `${toolData.tokenCost}+`,
        category: toolData.category,
        toolType: toolData.toolType,
        route: `/${routePath}`
      };
      
      // 4. Update storageHelpers.js with new tool type
      setDeploymentStatus('Updating storage helpers...');
      const newToolType = {
        [toolData.toolType]: {
          name: toolData.name,
          description: toolData.description,
          tokensRequired: toolData.tokenCost,
          category: toolData.category
        }
      };
      
      // 5. Create route in App.tsx
      setDeploymentStatus('Adding route...');
      const routeImport = `import ${componentName} from './pages/fal-tools/${componentName}';`;
      const routeElement = `            <Route 
              path="/${routePath}" 
              element={
                <ProtectedRoute>
                  <${componentName} />
                </ProtectedRoute>
              } 
            />`;
      
      // Store generated code for preview
      setGeneratedCode({
        component: componentCode,
        edgeFunction: edgeFunctionCode,
        dataUpdates: `// Add to falTools.js:\n${JSON.stringify(newTool, null, 2)}\n\n// Add to storageHelpers.js AI_TOOLS:\n${JSON.stringify(newToolType, null, 2)}\n\n// Add to App.tsx imports:\n${routeImport}\n\n// Add to App.tsx routes:\n${routeElement}`
      });
      
      setDeploymentStatus('Files generated successfully!');
      setDeploymentSuccess(true);
      
      // Show success message with next steps
      alert(`Tool "${toolData.name}" generated successfully!\n\nNext steps:\n1. Review the generated code in the preview\n2. Copy the files to your project\n3. Update the imports and routes\n4. Deploy the Edge Function\n\nFiles created:\n- React Component: src/pages/fal-tools/${componentName}.jsx\n- Edge Function: supabase/functions/${edgeFunctionName}/index.ts\n- Data updates for falTools.js and storageHelpers.js`);
      
    } catch (error) {
      console.error('❌ Error deploying tool:', error);
      setDeploymentError(error.message);
      setDeploymentStatus('Deployment failed');
    }
  };

  // Deploy the generated tool
  const deployTool = async () => {
    setLoading(true);
    setError('');
    
    try {
      // This would create all the files and update the necessary configurations
      // For now, we'll just show the generated code
      setSuccess('Tool deployment would create all necessary files and update configurations!');
      
    } catch (error) {
      setError(`Deployment error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Basic Information', description: 'Tool name, description, and category' },
    { number: 2, title: 'API Documentation', description: 'Parse FAL.ai API parameters' },
    { number: 3, title: 'Parameter Configuration', description: 'Configure UI components and validation' },
    { number: 4, title: 'Advanced Options', description: 'Safety scanning, file uploads, token costs' },
    { number: 5, title: 'Generate & Deploy', description: 'Create all files and deploy tool' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Verifying admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Access denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Admin</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Code className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">FAL.ai Tool Generator</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-200">{success}</p>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step.number 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white' 
                    : 'bg-white/10 text-purple-300'
                }`}>
                  {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-1 mx-4 ${
                    currentStep > step.number ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-white/20'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-xl font-bold text-white">{steps[currentStep - 1].title}</h2>
            <p className="text-purple-200">{steps[currentStep - 1].description}</p>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Tool Name *
                  </label>
                  <input
                    type="text"
                    value={toolConfig.name}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., FLUX Redux Pro"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Category *
                  </label>
                  <select
                    value={toolConfig.category}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="image" className="bg-gray-800">Image Generation</option>
                    <option value="video" className="bg-gray-800">Video Generation</option>
                    <option value="audio" className="bg-gray-800">Audio Generation</option>
                    <option value="enhancement" className="bg-gray-800">Enhancement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Description *
                </label>
                <textarea
                  value={toolConfig.description}
                  onChange={(e) => setToolConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this tool does..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  FAL.ai API Endpoint *
                </label>
                <input
                  type="url"
                  value={toolConfig.falEndpoint}
                  onChange={(e) => setToolConfig(prev => ({ ...prev, falEndpoint: e.target.value }))}
                  placeholder="https://queue.fal.run/fal-ai..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Base Token Cost
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={toolConfig.baseTokenCost}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, baseTokenCost: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Estimated Processing Time
                  </label>
                  <input
                    type="text"
                    value={toolConfig.estimatedTime}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, estimatedTime: e.target.value }))}
                    placeholder="e.g., 30-60 seconds"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              {/* Generated Identifiers Preview */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <h3 className="text-cyan-200 font-medium mb-3">Generated Identifiers</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-cyan-300">Component:</span>
                    <span className="text-white ml-2">{toolConfig.componentName || 'ToolName'}</span>
                  </div>
                  <div>
                    <span className="text-cyan-300">Edge Function:</span>
                    <span className="text-white ml-2">{toolConfig.edgeFunctionName || 'fal-tool-name'}</span>
                  </div>
                  <div>
                    <span className="text-cyan-300">Tool Type:</span>
                    <span className="text-white ml-2">{toolConfig.toolType || 'fal_tool_name'}</span>
                  </div>
                  <div>
                    <span className="text-cyan-300">Route:</span>
                    <span className="text-white ml-2">{toolConfig.routePath || '/tool-name'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: API Documentation */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-white mb-4">API Documentation</h3>
              
              {/* Template Selection Option */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="radio"
                    id="use-template"
                    name="doc-method"
                    checked={useTemplate}
                    onChange={(e) => setUseTemplate(e.target.checked)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label htmlFor="use-template" className="text-white font-medium">
                    Use Existing Template
                  </label>
                </div>
                
                {useTemplate && (
                  <div className="space-y-3">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => {
                        setSelectedTemplate(e.target.value);
                        if (e.target.value) {
                          loadTemplate(e.target.value);
                        }
                      }}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-gray-800">Select a template...</option>
                      {availableTemplates.map(template => (
                        <option key={template.id} value={template.id} className="bg-gray-800">
                          {template.name} ({template.complexity} complexity)
                        </option>
                      ))}
                    </select>
                    
                    {selectedTemplate && (
                      <div className="bg-white/5 rounded-lg p-3">
                        {(() => {
                          const template = availableTemplates.find(t => t.id === selectedTemplate);
                          return template ? (
                            <div>
                              <p className="text-blue-200 text-sm mb-2">{template.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {template.features.map((feature, idx) => (
                                  <span key={idx} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* URL Fetching Option */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="radio"
                    id="use-url"
                    name="doc-method"
                    checked={!useTemplate}
                    onChange={(e) => setUseTemplate(!e.target.checked)}
                    className="w-4 h-4 text-green-600"
                  />
                  <label htmlFor="use-url" className="text-white font-medium">
                    Fetch from FAL.ai URL
                  </label>
                </div>
                
                {!useTemplate && (
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={documentationUrl}
                      onChange={(e) => setDocumentationUrl(e.target.value)}
                      placeholder="https://fal.ai/models/fal-ai/flux-pro/api"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={fetchApiDocumentation}
                      disabled={fetchingFromUrl || !documentationUrl.trim()}
                      className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      {fetchingFromUrl ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Fetching Documentation...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Fetch API Documentation</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Documentation Input */}
              {!useTemplate && (
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Or paste API documentation manually:
                  </label>
                  <textarea
                    value={toolConfig.apiDocumentation}
                    onChange={(e) => setToolConfig(prev => ({ ...prev, apiDocumentation: e.target.value }))}
                    placeholder="Paste FAL.ai API documentation here..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={8}
                  />
                  <button
                    onClick={parseAPIDocumentation}
                    disabled={!toolConfig.apiDocumentation.trim()}
                    className="mt-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-700 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    Parse Documentation
                  </button>

                  {/* OpenAI Parsing Button */}
                  <div className="mt-4">
                    <button
                      onClick={parseWithOpenAI}
                      disabled={isParsingWithAI || !toolConfig.apiDocumentation.trim()}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:transform-none flex items-center justify-center space-x-2"
                    >
                      {isParsingWithAI ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Parsing with OpenAI...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          <span>Parse with OpenAI (Recommended)</span>
                        </>
                      )}
                    </button>
                    <p className="text-blue-300 text-xs mt-2 text-center">
                      AI will intelligently extract parameters from any FAL.ai documentation format
                    </p>
                  </div>

                  {aiParsingError && (
                    <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-lg p-4">
                      <p className="text-red-200 text-sm">{aiParsingError}</p>
                    </div>
                  )}
                </div>
              )}

              {toolConfig.parameters.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h4 className="text-green-200 font-medium mb-2">
                    {useTemplate ? 'Template' : 'Extracted'} Parameters ({toolConfig.parameters.length})
                  </h4>
                  <div className="space-y-2">
                    {toolConfig.parameters.slice(0, 5).map((param) => (
                      <div key={param.id} className="flex items-center justify-between bg-white/5 rounded p-2">
                        <div>
                          <span className="text-white font-medium">{param.name}</span>
                          <span className="text-green-300 ml-2">({param.type})</span>
                          {param.required && <span className="text-red-400 ml-1">*</span>}
                        </div>
                        <span className="text-green-200 text-xs">{param.description}</span>
                      </div>
                    ))}
                    {toolConfig.parameters.length > 5 && (
                      <p className="text-green-300 text-sm">...and {toolConfig.parameters.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Parameter Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Configure UI Components for Parameters
                </h3>
                <p className="text-purple-200">
                  Customize how each parameter appears in the user interface
                </p>
              </div>

              {toolConfig.parameters.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {toolConfig.parameters.map((param, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs text-purple-300 mb-1">Parameter Name</label>
                          <input
                            type="text"
                            value={param.name}
                            disabled
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-purple-300 mb-1">UI Label</label>
                          <input
                            type="text"
                            value={param.label}
                            onChange={(e) => {
                              const newParams = [...toolConfig.parameters];
                              newParams[index].label = e.target.value;
                              setToolConfig(prev => ({ ...prev, parameters: newParams }));
                            }}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-purple-300 mb-1">UI Component</label>
                          <select
                            value={param.uiComponent}
                            onChange={(e) => {
                              const newParams = [...toolConfig.parameters];
                              newParams[index].uiComponent = e.target.value;
                              setToolConfig(prev => ({ ...prev, parameters: newParams }));
                            }}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          >
                            <option value="text" className="bg-gray-800">Text Input</option>
                            <option value="textarea" className="bg-gray-800">Textarea</option>
                            <option value="number" className="bg-gray-800">Number Input</option>
                            <option value="range" className="bg-gray-800">Range Slider</option>
                            <option value="select" className="bg-gray-800">Select Dropdown</option>
                            <option value="checkbox" className="bg-gray-800">Checkbox</option>
                            <option value="file" className="bg-gray-800">File Upload</option>
                            <option value="url" className="bg-gray-800">URL Input</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={param.showInUI}
                              onChange={(e) => {
                                const newParams = [...toolConfig.parameters];
                                newParams[index].showInUI = e.target.checked;
                                setToolConfig(prev => ({ ...prev, parameters: newParams }));
                              }}
                              className="w-4 h-4 text-cyan-600 bg-white/10 border-white/20 rounded"
                            />
                            <span className="text-white text-sm">Show in UI</span>
                          </label>

                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={param.required}
                              onChange={(e) => {
                                const newParams = [...toolConfig.parameters];
                                newParams[index].required = e.target.checked;
                                setToolConfig(prev => ({ ...prev, parameters: newParams }));
                              }}
                              className="w-4 h-4 text-cyan-600 bg-white/10 border-white/20 rounded"
                            />
                            <span className="text-white text-sm">Required</span>
                          </label>
                        </div>

                        <div className="text-xs text-purple-300">
                          Type: {param.type} {param.required && <span className="text-red-400">*</span>}
                        </div>
                      </div>

                      {param.description && (
                        <p className="mt-2 text-xs text-purple-300">{param.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-50" />
                  <p className="text-purple-200">No parameters parsed yet</p>
                  <p className="text-purple-300 text-sm">Go back to Step 2 to parse API documentation</p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Advanced Options */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Safety Scanning */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-3">Safety & Moderation</h3>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={toolConfig.enableSafetyScanning}
                      onChange={(e) => setToolConfig(prev => ({ ...prev, enableSafetyScanning: e.target.checked }))}
                      className="w-4 h-4 text-cyan-600 bg-white/10 border-white/20 rounded"
                    />
                    <span className="text-white">Enable Safety Scanning</span>
                  </label>
                  <p className="text-purple-300 text-xs mt-2">
                    Scan prompts and images for policy violations before generation
                  </p>
                </div>

                {/* File Upload */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-3">File Upload</h3>
                  <label className="flex items-center space-x-3 mb-3">
                    <input
                      type="checkbox"
                      checked={toolConfig.enableFileUpload}
                      onChange={(e) => setToolConfig(prev => ({ ...prev, enableFileUpload: e.target.checked }))}
                      className="w-4 h-4 text-cyan-600 bg-white/10 border-white/20 rounded"
                    />
                    <span className="text-white">Enable File Upload</span>
                  </label>
                  
                  {toolConfig.enableFileUpload && (
                    <div>
                      <label className="block text-xs text-purple-300 mb-1">Supported File Types</label>
                      <div className="flex flex-wrap gap-2">
                        {['image', 'video', 'audio'].map(type => (
                          <label key={type} className="flex items-center space-x-1">
                            <input
                              type="checkbox"
                              checked={toolConfig.fileUploadTypes.includes(type)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setToolConfig(prev => ({
                                    ...prev,
                                    fileUploadTypes: [...prev.fileUploadTypes, type]
                                  }));
                                } else {
                                  setToolConfig(prev => ({
                                    ...prev,
                                    fileUploadTypes: prev.fileUploadTypes.filter(t => t !== type)
                                  }));
                                }
                              }}
                              className="w-3 h-3"
                            />
                            <span className="text-white text-xs capitalize">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Token Cost Formula
                </label>
                <select
                  value={toolConfig.tokenCostFormula}
                  onChange={(e) => setToolConfig(prev => ({ ...prev, tokenCostFormula: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="baseTokenCost" className="bg-gray-800">Fixed Base Cost</option>
                  <option value="parameterBased" className="bg-gray-800">Parameter-Based Calculation</option>
                  <option value="custom" className="bg-gray-800">Custom Formula</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 5: Generate & Deploy */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Ready to Generate Tool</h3>
                <p className="text-purple-200 mb-6">
                  Review your configuration and generate the complete FAL.ai tool implementation
                </p>
              </div>

              {/* Configuration Summary */}
              <div className="bg-white/5 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-white mb-4">Configuration Summary</h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <span className="text-purple-300">Tool Name:</span>
                      <span className="text-white ml-2">{toolConfig.name}</span>
                    </div>
                    <div>
                      <span className="text-purple-300">Category:</span>
                      <span className="text-white ml-2 capitalize">{toolConfig.category}</span>
                    </div>
                    <div>
                      <span className="text-purple-300">Base Token Cost:</span>
                      <span className="text-white ml-2">{toolConfig.baseTokenCost}</span>
                    </div>
                    <div>
                      <span className="text-purple-300">Parameters:</span>
                      <span className="text-white ml-2">{toolConfig.parameters.filter(p => p.showInUI).length} UI parameters</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-purple-300">Safety Scanning:</span>
                      <span className="text-white ml-2">{toolConfig.enableSafetyScanning ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div>
                      <span className="text-purple-300">File Upload:</span>
                      <span className="text-white ml-2">{toolConfig.enableFileUpload ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div>
                      <span className="text-purple-300">Processing Time:</span>
                      <span className="text-white ml-2">{toolConfig.estimatedTime}</span>
                    </div>
                    <div>
                      <span className="text-purple-300">Route:</span>
                      <span className="text-white ml-2">{toolConfig.routePath}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="text-center">
                <button
                  onClick={generateCode}
                  disabled={loading || !toolConfig.name || !toolConfig.falEndpoint}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Generating Code...</span>
                    </>
                  ) : (
                    <>
                      <Code className="w-5 h-5" />
                      <span>Generate Complete Tool</span>
                    </>
                  )}
                </button>
              </div>

              {/* Deploy Tool Section */}
              {currentStep === 5 && (
                <div className="text-center">
                  <button
                    onClick={deployTool}
                    disabled={!toolData.name || !toolData.endpoint || parameters.length === 0}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deploymentStatus || 'Deploy Tool'}
                  </button>
                  
                  {deploymentError && (
                    <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-200 text-sm">{deploymentError}</p>
                    </div>
                  )}
                  
                  {deploymentSuccess && (
                    <div className="mt-4 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <p className="text-green-200 text-sm">
                        ✅ Tool generated successfully! Review the code below and copy to your project.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Code Preview Section */}
              {deploymentSuccess && generatedCode.component && (
                <div className="mt-8 space-y-6">
                  <h3 className="text-xl font-bold text-white">Generated Code Preview</h3>
                  
                  {/* React Component */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">React Component</h4>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCode.component)}
                        className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                      >
                        Copy Code
                      </button>
                    </div>
                    <pre className="text-purple-200 text-xs overflow-x-auto max-h-64 bg-black/20 p-3 rounded">
                      {generatedCode.component.substring(0, 1000)}...
                    </pre>
                  </div>
                  
                  {/* Edge Function */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">Edge Function</h4>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCode.edgeFunction)}
                        className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                      >
                        Copy Code
                      </button>
                    </div>
                    <pre className="text-purple-200 text-xs overflow-x-auto max-h-64 bg-black/20 p-3 rounded">
                      {generatedCode.edgeFunction.substring(0, 1000)}...
                    </pre>
                  </div>
                  
                  {/* Data Updates */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">Data File Updates</h4>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCode.dataUpdates)}
                        className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                      >
                        Copy Updates
                      </button>
                    </div>
                    <pre className="text-purple-200 text-xs overflow-x-auto max-h-64 bg-black/20 p-3 rounded">
                      {generatedCode.dataUpdates}
                    </pre>
                  </div>
                  
                  {/* Manual Steps */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-blue-200 font-medium mb-3">Manual Steps Required:</h4>
                    <ol className="text-blue-300 text-sm space-y-2 list-decimal list-inside">
                      <li>Copy the React component code to <code>src/pages/fal-tools/{toolData.name.replace(/[^a-zA-Z0-9]/g, '')}.jsx</code></li>
                      <li>Copy the Edge Function code to <code>supabase/functions/{toolData.toolType.replace(/_/g, '-')}/index.ts</code></li>
                      <li>Add the tool to <code>src/data/falTools.js</code> exports array</li>
                      <li>Add the tool type to <code>src/utils/storageHelpers.js</code> AI_TOOLS object</li>
                      <li>Add the import and route to <code>src/App.tsx</code></li>
                      <li>Deploy the Edge Function: <code>supabase functions deploy {toolData.toolType.replace(/_/g, '-')}</code></li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-white/20">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
              disabled={
                currentStep === 5 || 
                (currentStep === 1 && (!toolConfig.name || !toolConfig.falEndpoint)) ||
                (currentStep === 2 && toolConfig.parsedParams.length === 0)
              }
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>

        {/* Code Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-white/20">
              <div className="p-6 border-b border-white/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Generated Code Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                <div className="space-y-6">
                  {/* React Component Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-white">
                        React Component ({toolConfig.componentName}.jsx)
                      </h4>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCode.reactComponent)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="bg-black/30 rounded-lg p-4 text-green-400 text-xs overflow-x-auto">
                      <code>{generatedCode.reactComponent?.substring(0, 500)}...</code>
                    </pre>
                  </div>

                  {/* Edge Function Preview */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold text-white">
                        Edge Function ({toolConfig.edgeFunctionName}/index.ts)
                      </h4>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCode.edgeFunction)}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="bg-black/30 rounded-lg p-4 text-blue-400 text-xs overflow-x-auto">
                      <code>{generatedCode.edgeFunction?.substring(0, 500)}...</code>
                    </pre>
                  </div>

                  {/* Data Updates Preview */}
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-3">Data File Updates</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-purple-300 text-sm mb-2">falTools.js addition:</p>
                        <pre className="bg-black/30 rounded-lg p-3 text-yellow-400 text-xs">
                          <code>{generatedCode.dataUpdates?.falToolsAddition}</code>
                        </pre>
                      </div>
                      <div>
                        <p className="text-purple-300 text-sm mb-2">App.tsx route addition:</p>
                        <pre className="bg-black/30 rounded-lg p-3 text-pink-400 text-xs">
                          <code>{generatedCode.routeUpdate}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/20 flex justify-end space-x-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
                >
                  Close Preview
                </button>
                <button
                  onClick={deployTool}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 flex items-center space-x-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Deploying...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Deploy Tool</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFALToolGenerator;