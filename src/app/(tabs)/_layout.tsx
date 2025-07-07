"use client"

import type React from "react"
import { useState } from "react"
import { Tabs } from "expo-router"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import SidebarMenu from "../../components/SidebarMenu"

// Modern color scheme to match our updated components
const colors = {
  primary: "#F163E0", // Indigo color used in our components
  background: "#FFFFFF",
  text: "#111827",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
}

// Custom tab bar label component for better styling
function TabBarLabel({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return <Text style={[styles.tabLabel, focused ? styles.tabLabelFocused : styles.tabLabelInactive]}>{children}</Text>
}

// Custom tab bar icon component for better styling
function TabBarIcon({
  focused,
  name,
  size = 24,
}: { focused: boolean; name: keyof typeof MaterialCommunityIcons.glyphMap; size?: number }) {
  return (
    <View style={styles.iconContainer}>
      <MaterialCommunityIcons name={name} size={size} color={focused ? colors.primary : colors.textSecondary} />
    </View>
  )
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  return (
    <>
      <Tabs
        screenOptions={{
          // Tab bar styling
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 60 + insets.bottom, // ajusta a altura total com base no espaço seguro
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12, // usa o insets.bottom real, ou um valor padrão
            paddingTop: 8,
          },

          // Header styling
          headerStyle: {
            backgroundColor: colors.background,
            elevation: 0, // Remove shadow on Android
            shadowOpacity: 0, // Remove shadow on iOS
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: "bold",
            fontSize: 18,
          },

          // Animation
          tabBarLabelPosition: "below-icon",
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Inicio",
            headerShown: false,
            tabBarLabel: ({ focused }) => <TabBarLabel focused={focused}>Inicio</TabBarLabel>,
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="home" />,
          }}
        />
        <Tabs.Screen
          name="stories"
          options={{
            title: "Histórias",
            headerShown: false,
            tabBarLabel: ({ focused }) => <TabBarLabel focused={focused}>Histórias</TabBarLabel>,
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="book-open-variant" />,
          }}
        />
        <Tabs.Screen
          name="diary"
          options={{
            title: "Diário de Emoções",
            headerShown: false,
            tabBarLabel: ({ focused }) => <TabBarLabel focused={focused}>Diário de Emoções</TabBarLabel>,
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="notebook" />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: "Chat",
            headerShown: false,
            tabBarLabel: ({ focused }) => <TabBarLabel focused={focused}>Chat</TabBarLabel>,
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="chat" />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            headerShown: false,
            tabBarLabel: ({ focused }) => <TabBarLabel focused={focused}>Menu</TabBarLabel>,
            tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} name="menu" />,
            tabBarButton: (props) => {
              return (
                <Pressable
                  {...props}
                  onPress={(event) => {
                    event.preventDefault(); // Impede a navegação padrão
                    toggleSidebar(); // Apenas abre a sidebar
                  }}
                  style={({ pressed }) => [
                    props.style,
                    {
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                />
              );
            },
          }}
        />

        {/* Hidden routes */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="challenges"
          options={{
            href: null, // Remove a rota da bottom tab bar
          }}
        />
        <Tabs.Screen
          name="challenge-detail"
          options={{
            href: null, // Remove a rota da bottom tab bar
          }}
        />
        <Tabs.Screen
          name="challengesScreen"
          options={{
            href: null, // Remove a rota da bottom tab bar
          }}
        />
        <Tabs.Screen
          name="challengeDetailScreen"
          options={{
            href: null, // Remove a rota da bottom tab bar
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            href: null, // Remove a rota da bottom tab bar
          }}
        />
        <Tabs.Screen
          name="rewardsScreen"
          options={{
            href: null, // Remove a rota da bottom tab bar
          }}
        />
        <Tabs.Screen
          name="instructions"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="ranking"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="parent-access"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="exclusive-content"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="weeklyGoals"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="emotion-graphs"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="appointmentsScreen"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="schedule"
          options={{
            href: null, // Remove a rota da bottom tab bar
            headerShown: false,
          }}
        />
      </Tabs>

      {/* Sidebar Menu */}
      <SidebarMenu isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
  tabLabelFocused: {
    color: colors.primary,
    fontWeight: "600",
  },
  tabLabelInactive: {
    color: colors.textSecondary,
  },
})
