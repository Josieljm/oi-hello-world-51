import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Update profile with OAuth data after sign in
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(() => {
            updateProfileFromOAuth(session.user);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const updateProfileFromOAuth = async (user: User) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Se já existe um perfil com nome válido (não é email), não sobrescrever
      if (existingProfile?.name && 
          !existingProfile.name.includes('@') && 
          existingProfile.name !== 'Usuário') {
        // Apenas atualizar avatar se necessário
        const newAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
        if (newAvatar && newAvatar !== existingProfile.avatar_url) {
          await supabase
            .from('profiles')
            .update({ avatar_url: newAvatar })
            .eq('user_id', user.id);
        }
        return;
      }

      // Extrair nome do metadata ou email
      let userName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      
      // Se não houver nome no metadata, usar parte do email
      if (!userName && user.email) {
        userName = user.email.split('@')[0];
      }

      const profileData = {
        user_id: user.id,
        name: userName || 'Usuário',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      };

      if (existingProfile) {
        await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('profiles')
          .insert(profileData);
      }
    } catch (error) {
      // Silently fail in production, log only in development
      if (import.meta.env.DEV) {
        console.error('Erro ao atualizar perfil:', error);
      }
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
}
