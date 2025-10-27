-- Adicionar campo onboarding_completed na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;