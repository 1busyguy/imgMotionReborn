import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Sparkles, 
  Crown,
  Building2,
  Lock,
  Check
} from 'lucide-react';

const PresetLoraSelector = ({ 
  toolType, // 'i2v' or 't2v'
  userTier, // 'free', 'pro', or 'business'
  currentLoras,
  onAddLora,
  maxLoras = 2
}) => {
  const [presetLoras, setPresetLoras] = useState([]);
  const [showPresets, setShowPresets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchPresetLoras();
  }, [toolType, userTier]);

  const fetchPresetLoras = async () => {
    try {
      setLoading(true);
      
      // Fetch LoRAs that match the tool type and user has access to
      const { data, error } = await supabase
        .from('preset_loras')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Filter based on tool type and tier access
      const filtered = data.filter(lora => {
        const toolMatch = lora.tool_types.includes(toolType) || lora.tool_types.includes('both');
        const tierMatch = lora.tier_access.includes(userTier) || 
                          (userTier === 'business' && lora.tier_access.includes('pro')) ||
                          (userTier === 'pro' && lora.tier_access.includes('free')) ||
                          (userTier === 'business' && lora.tier_access.includes('free'));
        return toolMatch && tierMatch;
      });

      setPresetLoras(filtered);
    } catch (error) {
      console.error('Error fetching preset LoRAs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierIcon = (tierAccess) => {
    if (tierAccess.includes('business')) {
      return <Building2 className="w-3 h-3" />;
    } else if (tierAccess.includes('pro')) {
      return <Crown className="w-3 h-3" />;
    } else {
      return <Sparkles className="w-3 h-3" />;
    }
  };

  const getTierColor = (tierAccess) => {
    if (tierAccess.includes('business')) {
      return 'text-purple-400 bg-purple-500/20';
    } else if (tierAccess.includes('pro')) {
      return 'text-yellow-400 bg-yellow-500/20';
    } else {
      return 'text-green-400 bg-green-500/20';
    }
  };

  const canAccessLora = (lora) => {
    if (userTier === 'business') return true;
    if (userTier === 'pro') {
      return !lora.tier_access.includes('business') || lora.tier_access.includes('pro');
    }
    return lora.tier_access.includes('free');
  };

  const handleAddPresetLora = (lora) => {
    if (currentLoras.length >= maxLoras) {
      alert(`Maximum ${maxLoras} LoRAs allowed`);
      return;
    }

    if (!canAccessLora(lora)) {
      alert('This LoRA requires a higher subscription tier');
      return;
    }

    // Check if already added
    const exists = currentLoras.some(l => l.path === lora.path);
    if (exists) {
      alert('This LoRA has already been added');
      return;
    }

    onAddLora({
      path: lora.path,
      weight_name: lora.weight_name,
      scale: lora.default_scale,
      transformer: lora.default_transformer
    });
  };

  const categories = ['all', ...new Set(presetLoras.map(l => l.category).filter(Boolean))];

  const filteredLoras = selectedCategory === 'all' 
    ? presetLoras 
    : presetLoras.filter(l => l.category === selectedCategory);

  if (currentLoras.length >= maxLoras) {
    return null; // Don't show if max LoRAs reached
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setShowPresets(!showPresets)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-lg border border-violet-500/30 hover:border-violet-400/50 transition-all"
      >
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-white font-medium">Preset LoRA Library</span>
          <span className="text-violet-300 text-sm">
            ({filteredLoras.length} available for your tier)
          </span>
        </div>
        {showPresets ? (
          <ChevronUp className="w-4 h-4 text-violet-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-violet-400" />
        )}
      </button>

      {showPresets && (
        <div className="mt-3 p-4 bg-white/5 rounded-lg border border-white/10">
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto"></div>
              <p className="text-purple-300 text-sm mt-2">Loading preset LoRAs...</p>
            </div>
          ) : (
            <>
              {/* Category Filter */}
              {categories.length > 2 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        selectedCategory === cat
                          ? 'bg-violet-500 text-white'
                          : 'bg-white/10 text-purple-300 hover:bg-white/20'
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {/* LoRA Grid */}
              <div className="grid gap-3 max-h-96 overflow-y-auto pr-2">
                {filteredLoras.map((lora) => {
                  const isAccessible = canAccessLora(lora);
                  const isAdded = currentLoras.some(l => l.path === lora.path);
                  
                  return (
                    <div
                      key={lora.id}
                      className={`p-3 rounded-lg border transition-all ${
                        !isAccessible 
                          ? 'bg-gray-500/10 border-gray-500/30 opacity-60'
                          : isAdded
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-white/5 border-white/20 hover:bg-white/10 hover:border-violet-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="text-white font-medium text-sm truncate">
                              {lora.title}
                            </h4>
                            <div className={`px-2 py-0.5 rounded-full flex items-center space-x-1 ${getTierColor(lora.tier_access)}`}>
                              {getTierIcon(lora.tier_access)}
                              <span className="text-xs">
                                {lora.tier_access.includes('business') ? 'Business' :
                                 lora.tier_access.includes('pro') ? 'Pro' : 'Free'}
                              </span>
                            </div>
                          </div>
                          
                          <p className="text-purple-300 text-xs mb-2">
                            {lora.description}
                          </p>
                          
                          {lora.trigger_words && lora.trigger_words.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              <span className="text-xs text-purple-400">Triggers:</span>
                              {lora.trigger_words.map((word, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded">
                                  {word}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-3 text-xs text-purple-400">
                            <span>Scale: {lora.default_scale}</span>
                            <span>Transform: {lora.default_transformer}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleAddPresetLora(lora)}
                          disabled={!isAccessible || isAdded}
                          className={`ml-3 p-2 rounded-lg transition-all ${
                            !isAccessible
                              ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed'
                              : isAdded
                              ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                              : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-400'
                          }`}
                          title={
                            !isAccessible ? 'Requires higher tier' :
                            isAdded ? 'Already added' :
                            'Add this LoRA'
                          }
                        >
                          {!isAccessible ? (
                            <Lock className="w-4 h-4" />
                          ) : isAdded ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {filteredLoras.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-purple-300">No preset LoRAs available for your tier</p>
                    <p className="text-purple-400 text-sm mt-2">
                      Upgrade to Pro or Business to access more LoRAs
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PresetLoraSelector;