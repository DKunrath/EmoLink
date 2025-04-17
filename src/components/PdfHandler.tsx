"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import * as FileSystem from "expo-file-system"
import * as WebBrowser from "expo-web-browser"

interface PDFHandlerProps {
  pdfUrl: string
  title: string
}

const PDFHandler: React.FC<PDFHandlerProps> = ({ pdfUrl, title }) => {
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [localUri, setLocalUri] = useState<string | null>(null)

  // Generate a safe filename from the title
  const getSafeFilename = (title: string) => {
    return title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".pdf"
  }

  const filename = getSafeFilename(title)
  const fileUri = FileSystem.documentDirectory + filename

  // Check if the file is already downloaded
  useEffect(() => {
    const checkFileExists = async () => {
      try {
        const fileInfo = await FileSystem.getInfoAsync(fileUri)
        if (fileInfo.exists) {
          //setIsDownloaded(true)
          setLocalUri(fileUri)
        }
      } catch (error) {
        console.error("Error checking file:", error)
      }
    }

    checkFileExists()
  }, [fileUri])
  // Open the PDF
  const openPDF = async () => {
    try {
      if (isDownloaded && localUri) {
        // Open local file
        await WebBrowser.openBrowserAsync(localUri)
      } else {
        // Open remote URL directly
        await WebBrowser.openBrowserAsync(pdfUrl)
      }
    } catch (error) {
      console.error("Error opening PDF:", error)
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.viewButton} onPress={openPDF}>
        <Text style={styles.buttonText}>Visualizar PDF</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#f9f9f9",
  },
  viewButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  downloadButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 100,
  },
  downloadingButton: {
    backgroundColor: "#818CF8",
  },
  downloadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 4,
  },
  downloadedBadge: {
    backgroundColor: "#10B981",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  downloadedText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
})

export default PDFHandler
