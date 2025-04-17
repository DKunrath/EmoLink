import { supabase } from "../services/supabase"

// Interface para o resultado do cálculo de streak
export interface StreakResult {
  currentStreak: number
  longestStreak: number
  lastEntryDate: string | null
}

/**
 * Calcula o streak atual e o streak mais longo de um usuário
 * @param userId ID do usuário
 * @returns Objeto com o streak atual, o streak mais longo e a data da última entrada
 */
export const calculateUserStreak = async (userId: string): Promise<StreakResult> => {
  try {
    if (!userId) {
      throw new Error("ID de usuário não fornecido")
    }

    // Buscar todas as entradas do usuário, ordenadas por data
    const { data, error } = await supabase
      .from("emotion_entries")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    if (!data || data.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastEntryDate: null,
      }
    }

    // Converter timestamps para objetos Date e agrupar por dia
    const entriesByDay = new Map<string, boolean>()

    data.forEach((entry) => {
      const entryDate = new Date(entry.created_at)
      const dateString = entryDate.toISOString().split("T")[0] // YYYY-MM-DD
      entriesByDay.set(dateString, true)
    })

    // Obter a data atual e a data da última entrada
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayString = today.toISOString().split("T")[0]

    const lastEntryDate = data[0]?.created_at ? new Date(data[0].created_at) : null
    const lastEntryDateString = lastEntryDate ? lastEntryDate.toISOString().split("T")[0] : null

    // Verificar se há entrada para hoje
    let currentStreak = entriesByDay.has(todayString) ? 1 : 0

    // Se não há entrada hoje, verificar se há entrada de ontem para continuar a contagem
    if (currentStreak === 0 && lastEntryDateString) {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayString = yesterday.toISOString().split("T")[0]

      if (lastEntryDateString === yesterdayString) {
        currentStreak = 1
        today.setDate(today.getDate() - 1) // Começar a verificar a partir de ontem
      } else {
        // Se a última entrada não foi ontem, o streak atual é 0
        return {
          currentStreak: 0,
          longestStreak: calculateLongestStreak(entriesByDay),
          lastEntryDate: lastEntryDateString,
        }
      }
    }

    // Verificar dias consecutivos anteriores
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - 1) // Começar do dia anterior

    while (true) {
      const checkDateString = checkDate.toISOString().split("T")[0]

      if (entriesByDay.has(checkDateString)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Calcular o streak mais longo
    const longestStreak = calculateLongestStreak(entriesByDay)

    return {
      currentStreak,
      longestStreak,
      lastEntryDate: lastEntryDateString,
    }
  } catch (error) {
    console.error("Erro ao calcular streak:", error)
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastEntryDate: null,
    }
  }
}

/**
 * Calcula o streak mais longo com base nas entradas agrupadas por dia
 * @param entriesByDay Mapa com as datas das entradas
 * @returns O número de dias consecutivos mais longo
 */
const calculateLongestStreak = (entriesByDay: Map<string, boolean>): number => {
  // Converter as chaves do mapa (datas) para um array e ordenar
  const dates = Array.from(entriesByDay.keys()).sort()

  if (dates.length === 0) return 0

  let currentStreak = 1
  let maxStreak = 1

  for (let i = 1; i < dates.length; i++) {
    const currentDate = new Date(dates[i])
    const prevDate = new Date(dates[i - 1])

    // Verificar se as datas são consecutivas
    const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      // Dias consecutivos
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      // Quebra na sequência
      currentStreak = 1
    }
  }

  return maxStreak
}

