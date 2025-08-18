import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { toCdnUrl } from '../utils/cdnHelpers';
import { subscriptionTiers, tokenPackages } from '../data/data';
import { createCheckoutSession } from '../lib/stripeHelpers';
import { cancelSubscription, getSubscriptionDetails } from '../lib/subscriptionHelpers';
import { processAvatarImage, validateImageFile } from '../utils/imageUtils';
import { uploadFile, deleteFile } from '../utils/storageHelpers';
import { 
  Zap, 
  ArrowLeft, 
  User, 
  CreditCard, 
  Mail, 
  AtSign, 
  FileText, 
  Twitter, 
  Instagram, 
  LogOut,
  Trash2,
  Check,
  AlertTriangle,
  Camera,
  ShoppingCart,
  Package,
  Shield
} from 'lucide-react';

const Settings = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileData, setProfileData] = useState({
    username: '',
    bio: '',
    avatar_url: '',
    twitter: '',
    instagram: ''
  });
  const navigate = useNavigate();

  // Check if user is admin using UUID (more reliable than email)
  const adminUUIDs = [
    '991e17a6-c1a8-4496-8b28-cc83341c028a' // jim@1busyguy.com
  ];
  
  const isAdmin = user && (
    adminUUIDs.includes(user.id) || 
    user.email === 'jim@1busyguy.com' || 
    user.user_metadata?.email === 'jim@1busyguy.com'
  );
  
  useEffect(() => {
    getUser();
    
    // Check URL params for tab
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'billing') {
      setActiveTab('billing');
    }
  }, []);

  const getUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      setUser(user);

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        setProfile(profile);
        setProfileData({
          username: profile.username || '',
          bio: profile.bio || '',
          avatar_url: profile.avatar_url || '',
          twitter: profile.twitter || '',
          instagram: profile.instagram || ''
        });
      }

      // Get subscription details
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (subscriptionData) {
        setSubscription(subscriptionData);
      }
    } catch (error) {
      console.error('Error getting user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file
    const validationErrors = validateImageFile(file);
    if (validationErrors.length > 0) {
      alert(validationErrors.join('\n'));
      return;
    }

    setUploadingAvatar(true);

    try {
      // Process the image (crop, resize, compress)
      const processedBlob = await processAvatarImage(file, 150);
      
      // Create file name
      const fileExt = 'jpg'; // Always save as JPG after processing
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        try {
          // Extract path from URL for deletion
          const urlParts = profile.avatar_url.split('/');
          const oldPath = urlParts.slice(-3).join('/'); // user_id/avatars/filename
          await deleteFile(oldPath);
        } catch (deleteError) {
          console.warn('Could not delete old avatar:', deleteError);
        }
      }

      // Upload new avatar using storage helper
      const { url: publicUrl } = await uploadFile(processedBlob, 'avatars', fileName);

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      // Update local state
      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      setProfileData(prev => ({ ...prev, avatar_url: publicUrl }));

      alert('Avatar uploaded successfully!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert(`Error uploading avatar: ${error.message}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: profileData.username,
          bio: profileData.bio,
          twitter: profileData.twitter,
          instagram: profileData.instagram
        })
        .eq('id', user.id);

      if (error) throw error;

      // Update local profile state
      setProfile(prev => ({
        ...prev,
        ...profileData
      }));

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribe = async (tier) => {
    if (!tier.stripePriceId || tier.price === 0) {
      alert('Please select a paid plan to subscribe');
      return;
    }

    // Use the correct price ID based on billing cycle
    const priceId = billingCycle === 'yearly' ? tier.yearlyPriceId : tier.stripePriceId;
    
    if (!priceId) {
      alert('Price not configured for this billing cycle');
      return;
    }

    setSubscribing(tier.id);
    try {
      await createCheckoutSession(priceId);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert(`Error starting subscription: ${error.message}`);
    } finally {
      setSubscribing(null);
    }
  };

  const handleTokenPurchase = async (tokenPackage) => {
    if (!tokenPackage.stripePriceId) {
      alert('Token package not configured');
      return;
    }

    setSubscribing(tokenPackage.id);
    try {
      await createCheckoutSession(tokenPackage.stripePriceId);
    } catch (error) {
      console.error('Error creating token purchase session:', error);
      alert(`Error purchasing tokens: ${error.message}`);
    } finally {
      setSubscribing(null);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteWarning) {
      setShowDeleteWarning(true);
      return;
    }

    try {
      // Sign out the user first, then they can contact support for full deletion
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      alert('You have been signed out. For complete account deletion, please contact support at imgmotionapp@gmail.com');
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error signing out. Please contact support at imgmotionapp@gmail.com for account deletion.');
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to subscription tokens on your next billing date.')) {
      return;
    }

    setCanceling(true);
    try {
      const result = await cancelSubscription();
      
      alert(`Subscription canceled successfully! You will keep access until your current billing period ends. Your ${result.details.purchased_tokens_retained} purchased tokens have been preserved.`);
      
      // Refresh data
      await getUser();
      setShowCancelModal(false);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert(`Error canceling subscription: ${error.message}`);
    } finally {
      setCanceling(false);
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
      {/* Header */}
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
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-white font-semibold">
                  {(profile?.tokens || 0) + (profile?.purchased_tokens || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
              <nav className="space-y-2">
                {/* Admin Panel Button - Only for jim@1busyguy.com */}
                {isAdmin && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Admin Panel</span>
                    {/* Debug info 
                    <span className="text-xs opacity-75">({user?.id?.substring(0, 8)}...)</span>*/}
                  </button>
                )}
                
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === 'profile'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'text-purple-200 hover:bg-white/10'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('billing')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === 'billing'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'text-purple-200 hover:bg-white/10'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Billing</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('account')}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    activeTab === 'account'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'text-purple-200 hover:bg-white/10'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span>Account</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Profile Information</h2>
                    <p className="text-purple-200">Update your profile information and social links</p>
                  </div>

                  {/* Avatar Section */}
                  <div className="flex items-center space-x-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center overflow-hidden">
                        {profileData.avatar_url ? (
                          <img 
                            src={toCdnUrl(profileData.avatar_url)} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <User className="w-12 h-12 text-white" />
                        )}
                      </div>
                      
                      <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-500 hover:bg-purple-600 rounded-full flex items-center justify-center cursor-pointer transition-colors">
                        {uploadingAvatar ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Camera className="w-4 h-4 text-white" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                      </label>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-white">Profile Picture</h3>
                      <p className="text-purple-200 text-sm">
                        Click the camera icon to upload a new avatar
                      </p>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="email"
                          value={user?.email || ''}
                          disabled
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-lg text-gray-400 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-purple-200 mb-2">
                        Username
                      </label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={profileData.username}
                          onChange={(e) => handleInputChange('username', e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Enter username"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">
                      Bio
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <textarea
                        value={profileData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={4}
                        className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="Tell us about yourself..."
                      />
                    </div>
                  </div>

                  {/* Social Links */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Social Links</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-purple-200 mb-2">
                          Twitter
                        </label>
                        <div className="relative">
                          <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="text"
                            value={profileData.twitter}
                            onChange={(e) => handleInputChange('twitter', e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="@username"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-purple-200 mb-2">
                          Instagram
                        </label>
                        <div className="relative">
                          <Instagram className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="text"
                            value={profileData.instagram}
                            onChange={(e) => handleInputChange('instagram', e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="@username"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === 'billing' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Billing & Subscription</h2>
                    <p className="text-purple-200">Manage your subscription and billing information</p>
                  </div>

                  {/* Current Plan */}
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
                    <div className="grid md:grid-cols-4 gap-4 items-center">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Current Plan</h3>
                        <p className="text-purple-200 capitalize">
                          {profile?.subscription_status === 'pro' ? 'Pro' : 
                           profile?.subscription_status === 'business' ? 'Business' : 'Free'} Plan
                        </p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Purchased</h3>
                        <p className="text-purple-200">
                          {subscription?.current_period_start 
                            ? new Date(subscription.current_period_start).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : profile?.created_at 
                              ? new Date(profile.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : 'N/A'
                          }
                        </p>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Next Billing</h3>
                        <p className="text-purple-200">
                          {subscription?.current_period_end && subscription.status === 'active'
                            ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : subscription?.status !== 'active' 
                              ? 'Inactive'
                              : 'N/A'
                          }
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <Zap className="w-5 h-5 text-purple-400" />
                          <span className="text-2xl font-bold text-white">
                            {(profile?.tokens || 0) + (profile?.purchased_tokens || 0)}
                          </span>
                        </div>
                        <div className="text-purple-200 text-sm space-y-1">
                          <p>total tokens</p>
                          <div className="text-xs">
                            <div>Subscription: {profile?.tokens || 0}</div>
                            <div>Purchased: {profile?.purchased_tokens || 0}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Billing Cycle Toggle */}
                  <div className="flex items-center justify-center space-x-4">
                    <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-purple-300'}`}>
                      Monthly
                    </span>
                    <button
                      onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                      className="relative w-12 h-6 bg-white/20 rounded-full transition-colors focus:outline-none"
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        billingCycle === 'yearly' ? 'transform translate-x-6' : ''
                      }`}></div>
                    </button>
                    <span className={`text-sm ${billingCycle === 'yearly' ? 'text-white' : 'text-purple-300'}`}>
                      Yearly <span className="text-green-400">Discounted</span>
                    </span>
                  </div>

                  {/* Subscription Plans */}
                  <div className="grid md:grid-cols-3 gap-6">
                    {subscriptionTiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={`relative bg-white/10 backdrop-blur-sm rounded-xl p-6 flex flex-col h-full ${
                          tier.id === 'pro'
                            ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30'
                            : 'hover:bg-white/20'
                        } transition-all duration-300`}
                      >
                        <div className="text-center mb-6 flex-grow">
                          <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                          <div className="flex items-center justify-center space-x-1 mb-4">
                            <span className="text-3xl font-bold text-white">
                              ${billingCycle === 'yearly' ? Math.round(tier.price * 0.8) : tier.price}
                            </span>
                            <span className="text-purple-200">
                              /{tier.price === 0 ? 'month' : (billingCycle === 'yearly' ? 'month' : 'month')}
                            </span>
                          </div>
                          <div className="flex items-center justify-center space-x-2 text-purple-200">
                            <Zap className="w-4 h-4" />
                            <span className="font-semibold">{tier.tokens.toLocaleString()} tokens</span>
                          </div>
                        </div>

                        <ul className="space-y-3 mb-6 flex-grow">
                          {tier.features.map((feature, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                              <span className="text-purple-100 text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="mt-auto">
                          <button
                            onClick={() => handleSubscribe(tier)}
                            disabled={subscribing === tier.id || tier.price === 0 || profile?.subscription_status === tier.id}
                            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                              profile?.subscription_status === tier.id
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white cursor-not-allowed opacity-75'
                                : tier.price === 0
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                : tier.id === 'pro'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                                : 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                            } disabled:opacity-75 disabled:cursor-not-allowed disabled:transform-none`}
                          >
                            {subscribing === tier.id ? 'Processing...' : 
                             profile?.subscription_status === tier.id ? 'Current Plan' : 
                             tier.price === 0 ? 'Free Plan' : 
                             tier.id === 'pro' ? 'Upgrade to Pro' :
                             tier.id === 'business' ? 'Get Business' :
                             `Subscribe to ${tier.name}`}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Token Packages Section */}
                  <div className="mt-12">
                    <div className="text-center mb-8">
                      <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center">
                        <Package className="w-6 h-6 mr-2" />
                        Buy Additional Tokens
                      </h3>
                      <p className="text-purple-200">
                        Need more tokens? Purchase individual token packages to boost your creativity
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tokenPackages.map((tokenPackage) => (
                        <div
                          key={tokenPackage.id}
                          className={`relative bg-white/10 backdrop-blur-sm rounded-xl p-4 flex flex-col h-full ${
                            tokenPackage.popular
                              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400/30'
                              : 'hover:bg-white/20'
                          } transition-all duration-300`}
                        >
                          {tokenPackage.popular && (
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                                Most Popular
                              </div>
                            </div>
                          )}

                          <div className="text-center mb-4 flex-grow">
                            <h4 className="text-lg font-bold text-white mb-2">{tokenPackage.name}</h4>
                            <div className="flex items-center justify-center space-x-1 mb-2">
                              <span className="text-2xl font-bold text-white">${tokenPackage.price}</span>
                            </div>
                            <div className="flex items-center justify-center space-x-2 text-green-400 mb-2">
                              <Zap className="w-4 h-4" />
                              <span className="font-semibold">{tokenPackage.tokens.toLocaleString()} tokens</span>
                            </div>
                            <p className="text-purple-200 text-sm">{tokenPackage.description}</p>
                          </div>

                          <div className="mt-auto">
                            <button
                              onClick={() => handleTokenPurchase(tokenPackage)}
                              disabled={subscribing === tokenPackage.id}
                              className={`w-full py-2 px-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 ${
                                tokenPackage.popular
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                              } disabled:opacity-75 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2`}
                            >
                              {subscribing === tokenPackage.id ? (
                                <span>Processing...</span>
                              ) : (
                                <>
                                  <ShoppingCart className="w-4 h-4" />
                                  <span>Buy Tokens</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 text-center">
                      <p className="text-purple-300 text-sm">
                        💡 Tokens are added instantly to your account after purchase
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Tab */}
              {activeTab === 'account' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Account Settings</h2>
                    <p className="text-purple-200">Manage your account preferences and security</p>
                  </div>

                  {/* Account Actions */}
                  <div className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">Sign Out</h3>
                          <p className="text-purple-200 text-sm">Sign out of your account on this device</p>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-red-400">Delete Account</h3>
                          <p className="text-red-300 text-sm">
                            Permanently delete your account and all associated data
                          </p>
                          {showDeleteWarning && (
                            <p className="text-red-200 text-sm mt-2 font-medium">
                              ⚠️ This action cannot be undone. Click again to confirm.
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleDeleteAccount}
                          className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>{showDeleteWarning ? 'Confirm Delete' : 'Delete Account'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Cancel Subscription Button */}
                  {subscription && subscription.status === 'active' && (
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium">Cancel Subscription</h4>
                          <p className="text-purple-300 text-sm">
                            Cancel your subscription. You'll keep access until {subscription?.current_period_end 
                              ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : 'your next billing date'
                            }.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowCancelModal(true)}
                          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          Cancel Plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 max-w-md w-full border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4">Cancel Subscription</h3>
            
            <div className="space-y-4 mb-6">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-400 font-medium mb-2">What happens when you cancel:</h4>
                <ul className="text-red-200 text-sm space-y-1">
                  <li>• Your subscription will end on {subscription?.current_period_end 
                    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'your next billing date'
                  }</li>
                  <li>• You'll lose subscription tokens ({profile?.tokens || 0}) at next billing date</li>
                  <li>• You'll be moved to the Free plan</li>
                  <li>• Your purchased tokens ({profile?.purchased_tokens || 0}) will be preserved</li>
                </ul>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-2">What you keep:</h4>
                <ul className="text-green-200 text-sm space-y-1">
                  <li>• Access until {subscription?.current_period_end 
                    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    : 'your next billing date'
                  }</li>
                  <li>• All subscription tokens ({profile?.tokens || 0}) until billing date</li>
                  <li>• All purchased token packages ({profile?.purchased_tokens || 0} tokens)</li>
                  <li>• Your account and all generated content</li>
                  <li>• Ability to resubscribe anytime</li>
                </ul>
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={canceling}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canceling ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;