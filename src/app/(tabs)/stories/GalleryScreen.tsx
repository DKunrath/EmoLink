import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Image, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export default function GalleryScreen() {
  const [drawings, setDrawings] = useState<MediaLibrary.Asset[]>([]);

  useEffect(() => {
    const fetchDrawings = async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const album = await MediaLibrary.getAlbumAsync('Drawings');
        if (album) {
          const assets = await MediaLibrary.getAssetsAsync({ album: album.id });
          setDrawings(assets.assets);
        } else {
          Alert.alert('No Drawings', 'No drawings found in the gallery.');
        }
      } else {
        Alert.alert('Error', 'Permission to access media library is required.');
      }
    };

    fetchDrawings();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={drawings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image source={{ uri: item.uri }} style={styles.image} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  image: {
    width: 100,
    height: 100,
    margin: 5,
  },
});
