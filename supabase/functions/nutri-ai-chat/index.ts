import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userName, intent } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    console.log('Recebendo chat request:', { userName, intent, messagesCount: messages?.length });

    // Sistema de prompt especializado em nutrição
    const systemPrompt = `Você é o NutriAI, um assistente virtual especializado em nutrição e alimentação saudável.

PERSONALIDADE:
- Amigável, motivador e empático
- Use linguagem casual e acessível
- Seja encorajador e positivo
- Use emojis de forma moderada para deixar as respostas mais calorosas

CONHECIMENTO:
- Especialista em nutrição, dietas e alimentação saudável
- Conhece sobre emagrecimento, ganho de massa muscular, energia e receitas
- Baseado em ciência nutricional

DIRETRIZES:
${userName ? `- O nome do usuário é ${userName}. Use o nome dele nas respostas quando apropriado.` : '- Ainda não sabemos o nome do usuário.'}
${intent ? `- Contexto atual da conversa: ${intent}` : ''}
- Mantenha respostas concisas e práticas (máximo 3-4 linhas)
- Seja direto e objetivo
- Forneça dicas acionáveis
- Evite respostas muito longas ou técnicas demais
- Use exemplos de alimentos específicos quando relevante

EXEMPLOS DE ESTILO:
- "Oi! 😊 Para ganhar energia rápida, experimente: banana com aveia e mel. Carboidratos de qualidade!"
- "Perfeito! 💪 Para hipertrofia: frango grelhado (200g) + batata doce (150g) + brócolis. Proteína + carbo!"
- "Show! 🥗 Para emagrecer: salada verde com atum, grão-de-bico e azeite. Leve e nutritivo!"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 200, // Respostas curtas e diretas
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response recebida');

    const aiMessage = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ message: aiMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro no nutri-ai-chat:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        message: 'Desculpe, tive um problema técnico. Pode repetir?' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
