import { supabase } from "./supabase";

/**
 * Verifica se uma recompensa específica pode ser reivindicada com base em suas condições
 * @param rewardId ID da recompensa a ser verificada
 * @returns Promise<boolean> indicando se a recompensa pode ser reivindicada
 */
export const checkCondition = async (rewardId: string): Promise<boolean> => {
  try {
    // Buscar informações da recompensa
    const { data: reward, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("id", rewardId)
      .single();

    if (error || !reward) {
      return false;
    }

    // Obter o usuário atual
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    // Buscar perfil do usuário para informações adicionais
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return false;
    }

    // ===== CONDIÇÕES ESPECÍFICAS PARA CADA RECOMPENSA =====
    // Adicione suas condições específicas aqui com base no ID da recompensa
    // Exemplo:

    switch (rewardId) {
      // ===== INSÍGNIAS DE BRONZE =====

      // Primeiros Passos
      case "2fd20b95-d44d-4856-b5bf-2d7db1d05ff7":
        // Verificar se o usuário tem pelo menos uma entrada no diário e um desafio concluído
        return await checkFirstSteps(user.id);

      // Contador/Contadora de Histórias
      case "f2032327-f808-4172-b61c-f856d11d17a6": // Masculino
      case "8828bb8d-4306-4333-9c14-71f858369aee": // Feminino
        // Verificar se o usuário escreveu uma história sobre um desafio ou emoção
        return await checkStoryTeller(user.id);

      // Arco-Íris Interior
      case "4487224c-e5aa-429c-8ec8-899655b1a2d4": // Masculino
      case "4f524b9c-be1b-48c9-b211-172168916d88": // Feminino
        // Verificar se o usuário usou 7 emoções diferentes em um mesmo dia ou semana
        return await checkEmotionVariety(user.id);

      // ===== INSÍGNIAS DE PRATA =====

      // Artista do Coração
      case "af0f155b-6195-4237-b437-da9554e9977b": // Masculino
      case "9a379e27-6a62-42ab-bedb-e76174cf26d1": // Feminino
        // Verificar se o usuário enviou um desenho sobre como se sentiu no dia
        return await checkHeartArtist(user.id);

      // Coração Corajoso
      case "8743dbfa-8b7f-4ade-a475-c7ec7123de96": // Masculino
      case "03cd1baf-444b-4bde-a695-e0c58c3ef4b3": // Feminino
        // Verificar se o usuário escreveu sobre emoções difíceis com sinceridade
        return await checkBraveHeart(user.id);

      // ===== INSÍGNIAS DE OURO =====

      // Detetive das Emoções
      case "ae312f16-9e7f-43a4-a6dc-5b816c444d29": // Masculino
      case "2335c777-b9ac-44cd-b17b-2b1138a9cc6a": // Feminino
        // Verificar se o usuário registrou 5 emoções diferentes no diário
        return await checkEmotionDetective(user.id);

      // Explorador de Sentimentos
      case "a4bb1607-a89d-4ef9-9dc7-a59a8978c009":
        // Verificar se o usuário descreveu uma situação onde aprendeu algo sobre si
        return await checkFeelingExplorer(user.id);

      // ===== INSÍGNIAS DE DIAMANTE =====

      // Desafiador/a Dedicado/a
      case "85cd801d-2f34-4bcf-a492-9ada62750b52": // Masculino
      case "b4e5add3-8446-4642-a4dd-d197128a71e5": // Feminino
        // Verificar se o usuário concluiu 7 dias seguidos de desafios
        return await checkDedicatedChallenger(user.id);

      // Guardião/ã da Calma
      case "dbc3922c-cb6f-43ab-a91c-311d1fadf6b9": // Masculino
      case "63aaaf41-cda7-4010-9cf4-f31b8e074258": // Feminino
        // Verificar se o usuário resolveu 6 desafios semanais para acalmar a mente
        return await checkCalmGuardian(user.id);

      // Passo de Formiguinha
      case "0435d177-e898-4284-9917-1d6bdf4f56a8":
        // Verificar se o usuário registrou a mesma emoção todos os dias durante uma semana
        return await checkAntStep(user.id);

      // Leitor/a de Histórias
      case "b913c2af-a55e-4116-b947-f14ccebe3be8": // Masculino
      case "9d5c235b-b04d-4814-bbb3-cc86c814d561": // Feminino
        // Verificar se o usuário leu todas as histórias disponíveis no EmoLink
        return await checkStoryReader(user.id);

      // Guardião/ã da Jornada
      case "7db4a9ba-fab9-4e7f-ab48-ab00174c881d": // Masculino
      case "800a93bb-75c3-4c02-81cf-6520dfbb1ba8": // Feminino
        // Verificar se o usuário completou 1 mês usando o EmoLink
        return await checkJourneyGuardian(user.id);

      // Mestre dos Rabiscos
      case "61d4a04d-ba06-4404-808c-e6398b01b493":
        // Verificar se o usuário fez 10 desenhos ao longo do mês
        return await checkScribbleMaster(user.id);

      // Pincel Mágico
      case "069521b0-c47b-441e-9fcd-06e4ea2bef90":
        // Verificar se o usuário registrou mais de 30 desenhos no EmoLink
        return await checkMagicBrush(user.id);

      // Caso padrão: se não houver condição específica, retorna true
      default:
        return true;
    }
  } catch (error) {
    return false;
  }
};

// ===== FUNÇÕES AUXILIARES PARA VERIFICAR CONDIÇÕES ESPECÍFICAS =====
// Implemente estas funções com a lógica específica para cada tipo de recompensa

/**
 * Verifica se o usuário tem pelo menos uma entrada no diário e um desafio concluído
 */
const checkFirstSteps = async (userId: string): Promise<boolean> => {
  // 1. Verificar se há pelo menos uma entrada no diário
  const { data: journalEntries, error: journalError } = await supabase
    .from("emotion_entries")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (journalError || !journalEntries || journalEntries.length === 0) {
    return false;
  }

  // 2. Verificar se há pelo menos um desafio concluído
  const { data: completedChallenges, error: challengeError } = await supabase
    .from("completed_challenges")
    .select("*")
    .eq("user_id", userId)
    .limit(1);

  if (
    challengeError ||
    !completedChallenges ||
    completedChallenges.length === 0
  ) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário escreveu uma história sobre um desafio ou emoção
 */
const checkStoryTeller = async (userId: string): Promise<boolean> => {
  // 1. Verificar se o usuário escreveu uma história
  const { data: completedChallenges, error: challengeError } = await supabase
    .from("completed_challenges")
    .select("*")
    .eq("user_id", userId)
    .not("answer", "is", null)
    .limit(1);

  if (
    challengeError ||
    !completedChallenges ||
    completedChallenges.length === 0
  ) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário usou 6 emoções diferentes em um mesmo dia ou semana
 */
const checkEmotionVariety = async (userId: string): Promise<boolean> => {
  // 1. Verificar se o usuário usou 6 emoções diferentes em um mesmo dia ou semana
  const { data: emotionEntries, error: emotionEntriesError } = await supabase
    .from("emotion_entries")
    .select("emotion_type, created_at")
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Últimos 7 dias
    .order("created_at", { ascending: false });

  if (emotionEntriesError || !emotionEntries || emotionEntries.length < 6) {
    return false;
  }

  // Verificar se há 7 emoções diferentes
  const uniqueEmotions = new Set(
    emotionEntries.map((entry) => entry.emotion_type)
  );
  if (uniqueEmotions.size < 6) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário enviou um desenho sobre como se sentiu no dia
 */
const checkHeartArtist = async (userId: string): Promise<boolean> => {
  // 1. Verificar se o usuário enviou um desenho
  const { data: drawings, error: drawingError } = await supabase
    .from("completed_challenges")
    .select("drawing_url")
    .eq("user_id", userId)
    .not("drawing_url", "is", null)
    .limit(1);

  if (drawingError || !drawings || drawings.length === 0) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário escreveu sobre uma emoção difícil com sinceridade
 */
const checkBraveHeart = async (userId: string): Promise<boolean> => {
  // 1. Verificar se o usuário escreveu sobre as 3 emoções difíceis com sinceridade
  const { data: journalEntries, error: journalError } = await supabase
    .from("emotion_entries")
    .select("*")
    .eq("user_id", userId);

  if (journalError || !journalEntries || journalEntries.length === 0) {
    return false;
  }

  // Verificar se as emoções são difíceis (exemplo: triste, ansioso, bravo)
  const uniqueEmotions = new Set(
    journalEntries.map((entry) => entry.emotion_type)
  );
  const difficultEmotions = ["sad", "upset", "angry"];

  // Verificar se todas as emoções difíceis estão presentes
  const hasAllDifficultEmotions = difficultEmotions.every((emotion) =>
    uniqueEmotions.has(emotion)
  );

  if (!hasAllDifficultEmotions) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário registrou 5 emoções diferentes no diário
 */
const checkEmotionDetective = async (userId: string): Promise<boolean> => {
  // Verificar se o usuário registrou 5 emoções diferentes no diário
  const { data: journalEntries, error: journalError } = await supabase
    .from("emotion_entries")
    .select("emotion_type")
    .eq("user_id", userId);

  if (journalError || !journalEntries || journalEntries.length === 0) {
    return false;
  }

  // Verificar se há 5 emoções diferentes
  const uniqueEmotions = new Set(
    journalEntries.map((entry) => entry.emotion_type)
  );
  if (uniqueEmotions.size < 5) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário descreveu uma situação onde aprendeu algo sobre si
 */
const checkFeelingExplorer = async (userId: string): Promise<boolean> => {
  // 1. Verifica se o usuário descreveu uma situação onde aprendeu algo sobre si
  const { data: completedChallenges, error: challengeError } = await supabase
    .from("completed_challenges")
    .select("*")
    .eq("user_id", userId)
    .not("answer", "is", null)
    .limit(1);

  if (
    challengeError ||
    !completedChallenges ||
    completedChallenges.length === 0
  ) {
    return false;
  }

  return true;
};

/**
 * Verifica se o usuário concluiu 7 dias seguidos de desafios
 */
const checkDedicatedChallenger = async (userId: string): Promise<boolean> => {
  // 1. Verifica se o usuário concluiu 7 dias seguidos de desafios
  const { data: completedChallenges, error: challengeError } = await supabase
    .from("completed_challenges")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (
    challengeError ||
    !completedChallenges ||
    completedChallenges.length < 7
  ) {
    return false;
  }

  // Verificar se os desafios foram concluídos em dias consecutivos
  for (let i = 1; i < completedChallenges.length; i++) {
    const currentDate = new Date(completedChallenges[i].created_at);
    const prevDate = new Date(completedChallenges[i - 1].created_at);

    // Verificar se as datas são consecutivas
    const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays !== 1) {
      return false; // Se não forem consecutivas, retorna falso
    }
  }

  return true;
};

/**
 * Verifica se o usuário resolveu 6 desafios semanais para acalmar a mente
 */
const checkCalmGuardian = async (userId: string): Promise<boolean> => {
  // 1. Verifica se o usuário resolveu desafios concluídos
  const { data: completedChallenges, error: challengeError } = await supabase
    .from("completed_challenges")
    .select("challenge_id")
    .eq("user_id", userId)
    .eq("challenge_type", "weekly");

  if (challengeError || !completedChallenges) {
    return false;
  }

  if (completedChallenges.length < 6) {
    return false; // Se não houver 6 desafios concluídos, retorna falso
  }

  return true;
};

/**
 * Verifica se o usuário registrou a mesma emoção todos os dias durante uma semana
 */
const checkAntStep = async (userId: string): Promise<boolean> => {
    // 1. Verifica se o usuário registrou a mesma emoção todos os dias durante uma semana
    const { data: journalEntries, error: journalError } = await supabase
      .from("emotion_entries")
      .select("emotion_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }); // Ordenar em ordem crescente para facilitar a verificação
  
    if (
      journalError ||
      !journalEntries ||
      journalEntries.length < 7
    ) {
      return false;
    }
  
    // 2. Verificar se há 7 dias consecutivos com a mesma emoção
    let consecutiveDays = 1; // Contador de dias consecutivos
    for (let i = 1; i < journalEntries.length; i++) {
      const currentDate = new Date(journalEntries[i].created_at);
      const prevDate = new Date(journalEntries[i - 1].created_at);
  
      // Verificar se as datas são consecutivas
      const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
      if (diffDays === 1 && journalEntries[i].emotion_type === journalEntries[i - 1].emotion_type) {
        // Incrementar contador se for o mesmo tipo de emoção e dias consecutivos
        consecutiveDays++;
      } else {
        // Reiniciar contador se não forem consecutivos ou a emoção for diferente
        consecutiveDays = 1;
      }
  
      // Verificar se atingiu 7 dias consecutivos
      if (consecutiveDays === 7) {
        return true;
      }
    }
  
    return false; // Retorna falso se não encontrar 7 dias consecutivos com a mesma emoção
  };

/**
 * Verifica se o usuário leu todas as histórias disponíveis no EmoLink
 */
const checkStoryReader = async (userId: string): Promise<boolean> => {
  // 1. Verifica se o usuário leu todas as histórias disponíveis no EmoLink
    const { data: stories, error: storiesError } = await supabase
        .from("user_stories")
        .select("story_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

    if (storiesError || !stories) {
        return false;
    }

    // 2. Verifica se o usuário leu todas as histórias disponíveis no EmoLink
    const { data: allStories, error: allStoriesError } = await supabase
        .from("stories")
        .select("id")
        .order("created_at", { ascending: true });

    if (allStoriesError || !allStories) {
        return false;
    }

    // 3. Verifica se o usuário leu todas as histórias disponíveis no EmoLink
    if (allStories.length !== stories.length) {
        return false;
    }

  return true; 
};

/**
 * Verifica se o usuário completou 1 mês usando o EmoLink
 */
const checkJourneyGuardian = async (userId: string): Promise<boolean> => {
    // 1. Verifica se o usuário completou 1 mês usando o EmoLink
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("user_id", userId)
      .single();
  
    if (profileError || !userProfile) {
      return false;
    }
  
    // 2. Verifica se o usuário completou 30 dias usando o EmoLink
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Subtrai 30 dias da data atual
  
    if (new Date(userProfile.created_at) > thirtyDaysAgo) {
      return false; // Se o perfil foi criado há menos de 30 dias, retorna falso
    }
  
    return true; // Retorna verdadeiro se o perfil foi criado há pelo menos 30 dias
  };

/**
 * Verifica se o usuário fez 10 desenhos ao longo do mês
 */
const checkScribbleMaster = async (userId: string): Promise<boolean> => {
  // 1. Verifica se o usuário fez 10 desenhos ao longo do mês
  const { data: drawings, error: drawingError } = await supabase
    .from("completed_challenges")
    .select("drawing_url, created_at") 
    .eq("user_id", userId)
    .not("drawing_url", "is", null)
    .order("created_at", { ascending: true });

  if (drawingError || !drawings || drawings.length < 10) {
    return false;
  }

    // Verifica se os desenhos foram feitos ao longo do mês
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    for (const drawing of drawings) {
      const drawingDate = new Date(drawing.created_at);
      if (drawingDate < firstDayOfMonth) {
        return false; // Se algum desenho foi feito antes do primeiro dia do mês atual, retorna falso
      }
    }

  return true;
};

/**
 * Verifica se o usuário registrou mais de 30 desenhos no EmoLink
 */
const checkMagicBrush = async (userId: string): Promise<boolean> => {
  // 1. Verifica se o usuário registrou mais de 30 desenhos no EmoLink
    const { data: drawings, error: drawingError } = await supabase
        .from("completed_challenges")
        .select("drawing_url")
        .eq("user_id", userId)
        .not("drawing_url", "is", null);

    if (drawingError || !drawings || drawings.length < 30) {
        return false;
    }

  return true; 
};
