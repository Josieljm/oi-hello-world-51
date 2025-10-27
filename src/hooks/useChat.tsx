import { useState, useRef, useCallback } from 'react';
import { useVoice } from './useVoice';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationContext {
  hasIntroduced: boolean;
  lastObjective: string;
  userPreferences: string[];
  mood: string;
}

interface Intent {
  type: string;
  data?: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userName, setUserName] = useState('');
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    hasIntroduced: false,
    lastObjective: '',
    userPreferences: [],
    mood: 'neutral'
  });
  
  const { speak, isLoading: isVoiceLoading } = useVoice();
  const chatHistoryRef = useRef<Message[]>([]);

  // Analisar intenção do usuário de forma mais inteligente
  const analyzeIntent = useCallback((message: string): Intent => {
    const lowerMsg = message.toLowerCase().trim();
    
    // Padrões para captura de nome
    const namePatterns = [
      /(meu nome é|me chamo|sou o|sou a|pode me chamar de)\s+([a-záàâãéèêíïóôõöúçñ]{2,20})/i,
      /(nome é)\s+([a-záàâãéèêíïóôõöúçñ]{2,20})/i,
      /^([a-záàâãéèêíïóôõöúçñ]{2,20})$/i // Apenas um nome sem contexto
    ];
    
    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[2]) {
        const name = match[2].split(' ')[0].trim();
        if (name.length >= 2 && name.length <= 20) {
          return { type: 'set_name', data: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() };
        }
      } else if (pattern.test(lowerMsg) && lowerMsg.split(' ').length === 1) {
        // Caso o usuário digite apenas o nome
        const name = lowerMsg;
        if (name.length >= 2 && name.length <= 20 && !/[0-9]/.test(name)) {
          return { type: 'set_name', data: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() };
        }
      }
    }

    // Outras intenções
    if (/(oi|olá|ola|e aí|eai|hello|hi|opa)/.test(lowerMsg)) {
      return { type: 'greeting' };
    }
    
    if (/(dia|data|hoje|que dia)/.test(lowerMsg)) {
      return { type: 'date_info' };
    }
    
    if (/(emagrecer|perder peso|secar|dieta|emagrecimento)/.test(lowerMsg)) {
      return { type: 'weight_loss' };
    }
    
    if (/(massa|muscular|ganhar|forte|hipertrofia)/.test(lowerMsg)) {
      return { type: 'muscle_gain' };
    }
    
    if (/(energia|força|cansado|fadiga|disposição)/.test(lowerMsg)) {
      return { type: 'energy' };
    }
    
    if (/(receita|comer|refeição|fome|almoço|janta|jantar|lanche|ceia)/.test(lowerMsg)) {
      return { type: 'meal_suggestion' };
    }
    
    if (/(obrigado|obrigada|valeu|agradeço)/.test(lowerMsg)) {
      return { type: 'thanks' };
    }
    
    return { type: 'general' };
  }, []);

  // Gerar resposta contextual baseada na intenção
  const generateResponse = useCallback((userMessage: string, intent: Intent): string => {
    const currentTime = new Date().getHours();
    const timeGreeting = currentTime < 12 ? 'bom dia' : currentTime < 18 ? 'boa tarde' : 'boa noite';
    
    switch (intent.type) {
      case 'set_name':
        const name = intent.data!;
        setUserName(name);
        setConversationContext(prev => ({ ...prev, hasIntroduced: true }));
        
        const nameResponses = [
          `Prazer, ${name}! Agora sou seu NutriAI pessoal! Em que posso ajudar sua nutrição hoje?`,
          `Que nome lindo, ${name}! Estou aqui para te ajudar com alimentação e saúde. Qual seu objetivo?`,
          `Oi, ${name}! Sou seu assistente nutricional! Vamos fazer uma jornada incrível juntos!`,
          `Encantado, ${name}! Pronto para transformar sua alimentação? Como posso ajudar?`
        ];
        return nameResponses[Math.floor(Math.random() * nameResponses.length)];

      case 'greeting':
        if (userName) {
          const greetingResponses = [
            `E aí, ${userName}! Como está seu dia?`,
            `Oi, ${userName}! Pronto para evoluir hoje?`,
            `Que bom te ver, ${userName}! No que posso ajudar?`,
            `${timeGreeting}, ${userName}! Como vai sua energia hoje?`
          ];
          return greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
        } else {
          const initialGreetings = [
            `Olá! Eu sou seu NutriAI. Qual é o seu nome?`,
            `Oi! Sou seu assistente nutricional. Como você se chama?`,
            `Prazer! Sou seu NutriAI. Qual seu nome para começarmos?`,
            `Olá! Vamos melhorar sua alimentação juntos! Qual é o seu nome?`
          ];
          return initialGreetings[Math.floor(Math.random() * initialGreetings.length)];
        }

      case 'weight_loss':
        setConversationContext(prev => ({ ...prev, lastObjective: 'weight_loss' }));
        const weightLossResponses = userName ? [
          `Perfeito, ${userName}! Para emagrecer: foco em proteínas magras e vegetais! Que tal salmão com aspargos?`,
          `${userName}, para perder peso: salada de grão-de-bico com atum é ótima! Baixa caloria, muita nutrição!`,
          `Vamos lá, ${userName}! Para emagrecer: abuse de vegetais verdes e proteínas magras. Frango grelhado com brócolis?`
        ] : [
          `Para emagrecer: foco em proteínas magras e vegetais! Salmão com aspargos é uma ótima opção!`,
          `Emagrecimento saudável: salada de grão-de-bico com atum! Nutritivo e saciante!`,
          `Dica para perder peso: vegetais verdes e proteínas magras! Frango com brócolis é perfeito!`
        ];
        return weightLossResponses[Math.floor(Math.random() * weightLossResponses.length)];

      case 'muscle_gain':
        setConversationContext(prev => ({ ...prev, lastObjective: 'muscle_gain' }));
        const muscleGainResponses = userName ? [
          `Excelente, ${userName}! Para ganhar massa: proteína máxima! Frango com batata doce e ovos!`,
          `${userName}, massa muscular precisa de proteína! Peito de frango com quinoa e abacate!`,
          `Hora da hipertrofia, ${userName}! Ovos, frango, whey protein - combustível muscular!`
        ] : [
          `Para ganhar massa: proteína é fundamental! Frango com batata doce e ovos!`,
          `Hipertrofia precisa de proteína! Peito de frango com quinoa e vegetais!`,
          `Massa muscular: foco em proteínas! Ovos, carne, whey - construa músculos!`
        ];
        return muscleGainResponses[Math.floor(Math.random() * muscleGainResponses.length)];

      case 'energy':
        const energyResponses = userName ? [
          `Energia, ${userName}? Aveia com banana e whey! Combustível perfeito!`,
          `${userName}, para mais disposição: smoothie de espinafre com gengibre! Revitalizante!`,
          `Fadiga, ${userName}? Batata doce e frango dão energia duradoura!`
        ] : [
          `Para energia: aveia com banana e whey! Combustível premium!`,
          `Mais disposição: smoothie de espinafre com gengibre! Revitaliza!`,
          `Energia duradoura: batata doce com proteína! Combustível de qualidade!`
        ];
        return energyResponses[Math.floor(Math.random() * energyResponses.length)];

      case 'meal_suggestion':
        const mealResponses = userName ? [
          `Claro, ${userName}! Que tal um stir-fry de legumes com frango? Rápido e nutritivo!`,
          `${userName}, sugestão: peixe assado com legumes! Fácil e super saudável!`,
          `Pensei em você, ${userName}! Wrap de folhas com homus e vegetais! Delicioso!`
        ] : [
          `Sugestão: stir-fry de legumes com frango! Prático e nutritivo!`,
          `Que tal peixe assado com legumes? Saudável e saboroso!`,
          `Experimente wrap de folhas com homus! Leve e gostoso!`
        ];
        return mealResponses[Math.floor(Math.random() * mealResponses.length)];

      case 'thanks':
        const thanksResponses = userName ? [
          `Por nada, ${userName}! Estou aqui sempre que precisar!`,
          `De nada, ${userName}! Fico feliz em ajudar!`,
          `Imagina, ${userName}! Qualquer dúvida, estou aqui!`
        ] : [
          `Por nada! Estou aqui para ajudar!`,
          `De nada! Fico feliz em poder ajudar!`,
          `Imagina! Qualquer coisa, é só chamar!`
        ];
        return thanksResponses[Math.floor(Math.random() * thanksResponses.length)];

      case 'date_info':
        const today = new Date().toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        return userName ? 
          `Hoje é ${today}, ${userName}! Dia perfeito para comer bem!` :
          `Hoje é ${today}! Ótimo dia para focar na nutrição!`;

      default:
        // Resposta para mensagens não reconhecidas
        const generalResponses = userName ? [
          `Interessante, ${userName}! Como isso se relaciona com seus objetivos nutricionais?`,
          `Hmm, ${userName}... Vamos conectar isso com sua alimentação?`,
          `Entendi, ${userName}! E como você está se sentindo com sua dieta atual?`,
          `${userName}, conte mais! Estou aqui para ajudar sua jornada nutricional!`
        ] : [
          `Interessante! Como posso ajudar sua nutrição hoje?`,
          `Hmm, entendi! Vamos focar na sua alimentação?`,
          `Conte mais! Estou aqui para ajudar com sua dieta e saúde!`
        ];
        return generalResponses[Math.floor(Math.random() * generalResponses.length)];
    }
  }, [userName]);

  // Processar mensagem do usuário
  const sendMessage = useCallback(async (content: string, useVoice: boolean = true) => {
    if (!content.trim() || isProcessing) return;

    setIsProcessing(true);
    
    // Adicionar mensagem do usuário
    const userMessage: Message = { role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    chatHistoryRef.current = [...chatHistoryRef.current, userMessage];

    try {
      // Analisar intenção para contexto
      const intent = analyzeIntent(content);
      
      // Preparar histórico para enviar ao ChatGPT
      const messagesToSend = chatHistoryRef.current.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Chamar a edge function para obter resposta do ChatGPT
      const NUTRI_AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nutri-ai-chat`;
      
      const response = await fetch(NUTRI_AI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend,
          userName: userName,
          intent: intent.type
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao comunicar com NutriAI');
      }

      const data = await response.json();
      const aiResponse = data.message;
      
      // Adicionar resposta do AI
      const aiMessage: Message = { role: 'assistant', content: aiResponse, timestamp: new Date() };
      setMessages(prev => [...prev, aiMessage]);
      chatHistoryRef.current = [...chatHistoryRef.current, aiMessage];

      // Falar a resposta se solicitado
      if (useVoice && !isVoiceLoading) {
        await speak(aiResponse, 'female');
      }

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Desculpe, tive um problema. Pode repetir?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [analyzeIntent, userName, speak, isProcessing, isVoiceLoading]);

  // Inicializar conversa
  const startConversation = useCallback(async () => {
    const welcomeMessage: Message = {
      role: 'assistant',
      content: 'Olá! Eu sou seu NutriAI. Qual é o seu nome?',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
    chatHistoryRef.current = [welcomeMessage];
    
    // Falar a mensagem de boas-vindas
    setTimeout(() => speak('Olá! Eu sou seu NutriAI. Qual é o seu nome?', 'female'), 1000);
  }, [speak]);

  return {
    messages,
    sendMessage,
    startConversation,
    isProcessing,
    userName,
    conversationContext
  };
};
