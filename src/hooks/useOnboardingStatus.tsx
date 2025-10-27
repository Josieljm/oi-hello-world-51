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
        // 🔍 1️⃣ Busca direto do backend, sem confiar apenas no localStorage
        const { data, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id) // ✅ usa o ID correto do perfil
          .single();

        if (error) {
          console.error('Erro ao buscar status do onboarding:', error);
          setOnboardingCompleted(false);
          localStorage.setItem('onboardingCompleted', 'false');
        } else {
          const completed = !!data?.onboarding_completed;
          setOnboardingCompleted(completed);

          // ✅ Sempre atualiza o localStorage
          localStorage.setItem('onboardingCompleted', completed ? 'true' : 'false');
        }
      } catch (error) {
        console.error('Erro ao verificar onboarding:', error);
        setOnboardingCompleted(false);
        localStorage.setItem('onboardingCompleted', 'false');
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  return { onboardingCompleted, loading, setOnboardingCompleted };
};
