"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Platform,
} from "react-native"
import { supabase } from "../services/supabase"
import { useAuth } from "../hooks/useAuth"
import { useAlertContext } from "./alert-provider"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { PieChart, LineChart } from "react-native-gifted-charts"

// Define emotion types with their corresponding icons and colors
const EMOTIONS = {
  happy: { icon: "emoticon-happy-outline", color: "#FFD700", label: "Feliz" },
  sad: { icon: "emoticon-sad-outline", color: "#6495ED", label: "Triste" },
  angry: { icon: "emoticon-angry-outline", color: "#FF6347", label: "Raiva" },
  excited: { icon: "emoticon-excited-outline", color: "#FF69B4", label: "Animado" },
  upset: { icon: "emoticon-frown-outline", color: "#9370DB", label: "Chateado" },
  other: { icon: "emoticon-neutral-outline", color: "#808080", label: "Outro" },
}

// Define time period options
const TIME_PERIODS = [
  { value: "week", label: "Última Semana" },
  { value: "month", label: "Último Mês" },
  //{ value: "year", label: "Último Ano" },
]

// Interface for emotion entry
interface EmotionEntry {
  id: string
  user_id: string
  emotion_type: string
  intensity: number
  created_at: string
  date: string
}

// Interface for processed data for charts
interface ChartData {
  date: string
  count: number
  intensity: number
}

// Interface for pie chart data
interface PieChartData {
  value: number
  color: string
  text: string
  emotionType: string
  avgIntensity: number
  focused?: boolean
}

// Interface for line chart data
interface LineChartData {
  date: string
  value: number
  label: string
}

interface EmotionGraphsScreenProps {
  onClose?: () => void
}

const EmotionGraphsScreen: React.FC<EmotionGraphsScreenProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<EmotionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmotion, setSelectedEmotion] = useState<string>("happy")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("month")
  const [pieChartData, setPieChartData] = useState<PieChartData[]>([])
  const [lineChartData, setLineChartData] = useState<LineChartData[]>([])
  const [selectedPieItem, setSelectedPieItem] = useState<PieChartData | null>(null)

  const { user } = useAuth()
  const { error2 } = useAlertContext()
  const { width } = Dimensions.get("window")

  useEffect(() => {
    fetchEmotionEntries()
  }, [user, selectedPeriod])

  useEffect(() => {
    if (entries.length > 0) {
      processPieChartData()
      processLineChartData()
    }
  }, [entries, selectedEmotion])

  // Fetch emotion entries from the database
  const fetchEmotionEntries = async () => {
    try {
      setLoading(true)
      if (!user) return

      // Calculate date range based on selected period
      const endDate = new Date()
      const startDate = new Date()

      if (selectedPeriod === "week") {
        startDate.setDate(startDate.getDate() - 7)
      } else if (selectedPeriod === "month") {
        startDate.setMonth(startDate.getMonth() - 1)
      } else if (selectedPeriod === "year") {
        startDate.setFullYear(startDate.getFullYear() - 1)
      }

      const { data, error } = await supabase
        .from("emotion_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: true })

      if (error) throw error

      // Format dates and add date field
      const formattedData = data.map((entry) => ({
        ...entry,
        date: new Date(entry.created_at).toISOString().split("T")[0],
      }))

      setEntries(formattedData || [])
    } catch (error) {
      error2("Erro", "Não foi possível carregar os dados emocionais. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  // Process data for pie chart
  const processPieChartData = () => {
    try {
      // Group entries by emotion type
      const emotionCounts: Record<string, { count: number; totalIntensity: number }> = {}

      // Initialize with all emotions
      Object.keys(EMOTIONS).forEach((emotion) => {
        emotionCounts[emotion] = { count: 0, totalIntensity: 0 }
      })

      // Count entries by emotion
      entries.forEach((entry) => {
        if (!emotionCounts[entry.emotion_type]) {
          emotionCounts[entry.emotion_type] = { count: 0, totalIntensity: 0 }
        }
        emotionCounts[entry.emotion_type].count += 1
        emotionCounts[entry.emotion_type].totalIntensity += entry.intensity
      })

      // Convert to array format for pie chart
      const data: PieChartData[] = Object.entries(emotionCounts)
        .map(([emotionType, stats]) => {
          const emotion = EMOTIONS[emotionType as keyof typeof EMOTIONS]
          const avgIntensity = stats.count > 0 ? stats.totalIntensity / stats.count : 0

          return {
            value: stats.count,
            color: emotion.color,
            text: `${stats.count}`,
            emotionType,
            avgIntensity,
            focused: emotionType === selectedEmotion,
          }
        })
        .filter((item) => item.value > 0) // Remove emotions with no entries

      // If no data, create placeholder
      if (data.length === 0) {
        Object.entries(EMOTIONS).forEach(([emotionType, emotion]) => {
          data.push({
            value: 1,
            color: emotion.color,
            text: "0",
            emotionType,
            avgIntensity: 0,
            focused: emotionType === selectedEmotion,
          })
        })
      }

      setPieChartData(data)
    } catch (error) {
      error2("Erro", "Não foi possível processar os dados emocionais para o gráfico de pizza.")
    }
  }

  // Process data for line chart
  const processLineChartData = () => {
    try {
      // Filter entries by selected emotion
      const filteredEntries = entries.filter((entry) => entry.emotion_type === selectedEmotion)

      // Group by date
      const groupedByDate = filteredEntries.reduce(
        (acc, entry) => {
          const date = entry.date
          if (!acc[date]) {
            acc[date] = { count: 0, totalIntensity: 0 }
          }
          acc[date].count += 1
          acc[date].totalIntensity += entry.intensity
          return acc
        },
        {} as Record<string, { count: number; totalIntensity: number }>,
      )

      // Create date range
      const endDate = new Date()
      const startDate = new Date()

      if (selectedPeriod === "week") {
        startDate.setDate(startDate.getDate() - 7)
      } else if (selectedPeriod === "month") {
        startDate.setDate(startDate.getDate() - 15)
      } else if (selectedPeriod === "year") {
        startDate.setFullYear(startDate.getFullYear() - 1)
      }

      // Create array of dates
      const dateArray: Date[] = []
      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        dateArray.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Format data for line chart
      const data: LineChartData[] = dateArray.map((date, index) => {
        const dateStr = date.toISOString().split("T")[0];
        const formattedDate = formatDate(dateStr, index, dateArray.map((date) => ({
          date: date.toISOString().split("T")[0],
          value: 0,
          label: "",
        })));
        const stats = groupedByDate[dateStr];

        return {
          date: dateStr,
          value: stats ? stats.count : 0,
          label: formattedDate,
        };
      });

      setLineChartData(data)
    } catch (error) {
      error2("Erro", "Não foi possível processar os dados emocionais para o gráfico de linha.")
    }
  }

  // Format date for display
  const formatDate = (dateString: string, index: number, array: LineChartData[]) => {
    if (selectedPeriod === "year") {
      // Para exibição anual, mostrar apenas os nomes dos meses únicos
      const [year, month] = dateString.split("-");
      const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1);
      const monthName = date.toLocaleDateString("pt-BR", { month: "short" });

      // Verificar se o mês já foi exibido anteriormente
      if (index > 0) {
        const previousDate = array[index - 1].date;
        const [prevYear, prevMonth] = previousDate.split("-");
        if (prevMonth === month) {
          return ""; // Não repetir o mês
        }
      }

      return monthName;
    }

    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", { day: "2-digit" });
  };

  // Handle pie chart item press
  const handlePieItemPress = (item: PieChartData) => {
    setSelectedPieItem(item)
    setSelectedEmotion(item.emotionType)
  }

  // Render pie chart
  const renderPieChart = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      );
    }

    if (pieChartData.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>Sem dados para exibir</Text>
        </View>
      );
    }

    const renderDot = (color: string) => {
      return (
        <View
          style={{
            height: 10,
            width: 10,
            borderRadius: 5,
            backgroundColor: color,
            marginRight: 10,
          }}
        />
      );
    };

    const renderLegendComponent = () => {
      return (
        <View style={{ marginTop: 20 }}>
          {pieChartData.map((item, index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              {renderDot(item.color)}
              <Text style={{ color: "#111827", fontSize: 14 }}>
                {EMOTIONS[item.emotionType as keyof typeof EMOTIONS]?.label}:{" "}
                {item.value} ({item.avgIntensity.toFixed(1)})
              </Text>
            </View>
          ))}
        </View>
      );
    };

    return (
      <View
        style={{
          margin: 20,
          padding: 16,
          borderRadius: 20,
          backgroundColor: '#FFFFFF',
        }}>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <PieChart
            data={pieChartData}
            donut
            showGradient
            focusOnPress {...{ onPress: handlePieItemPress }}
            radius={90}
            innerRadius={60}
            innerCircleColor={'#A0A1A3'}
            centerLabelComponent={() => {
              const selectedItem = pieChartData.find(
                (item) => item.emotionType === selectedEmotion
              );
              return (
                <View style={{ justifyContent: "center", alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 22,
                      color: "#111827",
                      fontWeight: "bold",
                    }}
                  >
                    {selectedItem ? selectedItem.value : 0}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#111827" }}>
                    {EMOTIONS[selectedEmotion as keyof typeof EMOTIONS]?.label}
                  </Text>
                </View>
              );
            }}
          />
        </View>
        {renderLegendComponent()}
      </View>
    );
  }

  // Render line chart
  const renderLineChart = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      )
    }

    if (lineChartData.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>Sem dados para exibir</Text>
        </View>
      )
    }

    // Prepare data for line chart
    const emotion = EMOTIONS[selectedEmotion as keyof typeof EMOTIONS]
    const chartData = lineChartData.map((item) => ({
      value: item.value,
      dataPointText: item.value.toString(),
      label: item.label,
    }))

    return (
      <View style={styles.lineChartCard}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.lineChartScrollContainer}
        >
          <LineChart
            areaChart
            isAnimated
            animationDuration={1200}
            data={chartData}
            hideYAxisText
            height={220}
            width={Math.max(width, chartData.length * 60)} // Ajusta a largura dinamicamente
            noOfSections={5}
            xAxisLabelTextStyle={{ color: "#333", width: 60, textAlign: "center" }}
            hideDataPoints={false}
            color={emotion.color}
            dataPointsColor={emotion.color}
            startFillColor={emotion.color}
            endFillColor={`${emotion.color}33`}
            startOpacity={0.6}
            endOpacity={0.1}
            spacing={30}
            thickness={3}
            hideRules
            yAxisColor="#333"
            xAxisColor="#333"
            pointerConfig={{
              pointerStripHeight: 160,
              pointerStripColor: "#333",
              pointerStripWidth: 2,
              pointerColor: emotion.color,
              radius: 6,
              pointerLabelWidth: 100,
              pointerLabelHeight: 90,
              activatePointersOnLongPress: true,
              autoAdjustPointerLabelPosition: true,
              pointerLabelComponent: (items: any) => {
                return (
                  <View style={styles.lineTooltip}>
                    <Text style={styles.lineTooltipTitle}>{items[0].label}</Text>
                    <Text style={styles.lineTooltipText}>Registros: {items[0].value}</Text>
                  </View>
                );
              },
            }}
          />
        </ScrollView>
      </View>
    )
  }

  // Render data table for web
  const renderDataTable = () => {
    if (lineChartData.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>Sem dados para exibir</Text>
        </View>
      )
    }

    // Filter out days with no entries
    const filteredData = lineChartData.filter((item) => item.value > 0)

    if (filteredData.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <Text style={styles.emptyChartText}>Sem registros para esta emoção no período selecionado</Text>
        </View>
      )
    }

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
          <Text style={styles.tableHeaderCell}>Registros</Text>
        </View>
        <ScrollView style={styles.tableBody}>
          {filteredData.map((item, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{item.label}</Text>
              <Text style={styles.tableCell}>{item.value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gráficos Emocionais</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Period Selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>Período:</Text>
          <View style={styles.buttonGroup}>
            {TIME_PERIODS.map((period) => (
              <TouchableOpacity
                key={period.value}
                style={[styles.periodButton, selectedPeriod === period.value && styles.selectedPeriodButton]}
                onPress={() => setSelectedPeriod(period.value)}
              >
                <Text
                  style={[styles.periodButtonText, selectedPeriod === period.value && styles.selectedPeriodButtonText]}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pie Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Distribuição de Emoções</Text>
          {renderPieChart()}
        </View>

        {/* Emotion Selector for Line Chart */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>Emoção para o gráfico de progresso:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emotionSelector}>
            {Object.entries(EMOTIONS).map(([key, value]) => (
              <TouchableOpacity
                key={key}
                style={[styles.emotionButton, selectedEmotion === key && { backgroundColor: value.color }]}
                onPress={() => setSelectedEmotion(key)}
              >
                <MaterialCommunityIcons
                  name={value.icon as any}
                  size={24}
                  color={selectedEmotion === key ? "#FFFFFF" : value.color}
                />
                <Text style={[styles.emotionButtonText, selectedEmotion === key && { color: "#FFFFFF" }]}>
                  {value.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Line Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Progresso Diário</Text>
          {renderLineChart()}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const { width } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    width: width - 1, // Ajuste para centralizar o título
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  emotionSelector: {
    flexDirection: "row",
  },
  emotionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emotionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  buttonGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedPeriodButton: {
    backgroundColor: "#F163E0",
    borderColor: "#F163E0",
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  selectedPeriodButtonText: {
    color: "#FFFFFF",
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  pieChartContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  pieChartCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  pieChartCenterText: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 4,
  },
  pieTooltip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: "center",
  },
  pieTooltipColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginBottom: 8,
  },
  pieTooltipTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  pieTooltipText: {
    fontSize: 14,
    color: "#4B5563",
  },
  pieChartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: "#4B5563",
  },
  lineChartContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  lineTooltip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lineTooltipTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  lineTooltipText: {
    fontSize: 12,
    color: "#4B5563",
  },
  emptyChartContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  emptyChartText: {
    fontSize: 16,
    color: "#6B7280",
  },
  webChartPlaceholder: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 16,
  },
  webChartText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  loadingContainer: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#F163E0",
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderCell: {
    flex: 1,
    fontWeight: "bold",
    color: "#111827",
    fontSize: 14,
  },
  tableBody: {
    maxHeight: 300,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableRowEven: {
    backgroundColor: "#FFFFFF",
  },
  tableRowOdd: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
  },
  lineChartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    overflow: "hidden", // Garante que o conteúdo não saia do card
  },
  lineChartScrollContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 10,
  },
})

export default EmotionGraphsScreen
