import { Redirect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

export default function Index() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <Redirect href="/(auth)/sign-in" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});