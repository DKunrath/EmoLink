"use client"

import React, { useEffect, useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Dimensions, SafeAreaView } from "react-native"
import { router } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { supabase } from "../services/supabase"
import { useAuth } from "../hooks/useAuth"
import { useSafeAreaInsets } from "react-native-safe-area-context"

interface SidebarMenuProps {
  isOpen: boolean
  onClose: () => void
}

interface ProfileData {
  full_name: string
  avatar_url: string
  email: string
}

const { width } = Dimensions.get("window")
const SIDEBAR_WIDTH = width * 0.8

const SidebarMenu: React.FC<SidebarMenuProps> = ({ isOpen, onClose }) => {
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: "",
    avatar_url: "",
    email: "",
  })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  // Animation value for sidebar position
  const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current

  // Fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true)
        if (!user) return

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("email")
          .eq("id", user.id)
          .single()

        if (userError) throw userError

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("user_id", user.id)
          .single()

        if (profileError) throw profileError

        setProfileData({
          full_name: profile.full_name || "Usuário",
          avatar_url: profile.avatar_url || "",
          email: userData.email || "",
        })
      } catch (error) {
        return false
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [user])

  // Handle sidebar animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : SIDEBAR_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [isOpen, slideAnim])

  // Navigation functions
  const navigateTo = (route: string) => {
    onClose()
    setTimeout(() => {
      router.push(route)
    }, 300)
  }

  // Menu items
  const menuItems = [
    {
      icon: "book-open-variant",
      label: "Instruções",
      onPress: () => navigateTo("/instructions"),
    },
    {
      icon: "trophy",
      label: "Ranking",
      onPress: () => navigateTo("/ranking"),
    },
    {
      icon: "target",
      label: "Metas Semanais",
      onPress: () => navigateTo("/weeklyGoals"),
    },
    {
      icon: "chart-line",
      label: "Gráficos Emocionais",
      onPress: () => navigateTo("/emotion-graphs"),
    },
    {
      icon: "account-group",
      label: "Comunidade",
      onPress: () => navigateTo("/community"),
    },
    {
      icon: "account-child",
      label: "Acesso para Pais",
      onPress: () => navigateTo("/parent-access"),
    },
    {
      icon: "account",
      label: "Perfil",
      onPress: () => navigateTo("/profile"),
    },
    {
      icon: "cog",
      label: "Configurações",
      onPress: () => navigateTo("/settings"),
    },
    {
      icon: "logout",
      label: "Sair",
      onPress: async () => {
        await supabase.auth.signOut()
      },
    },
    // {
    //   icon: "star",
    //   label: "Conteúdo Exclusivo",
    //   onPress: () => navigateTo("/exclusive-content"),
    // },
  ]

  return (
    <>
      {isOpen && <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />}
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header with user info */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              {profileData.avatar_url ? (
                <Image source={{ uri: profileData.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : "U"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.userName}>{profileData.full_name}</Text>
            <Text style={styles.userEmail}>{profileData.email}</Text>
          </View>

          {/* Menu items */}
          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
                <MaterialCommunityIcons name={item.icon as any} size={24} color="#F163E0" />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    width: SIDEBAR_WIDTH,
    height: "100%",
    backgroundColor: "#FFFFFF",
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E5E7EB",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#6B7280",
  },
  menuContainer: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuItemText: {
    fontSize: 16,
    color: "#111827",
    marginLeft: 16,
  },
  closeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
})

export default SidebarMenu
