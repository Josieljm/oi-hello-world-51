import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useOnboardingStatus = () => {
  const { user } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setOnboardingCompleted(null);
        setLoading(false);
        return;
      }

      try {
        // 🔍 Tentar buscar do backend primeiro
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.log('Backend indisponível, usando cache local');
          // ⚠️ Fallback para localStorage se backend falhar
          const localStatus = localStorage.getItem(`onboarding_${user.id}`);
          const completed = localStatus === 'true';
          setOnboardingCompleted(completed);
        } else {
          // ✅ Backend respondeu - usar e atualizar cache local
          const completed = !!data?.onboarding_completed;
          setOnboardingCompleted(completed);
          localStorage.setItem(`onboarding_${user.id}`, completed ? 'true' : 'false');
        }
      } catch (error) {
        console.error('Erro ao verificar onboarding:', error);
        // ⚠️ Fallback para localStorage em caso de erro
        const localStatus = localStorage.getItem(`onboarding_${user.id}`);
        setOnboardingCompleted(localStatus === 'true');
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  return { onboardingCompleted, loading, setOnboardingCompleted };
};
