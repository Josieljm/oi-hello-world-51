import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

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

    console.log('Recebendo requisição NutriAI:', { userName, intent, messagesCount: messages.length });

    // Construir contexto adicional baseado na intenção
    let contextPrompt = '';
    if (intent?.type === 'weight_loss') {
      contextPrompt = 'O usuário está focado em emagrecimento. Priorize dicas de baixa caloria e proteínas magras.';
    } else if (intent?.type === 'muscle_gain') {
      contextPrompt = 'O usuário está focado em ganho de massa muscular. Priorize dicas de alta proteína e carboidratos complexos.';
    } else if (intent?.type === 'energy') {
      contextPrompt = 'O usuário busca mais energia. Priorize alimentos energéticos e nutritivos.';
    }

    const systemPrompt = `Você é o NutriAI, um assistente nutricional especializado, amigável e motivador.

PERSONALIDADE:
- Seja informal, empático e motivador
- Use linguagem brasileira natural
- Seja breve e objetivo (máximo 3-4 frases)
- Adicione emojis ocasionalmente para dar personalidade

DIRETRIZES:
- Foque em nutrição, alimentação saudável e bem-estar
- Dê dicas práticas e aplicáveis
- Sugira alimentos específicos e receitas simples
- Incentive hábitos saudáveis
- Seja sempre positivo e encorajador
${contextPrompt ? `\n${contextPrompt}` : ''}

${userName ? `O nome do usuário é ${userName}. Use o nome dele ocasionalmente para personalizar.` : ''}

IMPORTANTE: Mantenha respostas curtas e diretas. Não seja prolixo.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro na API Lovable AI:', errorData);
      throw new Error(`Lovable AI error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('Resposta gerada com sucesso');

    return new Response(JSON.stringify({ response: generatedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro em nutri-ai-chat:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      fallback: 'Desculpe, tive um problema técnico. Pode tentar novamente?'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
