"use client"

import { useEffect, useState } from "react"
import { supabase } from "../services/supabase"
import type { User } from "@supabase/supabase-js"

interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  })

  useEffect(() => {
    // Buscar usuário inicial
    const fetchUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setState({ user, loading: false })
      } catch (error) {
        setState((prev) => ({ ...prev, loading: false }))
      }
    }

    fetchUser()

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, loading: false })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return state
}

