import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useVoice = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const speak = async (text: string, gender: 'male' | 'female' = 'male') => {
    if (!text || isPlaying) return;

    // Verificar se outra voz já está tocando (previne duplicação)
    const globalPlaying = sessionStorage.getItem('voice_playing') === 'true';
    if (globalPlaying) {
      console.log('Outra voz já está tocando, aguardando...');
      return;
    }

    setIsLoading(true);
    sessionStorage.setItem('voice_playing', 'true');
    
    try {
      console.log('Requesting speech for:', { text, gender });

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, gender },
      });

      if (error) {
        console.error('Error generating speech:', error);
        throw error;
      }

      if (!data?.audioContent) {
        throw new Error('No audio content received');
      }

      // Convert base64 to blob
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      // Play audio
      const audio = new Audio(url);
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        sessionStorage.removeItem('voice_playing');
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        sessionStorage.removeItem('voice_playing');
        URL.revokeObjectURL(url);
        toast.error('Erro ao reproduzir áudio');
      };

      await audio.play();
      console.log('Audio playing successfully');
    } catch (error) {
      console.error('Error in speak function:', error);
      sessionStorage.removeItem('voice_playing');
      toast.error('Erro ao gerar voz');
    } finally {
      setIsLoading(false);
    }
  };

  return { speak, isLoading, isPlaying };
};
