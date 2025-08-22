import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

const Dashboard = () => {
  const { user, profile, loading } = useAuth();
  const [generations, setGenerations] = useState([]);
  const [loadingGenerations, setLoadingGenerations] = useState(true);

  useEffect(() => {
    if (user && profile) {
      // Handle Google OAuth completion and IP capture
      const handleOAuthCompletion = async () => {
        const sessionKey = `ip_captured_${user.id}`;
        
        if (window.location.hash.includes('access_token') && !sessionStorage.getItem(sessionKey)) {
          try {
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Capture login IP
            const { data: session } = await supabase.auth.getSession();
            if (session?.session?.access_token) {
              await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-login-ip`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.session.access_token}`,
                  'Content-Type': 'application/json',
                },
              });
            }
            
            sessionStorage.setItem(sessionKey, 'true');
          } catch (error) {
            console.error('Error capturing login IP:', error);
          }
        }
      };

      handleOAuthCompletion();
      fetchGenerations();
    }
  }, [user, profile]);

  const fetchGenerations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching generations:', error);
        return;
      }

      setGenerations(data || []);
    } catch (error) {
      console.error('Error in fetchGenerations:', error);
    } finally {
      setLoadingGenerations(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to access your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {profile.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Tokens</h3>
            <p className="text-3xl font-bold text-blue-600">{profile.tokens || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Generations</h3>
            <p className="text-3xl font-bold text-green-600">{generations.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h3>
            <p className="text-lg font-medium text-gray-900 capitalize">{profile.subscription_status || 'Free'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Generations</h2>
          </div>
          <div className="p-6">
            {loadingGenerations ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading generations...</p>
              </div>
            ) : generations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No generations yet. Start creating!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generations.slice(0, 6).map((generation) => (
                  <div key={generation.id} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{generation.generation_name}</h4>
                    <p className="text-sm text-gray-600 mb-2">Tool: {generation.tool_name}</p>
                    <p className="text-sm text-gray-500">Status: {generation.status}</p>
                    {generation.output_file_url && (
                      <a 
                        href={generation.output_file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Result
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;