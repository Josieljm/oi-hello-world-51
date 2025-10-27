import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useVoice } from '@/hooks/useVoice';

const NutriAI = () => {
  const { user } = useAuth();
  const { speak, isLoading: isVoiceLoading, isPlaying } = useVoice();
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState<Array<{type: string; text: string; timestamp: Date}>>([]);
  const [profileName, setProfileName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [conversationStage, setConversationStage] = useState<'start' | 'main'>('start');
  const recognitionRef = useRef<any>(null);
  const [userGender, setUserGender] = useState<'male' | 'female'>('male');
  const conversationContext = useRef({
    lastTopic: '',
    userGoals: '',
    dietaryPreferences: ''
  });

  // ✅ BUSCAR NOME DO PERFIL DO USUÁRIO
  useEffect(() => {
    const fetchProfileName = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();
      
      if (data?.name) {
        setProfileName(data.name);
      }
    };
    
    fetchProfileName();
  }, [user]);

  // ✅ EXTRAIR PRIMEIRO NOME DO PERFIL
  const getFirstName = (fullName: string) => {
    if (!fullName) return 'Amigo';
    return fullName.split(' ')[0];
  };

  const firstName = getFirstName(profileName);

  // ✅ DETECTAR GÊNERO DO USUÁRIO PELO NOME
  const detectUserGender = (name: string): 'male' | 'female' => {
    const maleNames = ['carlos', 'joão', 'pedro', 'marcos', 'lucas', 'josiel', 'miguel', 'rafael', 
                       'fernando', 'ricardo', 'rodrigo', 'paulo', 'bruno', 'andré', 'felipe'];
    const femaleNames = ['ana', 'maria', 'julia', 'carla', 'patricia', 'fernanda', 'beatriz', 'amanda',
                         'juliana', 'carolina', 'gabriela', 'camila', 'leticia', 'mariana', 'paula'];
    
    const cleanName = name.toLowerCase().trim();
    if (maleNames.includes(cleanName)) return 'male';
    if (femaleNames.includes(cleanName)) return 'female';
    return 'male'; // padrão
  };

  // ✅ CONFIGURAÇÃO AVANÇADA DE VOZ
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true; // ✅ CONVERSA CONTÍNUA
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        // ✅ RECONECTAR AUTOMATICAMENTE
        if (isActive && !isPlaying) {
          setTimeout(() => {
            if (recognitionRef.current && isActive) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Reconhecimento já ativo
              }
            }
          }, 500);
        }
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          handleUserMessage(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          alert('Permissão de microfone negada. Ative o microfone para conversar com o NutriAI.');
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isActive, isPlaying]);

  // ✅ FALA COM ELEVENLABS
  const speakText = async (text: string) => {
    console.log('🔊 NutriAI falando com ElevenLabs...');
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    try {
      await speak(text, userGender);
      console.log('🔇 NutriAI terminou de falar');
      
      if (isActive && recognitionRef.current) {
        // ✅ Pausa de 1s antes de reativar microfone (mais natural)
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('Reconhecimento já ativo');
          }
        }, 1000);
      }
    } catch (error) {
      console.error('❌ Erro na fala:', error);
    }
  };

  // ✅ EXTRAIR NOME DA FALA DO USUÁRIO
  const extractName = (userText: string): string | null => {
    const text = userText.toLowerCase().trim();
    
    // Remover saudações e palavras comuns
    const cleanText = text
      .replace(/meu nome é|eu sou|me chamo|sou o|sou a/gi, '')
      .replace(/oi|olá|ola|hey/gi, '')
      .trim();
    
    // Pegar primeira palavra como nome
    const words = cleanText.split(' ');
    return words[0] ? words[0].charAt(0).toUpperCase() + words[0].slice(1) : null;
  };

  // ✅ ATIVAÇÃO CARISMÁTICA COM VARIAÇÃO
  const activateNutriAI = async () => {
    setIsActive(true);
    setConversationStage('start');
    
    const detectedGender = detectUserGender(firstName);
    setUserGender(detectedGender);
    
    // ✅ Saudações variadas para não repetir
    const greetings = [
      `Oi, eu sou ${userGender === 'male' ? 'seu' : 'sua'} NutriAI, me chamo ${firstName}, e vamos focar na sua alimentação e nutrição. Aliás, como você se chama?`,
      `E aí! Sou ${userGender === 'male' ? 'o' : 'a'} NutriAI, pode me chamar de ${firstName}. Vou te ajudar com nutrição e bem-estar. Qual é seu nome?`,
      `Olá! Me chamo ${firstName} e sou ${userGender === 'male' ? 'seu nutricionista virtual' : 'sua nutricionista virtual'}. Vamos conversar sobre alimentação? Primeiro, como você se chama?`
    ];
    
    let welcomeText = '';
    if (firstName && firstName !== 'Amigo') {
      welcomeText = greetings[Math.floor(Math.random() * greetings.length)];
    } else {
      welcomeText = `Oi, eu sou ${userGender === 'male' ? 'seu' : 'sua'} NutriAI! Vamos focar na sua alimentação e nutrição. Primeiro, como você se chama?`;
    }
    
    setConversation([{
      type: 'ai', 
      text: welcomeText,
      timestamp: new Date()
    }]);
    
    await speakText(welcomeText);
    
    if (recognitionRef.current) {
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Reconhecimento já ativo
        }
      }, 1500);
    }
  };

  // ✅ DESATIVAR CORRETAMENTE
  const deactivateNutriAI = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsActive(false);
    setIsListening(false);
    setConversation([]);
  };

  // ✅ RESPOSTAS CARISMÁTICAS COM VARIAÇÃO E EMOÇÃO
  const generateNutritionResponse = (userMessage: string, speakerName: string) => {
    const lowerMessage = userMessage.toLowerCase();
    
    // ✅ RESPOSTAS COM VARIAÇÃO - nunca repete a mesma estrutura
    const responseVariations: Record<string, string[]> = {
      'emagrecer|perder peso|peso': [
        `Entendi, ${speakerName}. A gente pode começar ajustando pequenas coisas, tipo trocar refrigerante por água saborizada ou incluir frutas no lanche. Quer que eu te ajude a montar um plano leve pra essa semana?`,
        `Legal isso! Quer perder peso? Olha só, o segredo tá na consistência, não em dieta maluca. Que tal a gente focar em trocar alimentos industrializados por comida de verdade? Topa?`,
        `Boa pergunta! Perder peso com saúde é totalmente possível, ${speakerName}. Vamos começar pelo básico: mais água, menos açúcar, e comida caseira. Posso te dar um cardápio simples pra testar?`
      ],
      'massa|ganhar massa|muscular|musculação|força': [
        `Show! Nesse caso, a base é proteína e constância. Pensa em ovos, peixes, frango e leguminosas como feijão e lentilha. Posso te dar umas opções de lanche pós-treino?`,
        `${speakerName}, pra ganhar massa você precisa de proteínas magras, carboidratos bons e bastante água. Um exemplo seria frango grelhado com batata-doce e salada colorida. Quer que eu monte um cardápio rápido pra isso?`,
        `Massa muscular é meu forte! A dica é: proteína em todas as refeições. Ovos no café, frango no almoço, peixe no jantar. Quer saber as quantidades ideais pra você?`
      ],
      'receita|receitas|prato|comida|refeição': [
        `Boa! Vamos de receitas então. Me conta, você curte comida mais leve ou algo mais substancial? E tem algum ingrediente que você ama?`,
        `Olha só, ${speakerName}, tenho várias receitas fit e gostosas! Quer algo rápido pro dia a dia ou uma receita especial pra fim de semana?`,
        `Receitas é comigo mesmo! Que tal a gente montar algo com ingredientes que você já tem em casa? Me fala o que tem na geladeira!`
      ],
      'água|hidrat': [
        `${speakerName}, água é vida! Sério, bebe pelo menos 2 litros por dia. Seu corpo vai agradecer, confia. Quer dicas pra lembrar de beber mais?`,
        `Olha só, água é fundamental! Se você treina, aumenta pra uns 3 litros. E se achar sem graça, adiciona limão ou hortelã. Fica show!`,
        `Boa! Água é essencial pra tudo: metabolismo, pele, energia... Tenta sempre ter uma garrafa por perto, ajuda demais!`
      ],
      'dia|hoje|data|clima': [
        `Hoje é ${new Date().toLocaleDateString('pt-BR')}! Aliás, ótimo dia pra cuidar da alimentação, né? Quer que eu te lembre de beber mais água hoje?`,
        `Olha só, hoje tá perfeito pra começar hábitos saudáveis! Me conta, ${speakerName}, como foi sua alimentação até agora hoje?`
      ],
      'desanim|triste|cansad|sono': [
        `Poxa, entendo... tem dias assim mesmo, ${speakerName}. Que tal a gente tentar ajustar sua alimentação pra te dar mais energia? Às vezes, um bom café da manhã muda tudo!`,
        `Sei como é. Cansaço pode ser falta de nutrientes, sabia? Vamos revisar o que você tá comendo? Pode ser que falte ferro ou vitaminas do complexo B.`
      ],
      'obrigad': [
        `De nada, ${speakerName}! Tamo junto nessa jornada nutricional!`,
        `Imagina! Qualquer coisa, só chamar. Estou aqui pra te ajudar sempre!`,
        `Por nada! Adorei nossa conversa, viu? Sempre que precisar, é só falar!`
      ],
      'você|bot|robo|ia': [
        `Haha, não exatamente... mas se eu pudesse, com certeza experimentaria sua comida saudável! Me conta, ${speakerName}, o que você costuma preparar?`,
        `Olha, sou uma IA sim, mas tô aqui pra te ajudar de verdade com nutrição! Então, bora focar no seu bem-estar?`
      ]
    };

    // ✅ Procura resposta variada
    for (const [keys, responses] of Object.entries(responseVariations)) {
      const keyList = keys.split('|');
      if (keyList.some(key => lowerMessage.includes(key))) {
        // Seleciona resposta aleatória para variação
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // ✅ Atualiza contexto da conversa
        conversationContext.current.lastTopic = keys.split('|')[0];
        
        return randomResponse;
      }
    }
    
    // ✅ Respostas genéricas variadas para manter naturalidade
    const genericResponses = [
      `Interessante, ${speakerName}! Sobre nutrição, posso te ajudar com receitas, cálculos ou dicas personalizadas. O que te interessa mais?`,
      `Legal isso! Me conta mais, ${speakerName}. Como posso te ajudar com alimentação hoje?`,
      `Olha só, ${speakerName}, adorei sua curiosidade! Quer falar sobre dieta, receitas ou dicas gerais de saúde?`,
      `Boa pergunta! Vamos explorar isso juntos, ${speakerName}. Me dá mais detalhes do que você tá pensando?`
    ];
    
    return genericResponses[Math.floor(Math.random() * genericResponses.length)];
  };

  const handleUserMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMessage = { 
      type: 'user', 
      text: userText, 
      timestamp: new Date() 
    };
    setConversation(prev => [...prev, userMessage]);

    let aiResponse = '';

    // ✅ FASE 1: CAPTURAR NOME DO USUÁRIO
    if (conversationStage === 'start') {
      const detectedName = extractName(userText);
      if (detectedName) {
        setUserName(detectedName);
        const gender = detectUserGender(detectedName);
        setUserGender(gender);
        setConversationStage('main');
        
        // ✅ RESPOSTAS CARISMÁTICAS VARIADAS
        if (firstName && firstName !== 'Amigo' && firstName.toLowerCase() === detectedName.toLowerCase()) {
          const sameNameResponses = [
            `Ah, meu chará! Também me chamo ${detectedName}! Que coincidência fantástica! Então ${detectedName}, vamos ao que importa? O que você quer saber sobre nutrição?`,
            `Olha só! Somos xará, ${detectedName}! Adorei isso! Bom, agora que já nos conhecemos, me conta: qual é seu objetivo com alimentação?`,
            `Sério?! Também sou ${detectedName}! Que massa! Bom ${detectedName}, vamos direto ao assunto: quer falar de emagrecimento, ganho de massa ou saúde geral?`
          ];
          aiResponse = sameNameResponses[Math.floor(Math.random() * sameNameResponses.length)];
        } else {
          const introResponses = [
            `Prazer, ${detectedName}! Que nome bonito! Então vamos ao que importa? O que você deseja saber sobre alimentação e nutrição?`,
            `Oi ${detectedName}! Legal te conhecer! Bom, agora me conta: seu foco é emagrecer, ganhar massa ou ter mais energia no dia a dia?`,
            `${detectedName}! Adoro esse nome! Bom, vamos lá: qual é seu principal objetivo com nutrição agora?`,
            `Olá ${detectedName}! Que bom ter você aqui! Me fala, o que te trouxe até mim? Quer ajuda com dieta, receitas ou dicas de saúde?`
          ];
          aiResponse = introResponses[Math.floor(Math.random() * introResponses.length)];
        }
      } else {
        const retryResponses = [
          `Desculpa ${firstName !== 'Amigo' ? firstName : 'amigo'}, não consegui pegar seu nome. Pode repetir pra mim?`,
          `Ops, não entendi direito. Como você disse que se chama?`,
          `Olha, acho que não captei bem. Qual é seu nome mesmo?`
        ];
        aiResponse = retryResponses[Math.floor(Math.random() * retryResponses.length)];
      }
    }
    // ✅ FASE 2: CONVERSA PRINCIPAL COM CONTEXTO
    else {
      aiResponse = generateNutritionResponse(userText, userName || firstName || 'amigo');
    }
    
    const aiMessage = { 
      type: 'ai', 
      text: aiResponse, 
      timestamp: new Date() 
    };
    setConversation(prev => [...prev, aiMessage]);
    
    await speakText(aiResponse);
  };

  return (
    <div className="nutri-ai-container">
      {!isActive && (
        <button 
          onClick={activateNutriAI}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-full shadow-lg hover:scale-105 transition-transform z-50"
        >
          <span className="flex items-center gap-1.5 text-sm md:text-base font-semibold">
            🧠 NutriAI
          </span>
        </button>
      )}

      {isActive && (
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-[90vw] max-w-sm md:w-80 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-green-200 dark:border-green-800 z-50">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base">NutriAI - {firstName}</h3>
                <p className="text-xs opacity-90">
                  {userGender === 'male' ? 'Voz Masculina' : 'Voz Feminina'}
                </p>
              </div>
              <button 
                onClick={deactivateNutriAI}
                className="text-white hover:text-green-200 text-base bg-green-600 hover:bg-green-700 w-7 h-7 rounded-full flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="h-60 md:h-72 p-3 overflow-y-auto bg-gray-50 dark:bg-gray-950">
            {conversation.map((msg, index) => (
              <div key={index} className={`mb-3 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-[85%] p-2 rounded-xl text-sm ${
                  msg.type === 'user' 
                    ? 'bg-blue-500 text-white rounded-br-none' 
                    : 'bg-green-100 dark:bg-green-900 text-gray-800 dark:text-gray-100 rounded-bl-none border border-green-200 dark:border-green-700'
                }`}>
                  {msg.text}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            
            {/* ✅ INDICADOR DE STATUS */}
            {(isListening || isPlaying) && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                {isListening && '🎤 Ouvindo... Fale agora!'}
                {isPlaying && '🔊 NutriAI falando...'}
              </div>
            )}
          </div>

          <div className="p-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              💡 Conversa fluida ativa - Fale naturalmente
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NutriAI;
