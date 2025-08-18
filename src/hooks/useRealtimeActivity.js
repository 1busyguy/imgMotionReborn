import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useRealtimeActivity = (userId) => {
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchRecentActivity();

    // Set up real-time subscription
    const subscription = supabase
      .channel('ai_generations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_generations',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Real-time update:', payload);
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const fetchRecentActivity = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_generations')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentActivity(data || []);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRealtimeUpdate = (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    setRecentActivity(current => {
      switch (eventType) {
        case 'INSERT':
          // Add new generation at the beginning
          return [newRecord, ...current].slice(0, 10);
        
        case 'UPDATE':
          // Update existing generation
          return current.map(item => 
            item.id === newRecord.id ? newRecord : item
          );
        
        case 'DELETE':
          // Remove deleted generation
          return current.filter(item => item.id !== oldRecord.id);
        
        default:
          return current;
      }
    });
  };

  return { recentActivity, loading, refetch: fetchRecentActivity };
};