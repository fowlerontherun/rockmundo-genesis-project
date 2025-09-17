
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth-context';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'moderator' | 'user';

export const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserRole = useCallback(async () => {
    if (!user) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('get_user_role', { _user_id: user.id });

      if (error) throw error;
      setUserRole(data as UserRole);
    } catch (error) {
      console.error('Error loading user role:', error);
      // Default to 'user' role if there's an error
      setUserRole('user');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserRole();
  }, [loadUserRole]);

  const hasRole = (role: UserRole): boolean => {
    if (!userRole) return false;
    
    const roleHierarchy = { admin: 3, moderator: 2, user: 1 };
    const userLevel = roleHierarchy[userRole];
    const requiredLevel = roleHierarchy[role];
    
    return userLevel >= requiredLevel;
  };

  const isAdmin = (): boolean => hasRole('admin');
  const isModerator = (): boolean => hasRole('moderator');

  return {
    userRole,
    loading,
    hasRole,
    isAdmin,
    isModerator,
    refetch: loadUserRole
  };
};
