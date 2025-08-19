import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Upload,
  Check,
  AlertCircle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';

const AdminLoraManager = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loras, setLoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLora, setEditingLora] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    path: '',
    weight_name: '',
    tool_types: [],
    tier_access: [],
    default_scale: 1.0,
    default_transformer: 'high',
    trigger_words: [],
    category: 'style',
    sort_order: 0,
    is_active: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Simple admin check - same as your working Admin component
  const adminUUIDs = [
    '991e17a6-c1a8-4496-8b28-cc83341c028a' // jim@1busyguy.com
  ];
  
  const isAdmin = user && (
    adminUUIDs.includes(user.id) || 
    user.email === 'jim@1busyguy.com' || 
    user.user_metadata?.email === 'jim@1busyguy.com'
  );

  useEffect(() => {
    if (user) {
      fetchLoras();
    }
  }, [user]);

  // Existing functions remain unchanged
  const fetchLoras = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('preset_loras')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setLoras(data || []);
    } catch (error) {
      console.error('Error fetching LoRAs:', error);
      setError('Error fetching LoRAs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validation
    if (!formData.title || !formData.path || !formData.weight_name) {
      setError('Title, Path, and Weight Name are required');
      return;
    }

    if (formData.tool_types.length === 0) {
      setError('Please select at least one tool type');
      return;
    }

    if (formData.tier_access.length === 0) {
      setError('Please select at least one tier access level');
      return;
    }
    
    try {
      if (editingLora) {
        // Update existing
        const { error } = await supabase
          .from('preset_loras')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingLora.id);

        if (error) throw error;
        setSuccess('LoRA updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('preset_loras')
          .insert([formData]);

        if (error) throw error;
        setSuccess('LoRA created successfully');
      }

      setFormData({
        title: '',
        description: '',
        path: '',
        weight_name: '',
        tool_types: [],
        tier_access: [],
        default_scale: 1.0,
        default_transformer: 'high',
        trigger_words: [],
        category: 'style',
        sort_order: 0,
        is_active: true
      });
      setEditingLora(null);
      setShowAddForm(false);
      fetchLoras();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving LoRA:', error);
      setError('Error saving LoRA: ' + error.message);
    }
  };

  const handleEdit = (lora) => {
    setFormData({
      ...lora,
      tool_types: lora.tool_types || [],
      tier_access: lora.tier_access || [],
      trigger_words: lora.trigger_words || []
    });
    setEditingLora(lora);
    setShowAddForm(true);
    setError('');
    setSuccess('');
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('preset_loras')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchLoras();
      setSuccess('LoRA deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting LoRA:', error);
      setError('Error deleting LoRA: ' + error.message);
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      const { error } = await supabase
        .from('preset_loras')
        .update({ 
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      fetchLoras();
    } catch (error) {
      console.error('Error toggling LoRA status:', error);
      setError('Failed to toggle LoRA status');
    }
  };

  const handleTriggerWordChange = (value) => {
    const words = value.split(',').map(w => w.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, trigger_words: words }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-white/20" />
              <h1 className="text-xl font-bold text-white">Preset LoRA Manager</h1>
            </div>
            
            <button
              onClick={fetchLoras}
              className="text-purple-200 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-200">{error}</p>
              <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-200">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Manage Preset LoRAs</h2>
            {!showAddForm && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingLora(null);
                  setFormData({
                    title: '',
                    description: '',
                    path: '',
                    weight_name: '',
                    tool_types: [],
                    tier_access: [],
                    default_scale: 1.0,
                    default_transformer: 'high',
                    trigger_words: [],
                    category: 'style',
                    sort_order: 0,
                    is_active: true
                  });
                  setError('');
                  setSuccess('');
                }}
                className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add New LoRA</span>
              </button>
            )}
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="mb-6 p-6 bg-white/5 rounded-lg border border-violet-500/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  {editingLora ? 'Edit LoRA' : 'Add New LoRA'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingLora(null);
                    setError('');
                    setSuccess('');
                  }}
                  className="text-purple-400 hover:text-purple-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="e.g., Cinematic Look"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Weight Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.weight_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, weight_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="e.g., wan_cinematic_v2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-purple-200 mb-1">Path (URL) *</label>
                  <input
                    type="url"
                    required
                    value={formData.path}
                    onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="https://civitai.com/api/download/models/..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-purple-200 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    rows={2}
                    placeholder="Brief description of what this LoRA does..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Tool Types *</label>
                    <div className="space-y-2">
                      {['i2v', 't2v', 'both'].map(type => (
                        <label key={type} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.tool_types.includes(type)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  tool_types: [...prev.tool_types, type]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  tool_types: prev.tool_types.filter(t => t !== type)
                                }));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-white">
                            {type === 'i2v' ? 'Image to Video' : 
                             type === 't2v' ? 'Text to Video' : 
                             'Both'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Tier Access *</label>
                    <div className="space-y-2">
                      {['free', 'pro', 'business'].map(tier => (
                        <label key={tier} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={formData.tier_access.includes(tier)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  tier_access: [...prev.tier_access, tier]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  tier_access: prev.tier_access.filter(t => t !== tier)
                                }));
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-white capitalize">{tier}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="style" className="bg-gray-800">Style</option>
                      <option value="lighting" className="bg-gray-800">Lighting</option>
                      <option value="motion" className="bg-gray-800">Motion</option>
                      <option value="character" className="bg-gray-800">Character</option>
                      <option value="other" className="bg-gray-800">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Default Scale</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={formData.default_scale}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_scale: parseFloat(e.target.value) }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Transformer</label>
                    <select
                      value={formData.default_transformer}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_transformer: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="high" className="bg-gray-800">High</option>
                      <option value="low" className="bg-gray-800">Low</option>
                      <option value="both" className="bg-gray-800">Both</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-purple-200 mb-1">
                    Trigger Words (comma separated)
                  </label>
                  <input
                    type="text"
                    value={formData.trigger_words.join(', ')}
                    onChange={(e) => handleTriggerWordChange(e.target.value)}
                    placeholder="cinematic, film, movie"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-purple-200 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div className="flex items-center space-x-2 mt-6">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <label htmlFor="is_active" className="text-white">Active</label>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingLora ? 'Update' : 'Create'} LoRA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingLora(null);
                      setError('');
                      setSuccess('');
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* LoRA List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-400 mx-auto"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 text-purple-200">Title</th>
                    <th className="text-left py-3 px-4 text-purple-200">Category</th>
                    <th className="text-left py-3 px-4 text-purple-200">Tools</th>
                    <th className="text-left py-3 px-4 text-purple-200">Tiers</th>
                    <th className="text-left py-3 px-4 text-purple-200">Status</th>
                    <th className="text-left py-3 px-4 text-purple-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loras.map((lora) => (
                    <tr key={lora.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{lora.title}</p>
                          <p className="text-purple-300 text-sm">{lora.weight_name}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-purple-200">{lora.category}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {(lora.tool_types || []).map(type => (
                            <span key={type} className="px-2 py-1 bg-violet-500/20 text-violet-300 text-xs rounded">
                              {type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {(lora.tier_access || []).map(tier => (
                            <span key={tier} className={`px-2 py-1 text-xs rounded ${
                              tier === 'business' ? 'bg-purple-500/20 text-purple-300' :
                              tier === 'pro' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {tier}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleActive(lora.id, lora.is_active)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            lora.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {lora.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(lora)}
                            className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lora.id, lora.title)}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {loras.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-purple-300">No preset LoRAs found</p>
                  <p className="text-purple-400 text-sm mt-2">Click "Add New LoRA" to create one</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLoraManager;