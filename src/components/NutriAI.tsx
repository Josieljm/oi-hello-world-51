import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const NutriAI = () => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState<Array<{type: string; text: string; timestamp: Date}>>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [conversationStage, setConversationStage] = useState<'start' | 'main'>('start');
  const recognitionRef = useRef<any>(null);
  const [userGender, setUserGender] = useState('male');
  // ✅ MEMÓRIA DE CURTO PRAZO (até 5 interações) - v3.0
  const conversationMemory = useRef<Array<{
    userMessage: string;
    aiResponse: string;
    topic: string;
    emotion: string;
    timestamp: Date;
  }>>([]);
  
  const conversationContext = useRef({
    lastTopic: '',
    userGoals: '',
    dietaryPreferences: '',
    lastMeal: '',
    currentObjective: '',
    emotionalState: 'neutral'
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
  const detectUserGender = (name: string) => {
    const maleNames = ['carlos', 'joão', 'pedro', 'marcos', 'lucas', 'josiel', 'miguel', 'rafael', 
                       'fernando', 'ricardo', 'rodrigo', 'paulo', 'bruno', 'andré', 'felipe'];
    const femaleNames = ['ana', 'maria', 'julia', 'carla', 'patricia', 'fernanda', 'beatriz', 'amanda',
                         'juliana', 'carolina', 'gabriela', 'camila', 'leticia', 'mariana', 'paula'];
    
    const cleanName = name.toLowerCase().trim();
    if (maleNames.includes(cleanName)) return 'male';
    if (femaleNames.includes(cleanName)) return 'female';
    return 'male'; // padrão
  };

  // ✅ DETECTAR EMOÇÃO DO USUÁRIO (v3.0)
  const detectEmotion = (message: string): string => {
    const lowerMsg = message.toLowerCase();
    
    if (lowerMsg.match(/triste|desanim|cansad|deprimi|chate|mal/)) return 'sad';
    if (lowerMsg.match(/felic|anim|empolgad|otimo|ótimo|show|massa|legal/)) return 'happy';
    if (lowerMsg.match(/ansios|preocup|nervos|stress|estress/)) return 'anxious';
    if (lowerMsg.match(/conf|dúvid|duvid|não sei|perdid/)) return 'confused';
    
    return 'neutral';
  };

  // ✅ CONFIGURAÇÃO DE VOZ CARISMÁTICA E NATURAL POR GÊNERO (v3.0)
  const getVoiceSettings = (emotion: string = 'neutral') => {
    const baseSettings = userGender === 'male' ? {
      rate: 0.9,     // Velocidade natural v3.0
      pitch: 0.88,   // Tom masculino agradável
      volume: 1.0,
      pauseBetweenPhrases: 0.5,
      microPauses: [0.3, 0.5],
      voiceType: 'masculina_humanizada_calma'
    } : {
      rate: 0.9,     // Velocidade natural v3.0
      pitch: 1.12,   // Tom feminino agradável
      volume: 1.0,
      pauseBetweenPhrases: 0.5,
      microPauses: [0.3, 0.5],
      voiceType: 'feminina_humanizada_agradavel'
    };
    
    // ✅ Ajustar velocidade baseado na emoção detectada
    if (emotion === 'sad') baseSettings.rate = 0.85; // Mais devagar e empático
    if (emotion === 'happy') baseSettings.rate = 0.95; // Mais animado
    if (emotion === 'anxious') baseSettings.rate = 0.88; // Calmo para acalmar
    
    return baseSettings;
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
        console.log('🎤 Microfone ativo - ouvindo continuamente');
        setIsListening(true);
      };

      recognition.onend = () => {
        console.log('🔇 Microfone pausado');
        setIsListening(false);
        // ✅ RECONECTAR AUTOMATICAMENTE
        if (isActive && !isSpeaking) {
          setTimeout(() => {
            if (recognitionRef.current && isActive) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.log('Reconhecimento já ativo');
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
          console.log('👤 Usuário disse:', finalTranscript);
          handleUserMessage(finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.log('❌ Erro no microfone:', event.error);
        if (event.error === 'not-allowed') {
          alert('Permissão de microfone negada. Ative o microfone para conversar com o NutriAI.');
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isActive, isSpeaking]);

  // ✅ FALA CARISMÁTICA COM PAUSAS E EMOÇÃO (v3.0 - com micro pausas)
  const speakText = (text: string, emotion: string = 'neutral') => {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance();
      
      // ✅ CONFIGURAÇÕES PARA VOZ CARISMÁTICA E ENVOLVENTE COM EMOÇÃO
      const voiceSettings = getVoiceSettings(emotion);
      utterance.rate = voiceSettings.rate;
      utterance.pitch = voiceSettings.pitch;
      utterance.volume = voiceSettings.volume;
      utterance.lang = 'pt-BR';
      
      // ✅ PAUSAS NATURAIS COM MICRO VARIAÇÕES (v3.0)
      const naturalText = text
        .replace(/\.\.\./g, '... ')  // Pausas reflexivas
        .replace(/!/g, '! ')         // Ênfase com pausa
        .replace(/\?/g, '? ')         // Pergunta com pausa
        .replace(/,/g, ', ')          // Micro pausas em vírgulas (0.3s)
        .replace(/\./g, '. ');        // Pausa entre frases (0.5s)
      
      utterance.text = naturalText;

      // ✅ TENTAR ENCONTRAR VOZES NATIVAS BRASILEIRAS
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(voice => 
        voice.lang.includes('pt') && 
        ((userGender === 'male' && voice.name.toLowerCase().includes('male')) ||
         (userGender === 'female' && voice.name.toLowerCase().includes('female')))
      );

      if (ptVoice) {
        utterance.voice = ptVoice;
      }

      utterance.onstart = () => {
        console.log('🔊 NutriAI falando...');
        setIsSpeaking(true);
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };

      utterance.onend = () => {
        console.log('🔇 NutriAI terminou de falar');
        setIsSpeaking(false);
        if (isActive && recognitionRef.current) {
          // ✅ Pausa de 0.5s antes de reativar microfone (v3.0)
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('Reconhecimento já ativo');
            }
          }, 500);
        }
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ Erro na fala:', event);
        setIsSpeaking(false);
        resolve();
      };

      // ✅ FALA COM PAUSA INICIAL PARA SOAR NATURAL
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 300);
    });
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
          console.log('Reconhecimento já ativo');
        }
      }, 1500);
    }
  };

  // ✅ DESATIVAR CORRETAMENTE
  const deactivateNutriAI = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    window.speechSynthesis.cancel();
    setIsActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setConversation([]);
  };

  // ✅ ADICIONAR À MEMÓRIA (v3.0)
  const addToMemory = (userMsg: string, aiResp: string, topic: string, emotion: string) => {
    conversationMemory.current.push({
      userMessage: userMsg,
      aiResponse: aiResp,
      topic,
      emotion,
      timestamp: new Date()
    });
    
    // ✅ Manter apenas últimas 5 interações
    if (conversationMemory.current.length > 5) {
      conversationMemory.current.shift();
    }
  };

  // ✅ VERIFICAR MEMÓRIA PARA CONTEXTO (v3.0)
  const checkMemoryForContext = (currentMessage: string): string | null => {
    const lowerMsg = currentMessage.toLowerCase();
    
    // ✅ Se usuário perguntar sobre algo anterior
    if (lowerMsg.match(/lembra|falei|disse|comentei|ontem|antes/)) {
      const recentMemory = conversationMemory.current[conversationMemory.current.length - 1];
      if (recentMemory) {
        return `Lembro sim! Você comentou sobre ${recentMemory.topic}. Como foi?`;
      }
    }
    
    // ✅ Se usuário mencionar refeição novamente
    if (conversationContext.current.lastMeal && lowerMsg.includes(conversationContext.current.lastMeal.toLowerCase())) {
      return `Ah, você tá falando daquele ${conversationContext.current.lastMeal} que comentou? Quer ajustar algo nele?`;
    }
    
    return null;
  };

  // ✅ RESPOSTAS CARISMÁTICAS COM VARIAÇÃO E EMOÇÃO (v3.0)
  const generateNutritionResponse = (userMessage: string, speakerName: string) => {
    const lowerMessage = userMessage.toLowerCase();
    
    // ✅ Verificar memória primeiro (v3.0)
    const memoryResponse = checkMemoryForContext(userMessage);
    if (memoryResponse) return memoryResponse;
    
    // ✅ RESPOSTAS COM VARIAÇÃO - nunca repete a mesma estrutura
    const responseVariations: Record<string, string[]> = {
      'emagrecer|perder peso|peso': [
        `Entendi, ${speakerName}. A gente pode começar ajustando pequenas coisas, tipo trocar refrigerante por água saborizada ou incluir frutas no lanche. Quer que eu te ajude a montar um plano leve pra essa semana?`,
        `Legal isso! Quer perder peso? Olha só, o segredo tá na consistência, não em dieta maluca. Que tal a gente focar em trocar alimentos industrializados por comida de verdade? Topa?`,
        `Boa pergunta! Perder peso com saúde é totalmente possível, ${speakerName}. Vamos começar pelo básico: mais água, menos açúcar, e comida caseira. Posso te dar um cardápio simples pra testar?`,
        `Poxa, ${speakerName}, emagrecer é sobre criar hábitos, não fazer sacrifício! Vamos começar leve: troca um lanche industrializado por fruta hoje. Quer tentar?`
      ],
      'massa|ganhar massa|muscular|musculação|força': [
        `Show! Nesse caso, a base é proteína e constância. Pensa em ovos, peixes, frango e leguminosas como feijão e lentilha. Posso te dar umas opções de lanche pós-treino?`,
        `${speakerName}, pra ganhar massa você precisa de proteínas magras, carboidratos bons e bastante água. Um exemplo seria frango grelhado com batata-doce e salada colorida. Quer que eu monte um cardápio rápido pra isso?`,
        `Massa muscular é meu forte! A dica é: proteína em todas as refeições. Ovos no café, frango no almoço, peixe no jantar. Quer saber as quantidades ideais pra você?`,
        `Tô contigo nisso, ${speakerName}! Pra ganhar massa, come proteína de qualidade e não pula refeições. Bora montar um plano pra você?`
      ],
      'receita|receitas|prato|comida|refeição': [
        `Boa! Vamos de receitas então. Me conta, você curte comida mais leve ou algo mais substancial? E tem algum ingrediente que você ama?`,
        `Olha só, ${speakerName}, tenho várias receitas fit e gostosas! Quer algo rápido pro dia a dia ou uma receita especial pra fim de semana?`,
        `Receitas é comigo mesmo! Que tal a gente montar algo com ingredientes que você já tem em casa? Me fala o que tem na geladeira!`
      ],
      'água|hidrat': [
        `${speakerName}, água é vida! Sério, bebe pelo menos 2 litros por dia. Seu corpo vai agradecer, confia. Quer dicas pra lembrar de beber mais?`,
        `Olha só, água é fundamental! Se você treina, aumenta pra uns 3 litros. E se achar sem graça, adiciona limão ou hortelã. Fica show!`,
        `Boa! Água é essencial pra tudo: metabolismo, pele, energia... Tenta sempre ter uma garrafa por perto, ajuda demais!`,
        `${speakerName}, beber água é básico mas muita gente esquece! Deixa uma garrafa sempre por perto, pode ser?`
      ],
      'dia|hoje|data|clima': [
        `Hoje é ${new Date().toLocaleDateString('pt-BR')}! Aliás, ótimo dia pra cuidar da alimentação, né? Quer que eu te lembre de beber mais água hoje?`,
        `Olha só, hoje tá perfeito pra começar hábitos saudáveis! Me conta, ${speakerName}, como foi sua alimentação até agora hoje?`
      ],
      'desanim|triste|cansad|sono': [
        `Poxa, entendo... tem dias assim mesmo, ${speakerName}. Que tal a gente tentar ajustar sua alimentação pra te dar mais energia? Às vezes, um bom café da manhã muda tudo!`,
        `Sei como é. Cansaço pode ser falta de nutrientes, sabia? Vamos revisar o que você tá comendo? Pode ser que falte ferro ou vitaminas do complexo B.`,
        `${speakerName}, tô contigo nisso. Alimentação afeta muito nosso humor, viu? Vamos ajustar pra você ter mais disposição?`
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

    // ✅ Procura resposta variada (v3.0 - com memória)
    for (const [keys, responses] of Object.entries(responseVariations)) {
      const keyList = keys.split('|');
      if (keyList.some(key => lowerMessage.includes(key))) {
        // Seleciona resposta aleatória para variação
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // ✅ Atualiza contexto da conversa (v3.0)
        const topic = keys.split('|')[0];
        conversationContext.current.lastTopic = topic;
        
        if (topic === 'emagrecer' || topic === 'perder peso') {
          conversationContext.current.currentObjective = 'emagrecimento';
        } else if (topic === 'massa' || topic === 'ganhar massa') {
          conversationContext.current.currentObjective = 'ganho de massa';
        }
        
        // ✅ Salvar última refeição mencionada
        if (lowerMessage.match(/café|almoço|jantar|lanche/)) {
          conversationContext.current.lastMeal = lowerMessage.match(/café|almoço|jantar|lanche/)?.[0] || '';
        }
        
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
    // ✅ FASE 2: CONVERSA PRINCIPAL COM CONTEXTO (v3.0)
    else {
      const detectedEmotion = detectEmotion(userText);
      conversationContext.current.emotionalState = detectedEmotion;
      
      aiResponse = generateNutritionResponse(userText, userName || firstName || 'amigo');
      
      // ✅ Adicionar à memória (v3.0)
      addToMemory(userText, aiResponse, conversationContext.current.lastTopic, detectedEmotion);
    }
    
    const aiMessage = { 
      type: 'ai', 
      text: aiResponse, 
      timestamp: new Date() 
    };
    setConversation(prev => [...prev, aiMessage]);
    
    // ✅ Falar com emoção ajustada (v3.0)
    await speakText(aiResponse, conversationContext.current.emotionalState);
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
            {(isListening || isSpeaking) && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                {isListening && '🎤 Ouvindo... Fale agora!'}
                {isSpeaking && '🔊 NutriAI falando...'}
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
