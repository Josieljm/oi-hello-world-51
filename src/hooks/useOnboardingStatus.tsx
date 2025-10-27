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

      // 1️⃣ Primeiro tenta ler do localStorage
      const stored = localStorage.getItem('onboardingCompleted');
      if (stored === 'true') {
        setOnboardingCompleted(true);
        setLoading(false);
        return;
      }

      // 2️⃣ Busca do backend (caso ainda não esteja salvo)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar status do onboarding:', error);
          setOnboardingCompleted(false);
        } else {
          const completed = data?.onboarding_completed || false;
          setOnboardingCompleted(completed);
          
          // 3️⃣ Salva localmente para futuros logins
          localStorage.setItem('onboardingCompleted', completed ? 'true' : 'false');
        }
      } catch (error) {
        console.error('Erro ao verificar onboarding:', error);
        setOnboardingCompleted(false);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  return { onboardingCompleted, loading, setOnboardingCompleted };
};
