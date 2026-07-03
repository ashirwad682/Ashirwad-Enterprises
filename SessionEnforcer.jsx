import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function SessionEnforcer({ children }) {
  const navigate = useNavigate();
  const listenersRef = useRef({});

  const getLocalSessionId = () => {
    let localId = sessionStorage.getItem('local_session_id');
    if (!localId) {
      localId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      sessionStorage.setItem('local_session_id', localId);
    }
    return localId;
  };

  useEffect(() => {
    const currentSessionId = getLocalSessionId();
    let isKicking = false;

    const handleLogoutAll = async () => {
      if (isKicking) return;
      isKicking = true;
      
      await supabase.auth.signOut();
      localStorage.removeItem('manager_token');
      localStorage.removeItem('warehouse_id');
      localStorage.removeItem('warehouse_auth_token');
      localStorage.removeItem('delivery_partner_id');
      
      navigate('/login', { replace: true });
      setTimeout(() => alert('You have been logged out because your account was accessed from another device.'), 100);
    };

    // Global fetch interceptor to inject session ID and handle HTTP 401 kicks
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      let [resource, config] = args;
      config = config || {};
      
      if (!config.headers) config.headers = {};
      if (config.headers instanceof Headers) {
        config.headers.set('x-session-id', currentSessionId);
      } else {
        config.headers['x-session-id'] = currentSessionId;
      }
      
      const response = await originalFetch(resource, config);
      
      if (response.status === 401 && !isKicking) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data?.error === 'SESSION_EXPIRED') {
            handleLogoutAll();
          }
        } catch (e) {}
      }
      return response;
    };

    const setupRoleListener = async (tableName, recordId) => {
      if (!recordId || listenersRef.current[tableName]) return;

      supabase
        .from(tableName)
        .update({ current_session_id: currentSessionId })
        .eq('id', recordId)
        .then()
        .catch(err => console.error('Session update error:', err));

      const checkSession = async () => {
         if (isKicking) return;
         try {
           const { data } = await supabase
             .from(tableName)
             .select('current_session_id')
             .eq('id', recordId)
             .single();

           if (data && data.current_session_id && data.current_session_id !== currentSessionId) {
              handleLogoutAll();
           }
         } catch (err) {}
      };

      const channel = supabase
        .channel(`single_session_${tableName}_${recordId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: tableName, filter: `id=eq.${recordId}` },
          (payload) => {
            if (payload.new.current_session_id && payload.new.current_session_id !== currentSessionId) {
              handleLogoutAll();
            }
          }
        )
        .subscribe();

      const pollInterval = setInterval(checkSession, 10000);
      
      listenersRef.current[tableName] = () => {
        clearInterval(pollInterval);
        supabase.removeChannel(channel);
        delete listenersRef.current[tableName];
      };
    };

    const initListeners = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setupRoleListener('users', session.user.id);
      
      const warehouseId = localStorage.getItem('warehouse_id');
      if (warehouseId) setupRoleListener('warehouses', warehouseId);

      const deliveryPartnerId = localStorage.getItem('delivery_partner_id');
      if (deliveryPartnerId) setupRoleListener('delivery_partners', deliveryPartnerId);
    };

    initListeners();
    
    // Routinely check values in case auth state switches out of context (i.e. localStorage was set manually)
    const dynamicCheckInterval = setInterval(initListeners, 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user?.id) setupRoleListener('users', session.user.id);
      } else if (event === 'SIGNED_OUT') {
        if (listenersRef.current['users']) {
            listenersRef.current['users']();
        }
      }
    });

    return () => {
      Object.values(listenersRef.current).forEach(cleanup => cleanup());
      subscription?.unsubscribe();
      clearInterval(dynamicCheckInterval);
      window.fetch = originalFetch;
    };
  }, [navigate]);

  return children;
}