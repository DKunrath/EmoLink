import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';

interface VideoScreenProps {
  videoUrl: string; // Define o tipo da prop
}

export default function VideoScreen({ videoUrl }: VideoScreenProps) {
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    // Não iniciar automaticamente
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  return (
    <View style={styles.contentContainer}>
      <VideoView style={styles.video} player={player} />
      <TouchableOpacity
        style={styles.playPauseButton}
        onPress={() => {
          if (isPlaying) {
            player.pause();
          } else {
            player.play();
          }
        }}
      >
        <Text style={styles.playPauseText}>{isPlaying ? '❚❚' : '▶'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: 350,
    height: 275,
  },
  playPauseButton: {
    position: 'absolute', // Centraliza o botão no vídeo
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }], // Ajusta a posição para centralizar
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fundo semitransparente
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});