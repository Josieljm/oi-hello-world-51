-- Adicionar coluna gender na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other'));