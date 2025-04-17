import React, { useRef } from 'react';
import { Platform, View, StyleSheet, Button, Alert } from 'react-native';
import { Canvas, Path, Skia, SkPath, useCanvasRef } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

interface DrawingComponentProps {
  storyPageId: string;
}

export default function DrawingComponent({ storyPageId }: DrawingComponentProps) {
  const canvasRef = useCanvasRef();
  const pathRef = useRef<SkPath>(Skia.Path.Make());

  const panGesture = Gesture.Pan()
    .onStart(({ x, y }) => {
      if (pathRef.current) {
        pathRef.current.moveTo(x, y);
      }
    })
    .onUpdate(({ x, y }) => {
      if (pathRef.current) {
        pathRef.current.lineTo(x, y);
        canvasRef.current?.redraw();
      }
    });

  const clearCanvas = () => {
    pathRef.current = Skia.Path.Make(); // Reset the path
    canvasRef.current?.redraw();
  };

  const saveDrawing = async () => {
    const image = canvasRef.current?.makeImageSnapshot();
    if (image) {
      if (Platform.OS === 'web') {
        console.log('Drawing saved (web):', `data:image/png;base64,${image.encodeToBase64()}`);
        Alert.alert('Success', 'Drawing saved (web simulation)!');
      } else {
        const uri = `${FileSystem.cacheDirectory}drawing_${storyPageId}.png`;
        await FileSystem.writeAsStringAsync(uri, image.encodeToBase64(), {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(uri);
          await MediaLibrary.createAlbumAsync('Drawings', asset, false);
          Alert.alert('Success', 'Drawing saved to gallery!');
        } else {
          Alert.alert('Error', 'Permission to access media library is required.');
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Canvas ref={canvasRef} style={styles.canvas}>
          {pathRef.current && (
            <Path path={pathRef.current} color="purple" style="stroke" strokeWidth={4} />
          )}
        </Canvas>
      </GestureDetector>
      <Button title="Clear Canvas" onPress={clearCanvas} />
      <Button title="Save Drawing" onPress={saveDrawing} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    width: 300,
    height: 300,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'black',
  },
});