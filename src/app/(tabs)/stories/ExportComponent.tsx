import React from 'react';
import { View, StyleSheet, Button } from 'react-native';
import { Text } from 'react-native-paper';
import { shareAsync } from 'expo-sharing';
import * as Print from 'expo-print';

interface Page {
  title: string;
  content: string;
  image_url?: string;
}

interface ExportComponentProps {
  pages: Page[];
}

export default function ExportComponent({ pages }: ExportComponentProps) {
  const handleExport = async () => {
    const htmlContent = pages.map((page) => `
      <div>
        <h1>${page.title}</h1>
        <p>${page.content}</p>
        ${page.image_url ? `<img src="${page.image_url}" style="width: 100%; height: auto;" />` : ''}
      </div>
    `).join('');

    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share your story' });
  };

  return (
    <View style={styles.container}>
      <Button title="Export Story" onPress={handleExport} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
});