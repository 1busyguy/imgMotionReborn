import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import AdminLoraManager from './components/AdminLoraManager';
import { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './hooks/useAuth';
import MaintenanceWrapper from './components/MaintenanceWrapper';
import BannedUserScreen from './components/BannedUserScreen';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Gallery from './pages/Gallery';
import FluxRedux from './pages/fal-tools/FluxRedux';
import FluxKontext from './pages/fal-tools/FluxKontext';
import FluxKontextMaxMulti from './pages/fal-tools/FluxKontextMaxMulti';
import MinimaxHailuo from './pages/fal-tools/MinimaxHailuo';
import WanPro from './pages/fal-tools/WanPro';
import KlingPro from './pages/fal-tools/KlingPro';
import LTXVVideo from './pages/fal-tools/LTXVVideo';
import FalVideoUpscaler from './pages/fal-tools/FalVideoUpscaler';
import BriaBackgroundRemover from './pages/fal-tools/BriaBackgroundRemover';
import VEO3Fast from './pages/fal-tools/VEO3Fast';
import AISceneGen from './pages/fal-tools/AISceneGen';
import HiDreamI1 from './pages/fal-tools/HiDreamI1';
import SeedancePro from './pages/fal-tools/SeedancePro';
import Wan22 from './pages/fal-tools/Wan22';
import CassetteAIMusic from './pages/fal-tools/CassetteAIMusic';
import MMAudioV2 from './pages/fal-tools/MMAudioV2';
import MMAudioVideo2 from './pages/fal-tools/MMAudioVideo2';
import Omnihuman from './pages/fal-tools/Omnihuman';
import WanV22Img2VideoLora from './pages/fal-tools/WanV22Img2VideoLora';
import WanV22Video2Video from './pages/fal-tools/WanV22Video2Video';
import WanV22Text2VideoLora from './pages/fal-tools/WanV22Text2VideoLora';
import VEO3Standard from './pages/fal-tools/VEO3Standard';
import GeminiFlashImageEdit from './pages/fal-tools/GeminFlashImageEdit';
import Admin from './pages/Admin';
import Showcase from './pages/Showcase';
import About from './pages/About';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import FAQ from './pages/FAQ';
import Careers from './pages/Careers';
import Pricing from './pages/Pricing';
import ImgMotionApp from './pages/ImgMotionApp';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = React.useState(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  // Check if user is banned
  React.useEffect(() => {
    if (user) {
      checkUserBanStatus();
    } else {
      setProfileLoading(false);
    }
  }, [user]);

  const checkUserBanStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('banned, ban_reason, banned_at')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking ban status:', error);
        // If we can't check ban status, allow access (fail open)
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in ban status check:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is banned
  if (profile?.banned) {
    return <BannedUserScreen 
      banReason={profile.ban_reason} 
      bannedAt={profile.banned_at} 
    />;
  }

  return children;
};

// Admin Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  // Let the Admin component handle its own auth checking
  // This prevents double auth checks and state conflicts
  return children;
};

function App() {
  useEffect(() => {
  // Handle OAuth redirects, post-login navigation, and sign-out navigation
  const handleAuthStateChange = async (event: string, session: any) => {
    console.log('Auth state change in App.tsx:', event, {
      hasSession: !!session,
      currentPath: window.location.pathname,
      hasHash: !!window.location.hash
    });

    // Handle sign in
    if (event === 'SIGNED_IN' && session?.user) {
      // Check if we're coming from an OAuth callback (has access_token in URL)
      const isOAuthCallback = window.location.hash.includes('access_token');
      
      // Check if we're on a public page that should redirect to dashboard after login
      const publicPaths = ['/', '/login', '/signup'];
      const shouldRedirect = publicPaths.includes(window.location.pathname) || isOAuthCallback;
      
      if (shouldRedirect) {
        console.log('Redirecting to dashboard after successful sign-in');
        
        // Clean the URL first if it's an OAuth callback
        if (isOAuthCallback) {
          window.history.replaceState(null, '', '/dashboard');
        } else {
          window.history.pushState(null, '', '/dashboard');
        }
        
        // Trigger a popstate event to make React Router respond to the URL change
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
    
    // Handle sign out - redirect to homepage
    if (event === 'SIGNED_OUT') {
      console.log('User signed out, redirecting to homepage');
      
      // Check if we're not already on the homepage to avoid unnecessary navigation
      if (window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
  return () => subscription.unsubscribe();
}, []);

  const handleSignUpClick = () => {
    // Use React Router navigation instead of window.location
    const signupUrl = '/signup';
    window.history.pushState({}, '', signupUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSubscribeClick = (tier: any) => {
    // TODO: Implement Stripe subscription flow
    console.log('Subscribe to:', tier);
    // For now, redirect to signup if not logged in
    const signupUrl = '/signup';
    window.history.pushState({}, '', signupUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <Router>
      <MaintenanceWrapper>
        <div className="App">
          <Routes>
            <Route 
              path="/" 
              element={
                <Landing 
                  onSignUpClick={handleSignUpClick}
                  onSubscribeClick={handleSubscribeClick}
                />
              } 
            />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gallery" 
              element={
                <ProtectedRoute>
                  <Gallery />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-redux" 
              element={
                <ProtectedRoute>
                  <FluxRedux />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-kontext" 
              element={
                <ProtectedRoute>
                  <FluxKontext />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-kontext-max-multi"
              element={
                <ProtectedRoute>
                  <FluxKontextMaxMulti />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/minimax-hailuo" 
              element={
                <ProtectedRoute>
                  <MinimaxHailuo />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan22-pro" 
              element={
                <ProtectedRoute>
                  <Wan22 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kling-pro" 
              element={
                <ProtectedRoute>
                  <KlingPro />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ltxv-video" 
              element={
                <ProtectedRoute>
                  <LTXVVideo />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/fal-video-upscaler" 
              element={
                <ProtectedRoute>
                  <FalVideoUpscaler />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/bria-bg-remove" 
              element={
                <ProtectedRoute>
                  <BriaBackgroundRemover />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ai-scene-gen" 
              element={
                <ProtectedRoute>
                  <AISceneGen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hidream-i1" 
              element={
                <ProtectedRoute>
                  <HiDreamI1 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seedance-pro" 
              element={
                <ProtectedRoute>
                  <SeedancePro />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-text2video-lora" 
              element={
                <ProtectedRoute>
                  <WanV22Text2VideoLora />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cassetteai-music" 
              element={
                <ProtectedRoute>
                  <CassetteAIMusic />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mmaudio-v2" 
              element={
                <ProtectedRoute>
                  <MMAudioV2 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mmaudio-video2" 
              element={
                <ProtectedRoute>
                  <MMAudioVideo2 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/omnihuman" 
              element={
                <ProtectedRoute>
                  <Omnihuman />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-img2video-lora" 
              element={
                <ProtectedRoute>
                  <WanV22Img2VideoLora />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-video2video" 
              element={
                <ProtectedRoute>
                  <WanV22Video2Video />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/veo3-fast" 
              element={
                <ProtectedRoute>
                  <VEO3Fast />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/veo3-standard" 
              element={
                <ProtectedRoute>
                  <VEO3Standard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gemini-flash-image-edit" 
              element={
                <ProtectedRoute>
                  <GeminiFlashImageEdit />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/lora-manager" 
              element={
                <ProtectedRoute>
                  <AdminLoraManager />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/user/:userId" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/imgmotionapp" element={<ImgMotionApp />} />
            <Route path="/showcase" element={<Showcase />} />
            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </MaintenanceWrapper>
    </Router>
  );
}

export default App;