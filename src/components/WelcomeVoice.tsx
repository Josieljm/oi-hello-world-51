import { useEffect, useState } from "react";
import { useVoice } from "@/hooks/useVoice";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const WelcomeVoice = () => {
  const { user } = useAuth();
  const { speak } = useVoice();
  const [hasSpoken, setHasSpoken] = useState(false);

  useEffect(() => {
    const fetchGenderAndSpeak = async () => {
      if (!user || hasSpoken) return;

      try {
        // Buscar gênero do localStorage
        const gender = (localStorage.getItem("userGender") as 'male' | 'female') || 'male';
        const name = localStorage.getItem("userName") || 'Amigo';
        let firstName = name.split(' ')[0];

        // Mensagem de boas-vindas personalizada
        const welcomeMessage = gender === 'female' 
          ? `Bem-vinda de volta ao Gym JM, ${firstName}! Pronta para arrasar no treino hoje?`
          : `Bem-vindo de volta ao Gym JM, ${firstName}! Pronto para dar tudo no treino hoje?`;

        console.log('Speaking welcome message:', welcomeMessage);
        
        await speak(welcomeMessage, gender);
        setHasSpoken(true);
      } catch (error) {
        console.error('Error in WelcomeVoice:', error);
      }
    };

    // Delay de 1 segundo para melhor UX
    const timer = setTimeout(() => {
      fetchGenderAndSpeak();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, hasSpoken, speak]);

  return null;
};
