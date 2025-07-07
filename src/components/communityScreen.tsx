"use client"
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import * as Crypto from "expo-crypto"
import { useAlertContext } from "../components/alert-provider"
import { useFocusEffect } from "@react-navigation/native"
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';


interface CommunityScreenProps {
  onClose: () => void
}

// Types for our data
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  points: number;
}

interface Comment {
  id: string;
  comments_id: string; // References the post
  comments_user_id: string;
  comments_user_avatar_url: string;
  comments_user_full_name: string;
  comment_text: string;
  comment_likes: number;
  created_at: string;
  liked_by_me?: boolean; // To track if current user liked this comment
}

interface Reward {
  id: string;
  name: string;
  description: string;
  image_url: string;
  type: string;
}

interface UserReward {
  id: string;
  user_id: string;
  reward_id: string;
  redeemed_at: string;
  reward: Reward;
}

interface Drawing {
  id: string;
  user_id: string;
  drawing_url: string;
  created_at: string;
  challenge_title: string;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  type: 'achievement' | 'points' | 'drawing';
  reference_id: string;
  created_at: string;
  is_approved: boolean;
  points: number;
  full_name: string;
  avatar_url: string;
  user_profile: UserProfile;
  // These will be populated based on the post type
  reward?: UserReward;
  drawing?: Drawing;
  // New fields for likes and comments
  likes: number;
  comments_id: string;
  liked_by_me?: boolean; // To track if current user liked this post
  comments?: Comment[]; // To store comments for this post
  show_comments?: boolean; // To track if comments are expanded
}

const CommunityScreen: React.FC<CommunityScreenProps> = ({ onClose }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareType, setShareType] = useState<'achievement' | 'points' | 'drawing' | null>(null);
  const [shareContent, setShareContent] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [userRewards, setUserRewards] = useState<UserReward[]>([]);
  const [userDrawings, setUserDrawings] = useState<Drawing[]>([]);
  const { success, error2, warning } = useAlertContext()
  // Add these new state variables
  const [showDrawingSelector, setShowDrawingSelector] = useState(false);
  const [showAchievementSelector, setShowAchievementSelector] = useState(false);

  // Add these state variables to your component
  const [commentText, setCommentText] = useState('');
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);

  // Parent Password Modal
  const [hasParentPassword, setHasParentPassword] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showCommunity, setShowCommunity] = useState(false)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Atualizar dados quando a tela receber foco
  useFocusEffect(
    useCallback(() => {
      // Verificar se o usuário está autenticado e se a tela está visível
      if (user && showCommunity) {
        // Atualizar os dados
        fetchPosts();
        fetchUserRewards();
        fetchUserDrawings();
      }

      return () => {
        // Cleanup se necessário
      };
    }, [user, showCommunity]) // Dependências: usuário e visibilidade da tela
  );

  const handlePasswordSubmit = async () => {
    // Validate password
    if (!hasParentPassword && password !== confirmPassword) {
      setPasswordError("As senhas não coincidem")
      return
    }

    if (password.length < 6) {
      setPasswordError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    setPasswordLoading(true)

    try {
      if (hasParentPassword) {
        // Verify existing password
        const isValid = await verifyParentPassword(password)
        if (isValid) {
          setPasswordModalVisible(false)
          setShowCommunity(true)
        } else {
          setPasswordError("Senha incorreta")
        }
      } else {
        // Create new password
        const success2 = await saveParentPassword(password)
        if (success2) {
          setHasParentPassword(true)
          setPasswordModalVisible(false)
          setShowCommunity(true)
          success("Sucesso", "Senha criada com sucesso!")
        } else {
          setPasswordError("Erro ao criar senha. Tente novamente.")
        }
      }
    } catch (error) {
      setPasswordError("Ocorreu um erro. Tente novamente.")
    } finally {
      setPasswordLoading(false)
    }
  }

  const verifyParentPassword = async (password: string) => {
    try {
      const user = await supabase.auth.getUser()
      if (!user.data?.user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from("profiles")
        .select("parent_password")
        .eq("user_id", user.data.user.id)
        .single()

      if (error) throw error

      const hashedPassword = await hashPassword(password)
      return data.parent_password === hashedPassword
    } catch (error) {
      return false
    }
  }

  const saveParentPassword = async (password: string) => {
    try {
      const user = await supabase.auth.getUser()
      if (!user.data?.user) throw new Error("User not authenticated")

      const hashedPassword = await hashPassword(password)

      const { error } = await supabase
        .from("profiles")
        .update({
          parent_password: hashedPassword,
        })
        .eq("user_id", user.data.user.id)

      if (error) throw error
      return true
    } catch (error) {
      return false
    }
  }

  // Hash password using SHA-256
  const hashPassword = async (password: string) => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password)
    return hash
  }

  // Sempre exibir o modal de senha ao acessar a página
  useFocusEffect(
    useCallback(() => {
      const checkPasswordAndShowModal = async () => {
        try {
          // Resetar estado do modal
          setPassword("");
          setConfirmPassword("");
          setPasswordError("");
          setPasswordModalVisible(true);
          setShowCommunity(false);
        } catch (error) {
          return false
        }
      };

      checkPasswordAndShowModal();
    }, [])
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Fetch user profile and data
  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchPosts();
      fetchUserRewards();
      fetchUserDrawings();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
      setHasParentPassword(!!data.parent_password); // Check if the user has a parent password

    } catch (error) {
      error2("Erro", "Não foi possível carregar o perfil do usuário.")
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);

      // Fetch approved posts
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which posts the current user has liked
      const { data: likedPosts, error: likedError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user?.id)
        .in('post_id', data.map(post => post.id));

      if (likedError) throw likedError;

      // Lista de nomes de animais para usuários anônimos
      const animalNames = {
        lion: "Leão",
        tiger: "Tigre",
        bear: "Urso",
        elefant: "Elefante",
        giraffe: "Girafa",
        zebra: "Zebra",
        monkey: "Macaco",
        pandaBear: "Panda",
        koala: "Coala",
        kangaroo: "Canguru",
        wolf: "Lobo",
        fox: "Raposa",
        dolphin: "Golfinho",
        whale: "Baleia",
        penguim: "Pinguim",
        owl: "Coruja",
        eagle: "Águia",
        toucan: "Tucano",
      }

      // URL das imagens para usuários anônimos
      const ANIMAL_IMAGES_URLS = {
        lion: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//lion.png",
        tiger: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//tiger.png",
        bear: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//bear.png",
        elefant: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//elefant.png",
        giraffe: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//giraffe.png",
        zebra: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//zebra.png",
        monkey: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//monkey.png",
        pandaBear: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//panda_bear.png",
        koala: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//koala.png",
        kangaroo: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//kangaroo.png",
        wolf: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//wolf.png",
        fox: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//red_fox.png",
        dolphin: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//dolphin.png",
        whale: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//whale.png",
        penguim: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//penguim.png",
        owl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//owl.png",
        eagle: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//eagle.png",
        toucan: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//toucan.png",
      };

      // Create an array to store posts with details
      const postsWithDetails = [];

      // Fetch additional data for each post based on its type
      for (const post of data) {
        try {
          // Add like status to the post
          const postWithLikes = {
            ...post,
            liked_by_me: likedPosts.some(lp => lp.post_id === post.id)
          };

          // Verificar a configuração de privacidade do autor do post
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('show_profile_in_shared')
            .eq('user_id', post.user_id)
            .single();

          // Se o usuário optou por não mostrar seu perfil, substituir nome e avatar
          if (!profileError && profileData && profileData.show_profile_in_shared === false) {
            // Gerar um índice aleatório mas consistente para o mesmo usuário
            const nameIndex = post.user_id.charCodeAt(0) % Object.keys(animalNames).length;
            const randomAnimalKey = Object.keys(animalNames)[nameIndex] as keyof typeof animalNames;
            const randomAnimal = animalNames[randomAnimalKey];

            // Buscar a URL da imagem correspondente ao animal sorteado
            const randomAnimalImageUrl = ANIMAL_IMAGES_URLS[randomAnimalKey];

            // Substituir nome e avatar
            postWithLikes.full_name = `${randomAnimal} Anônimo`;
            postWithLikes.avatar_url = randomAnimalImageUrl; // Usa a URL padrão se não encontrar
          }

          // Fetch comments for this post
          let comments = [];
          if (post.comments_id) {
            const { data: commentsData, error: commentsError } = await supabase
              .from('community_comments')
              .select('*')
              .eq('comments_id', post.comments_id)
              .order('created_at', { ascending: true });

            if (!commentsError && commentsData) {
              // Check which comments the current user has liked
              const { data: likedComments, error: likedCommentsError } = await supabase
                .from('comment_likes')
                .select('comment_id')
                .eq('user_id', user?.id)
                .in('comment_id', commentsData.map(c => c.id));

              if (!likedCommentsError && likedComments) {
                // Mark comments as liked by the current user and check privacy settings for each comment author
                comments = await Promise.all(commentsData.map(async (comment) => {
                  // Verificar a configuração de privacidade do autor do comentário
                  const { data: commentAuthorProfile, error: commentAuthorError } = await supabase
                    .from('profiles')
                    .select('show_profile_in_shared')
                    .eq('user_id', comment.comments_user_id)
                    .single();

                  let processedComment = {
                    ...comment,
                    liked_by_me: likedComments.some(lc => lc.comment_id === comment.id)
                  };

                  // Se o autor do comentário optou por não mostrar seu perfil, substituir nome e avatar
                  if (!commentAuthorError && commentAuthorProfile && commentAuthorProfile.show_profile_in_shared === false) {
                    // Gerar um índice aleatório mas consistente para o mesmo usuário
                    const nameIndex = post.user_id.charCodeAt(0) % Object.keys(animalNames).length;
                    const randomAnimalKey = Object.keys(animalNames)[nameIndex] as keyof typeof animalNames;
                    const randomAnimal = animalNames[randomAnimalKey];

                    // Buscar a URL da imagem correspondente ao animal sorteado
                    const randomAnimalImageUrl = ANIMAL_IMAGES_URLS[randomAnimalKey];

                    // Substituir nome e avatar
                    comment.comments_user_full_name = `${randomAnimal} Anônimo`;
                    comment.comments_user_avatar_url = randomAnimalImageUrl; // Usa a URL padrão se não encontrar

                    processedComment = {
                      ...comment,
                      comments_user_full_name: `${randomAnimal} Anônimo`,
                      comments_user_avatar_url: randomAnimalImageUrl,
                      liked_by_me: likedComments.some(lc => lc.comment_id === comment.id)
                    };
                  }

                  return processedComment;
                }));
              } else {
                comments = commentsData;
                Alert.alert("Erro", "Não foi possível carregar os comentários.")
              }
            }
          }

          // Add comments to the post
          const postWithComments = {
            ...postWithLikes,
            comments: comments,
            // Don't automatically show comments, let user click to expand
            show_comments: false
          };

          if (post.type === 'achievement') {
            // Fetch the user_reward with the nested reward data
            const { data: rewardData, error: rewardError } = await supabase
              .from('user_rewards')
              .select(`
                    *,
                    reward:rewards(*)
                  `)
              .eq('id', post.reference_id)
              .single();

            if (rewardError || !rewardData) {
              error2("Erro", "Não foi possível carregar a conquista.")
              // Add a post with a placeholder reward to avoid errors
              postsWithDetails.push({
                ...postWithComments,
                reward: {
                  reward: {
                    name: 'Conquista',
                    description: 'Detalhes não disponíveis',
                    image_url: 'https://via.placeholder.com/100'
                  }
                }
              });
            } else {
              postsWithDetails.push({ ...postWithComments, reward: rewardData });
            }
          } else if (post.type === 'drawing') {
            const { data: drawingData, error: drawingError } = await supabase
              .from('completed_challenges')
              .select('*')
              .eq('id', post.reference_id)
              .single();

            if (drawingError || !drawingData) {
              error2("Erro", "Não foi possível carregar o desenho.")
              postsWithDetails.push({
                ...postWithComments,
                drawing: {
                  drawing_url: 'https://via.placeholder.com/100',
                  challenge_title: 'Desafio'
                }
              });
            } else {
              postsWithDetails.push({
                ...postWithComments,
                drawing: {
                  ...drawingData,
                  challenge_title: drawingData?.challenge?.title || 'Desafio'
                }
              });
            }
          } else {
            // For other post types like points
            postsWithDetails.push(postWithComments);
          }
        } catch (innerError) {
          error2("Erro", "Não foi possível processar o post.")
          // Still add the post without details to avoid breaking the UI
          postsWithDetails.push(post);
        }
      }

      setPosts(postsWithDetails);
    } catch (error) {
      error2("Erro", "Não foi possível carregar os posts.")
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const fetchUserRewards = async () => {
    try {
      const { data, error } = await supabase
        .from('user_rewards')
        .select(`
          *,
          reward:rewards(*)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      // Debug log to see the structure
      setUserRewards(data);
    } catch (error) {
      error2("Erro", "Não foi possível carregar as conquistas.")
    }
  };

  const fetchUserDrawings = async () => {
    try {
      const { data, error } = await supabase
        .from('completed_challenges')
        .select('*')
        .eq('user_id', user?.id)
        .not('drawing_url', 'is', null);

      if (error) throw error;

      const formattedDrawings = data.map(item => ({
        id: item.id,
        user_id: item.user_id,
        drawing_url: item.drawing_url,
        created_at: item.created_at,
        challenge_title: item.challenge?.title || 'Desafio'
      }));

      setUserDrawings(formattedDrawings);
    } catch (error) {
      error2("Erro", "Não foi possível carregar os desenhos.")
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
    fetchUserRewards();
    fetchUserDrawings();
  };

  const handleShare = (type: 'achievement' | 'points' | 'drawing', item?: any) => {
    if (type === 'drawing') {
      if (userDrawings.length === 0) {
        warning("Atenção", "Você ainda não tem desenhos para compartilhar.")
        return;
      }
      setShareType(type);
      setShowDrawingSelector(true);
    } else if (type === 'achievement') {
      if (userRewards.length === 0) {
        warning("Atenção", "Você ainda não tem conquistas para compartilhar.")
        return;
      }
      setShareType(type);
      setShowAchievementSelector(true);
    } else {
      // Points sharing remains the same
      setShareType(type);
      setSelectedItem(item);
      setShareContent('');
      setShowShareModal(true);
    }
  };

  const handleSelectItem = (item: any) => {
    // Format the item based on the share type to ensure consistent structure
    if (shareType === 'achievement') {
      // Make sure the item has the expected structure
      setSelectedItem({
        id: item.id,
        reward: item.reward // This should contain the reward object with image_url, name, etc.
      });
    } else if (shareType === 'drawing') {
      setSelectedItem(item);
    } else {
      setSelectedItem(item);
    }

    setShareContent('');

    // Close the selector modals
    setShowDrawingSelector(false);
    setShowAchievementSelector(false);

    // Show the share modal
    setShowShareModal(true);
  };

  const submitShare = async () => {
    if (!user || !shareType) return;

    try {
      let referenceId = '';

      if (shareType === 'achievement' && selectedItem) {
        referenceId = selectedItem.id;
      } else if (shareType === 'drawing' && selectedItem) {
        referenceId = selectedItem.id;
      } else if (shareType === 'points') {
        referenceId = userProfile?.id || '';
      }

      const { data: userProfileData, error: userProfileError } = await supabase
        .from('profiles')
        .select('show_profile_in_shared')
        .eq('user_id', user.id)
        .single();

      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: user.id,
          content: shareContent,
          type: shareType,
          reference_id: referenceId,
          is_approved: true, // Auto-approve if no parent
          points: userProfile?.points || 0,
          full_name: userProfile?.full_name || 'Usuário',
          avatar_url: userProfile?.avatar_url || null, // Set to null for now
        });

      if (error) throw error;

      setShowShareModal(false);

      success("Conteúdo compartilhado com sucesso!", "Seu conteúdo foi compartilhado na comunidade!")
      // Refresh posts to show the new one
      fetchPosts();

    } catch (error) {
      error2('Erro', 'Não foi possível compartilhar o conteúdo.');
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    return (
      <Animated.View
        style={[
          styles.postCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            {item.avatar_url ? (
              <Image
                source={{ uri: item.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.full_name.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.userName}>{item.full_name || 'Usuário'}</Text>
              <Text style={styles.postTime}>
                {new Date(item.created_at).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.postContent}>{item.content}</Text>

        {item.type === 'achievement' && item.reward && (
          <View style={styles.achievementContainer}>
            <Image
              source={{
                uri: item.reward.reward?.image_url ||
                  (item.reward.reward && typeof item.reward.reward === 'object' ?
                    Object.values(item.reward.reward).find(val =>
                      typeof val === 'string' && val.includes('http')
                    ) : 'https://via.placeholder.com/100')
              }}
              style={styles.achievementImage}
              resizeMode="contain"
            />
            <View style={styles.achievementInfo}>
              <Text style={styles.achievementTitle}>
                {item.reward.reward?.name || 'Conquista'}
              </Text>
              <Text style={styles.achievementDescription}>
                {item.reward.reward?.description || 'Detalhes não disponíveis'}
              </Text>
            </View>
          </View>
        )}

        {item.type === 'points' && (
          <View style={styles.pointsContainer}>
            <MaterialCommunityIcons name="star" size={40} color="#FFD700" />
            <Text style={styles.pointsText}>
              {item.points || 0} pontos
            </Text>
          </View>
        )}

        {item.type === 'drawing' && item.drawing && (
          <View style={styles.drawingContainer}>
            <Text style={styles.drawingTitle}>
              Desafio: {item.drawing.challenge_title}
            </Text>
            <Image
              source={{ uri: item.drawing.drawing_url }}
              style={styles.drawingImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Like and comment counts */}
        {(item.likes > 0 || (item.comments && item.comments.length > 0)) && (
          <View style={styles.engagementCount}>
            {item.likes > 0 && (
              <View style={styles.likeCount}>
                <MaterialCommunityIcons name="heart" size={16} color="#F163E0" />
                <Text style={styles.countText}>{item.likes}</Text>
              </View>
            )}
            {item.comments && item.comments.length > 0 && (
              <View style={styles.commentCount}>
                <MaterialCommunityIcons name="comment" size={16} color="#F163E0" />
                <Text style={styles.countText}>{item.comments.length}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLikePost(item.id, item.liked_by_me || false)}
          >
            <MaterialCommunityIcons
              name={item.liked_by_me ? "heart" : "heart-outline"}
              size={20}
              color={item.liked_by_me ? "#F163E0" : "#6B7280"}
            />
            <Text style={[
              styles.actionText,
              item.liked_by_me && { color: "#F163E0" }
            ]}>
              Curtir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => toggleComments(item.id, item.comments_id)}
          >
            <MaterialCommunityIcons
              name={(item.comments && item.comments.length > 0) ? "comment" : "comment-outline"}
              size={20}
              color={(item.comments && item.comments.length > 0) ? "#F163E0" : "#6B7280"}
            />
            <Text style={[
              styles.actionText,
              (item.comments && item.comments.length > 0) && { color: "#F163E0" }
            ]}>
              Comentar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments section */}
        {item.show_comments && (
          <View style={styles.commentsSection}>
            {item.comments && item.comments.length > 0 ? (
              item.comments.map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    {comment.comments_user_avatar_url ? (
                      <Image
                        source={{ uri: comment.comments_user_avatar_url }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarText}>
                          {comment.comments_user_full_name.charAt(0) || 'U'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentInfo}>
                      <Text style={styles.commentUserName}>
                        {comment.comments_user_full_name}
                      </Text>
                      <Text style={styles.commentText}>
                        {comment.comment_text}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.commentActions}>
                    <TouchableOpacity
                      style={styles.commentLikeButton}
                      onPress={() => handleLikeComment(comment.id, item.id, comment.liked_by_me || false)}
                    >
                      <Text style={[
                        styles.commentActionText,
                        comment.liked_by_me && { color: "#F163E0" }
                      ]}>
                        Curtir
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.commentTime}>
                      {new Date(comment.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                    {comment.comment_likes > 0 && (
                      <View style={styles.commentLikeCount}>
                        <MaterialCommunityIcons name="heart" size={12} color="#F163E0" />
                        <Text style={styles.commentCountText}>{comment.comment_likes}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noCommentsText}>
                Nenhum comentário ainda. Seja o primeiro a comentar!
              </Text>
            )}

            {/* Comment input */}
            <View style={styles.commentInputContainer}>
              {userProfile?.avatar_url ? (
                <Image
                  source={{ uri: userProfile.avatar_url }}
                  style={styles.commentInputAvatar}
                />
              ) : (
                <View style={styles.commentInputAvatarPlaceholder}>
                  <Text style={styles.commentInputAvatarText}>
                    {userProfile?.full_name?.charAt(0) || 'U'}
                  </Text>
                </View>
              )}
              <TextInput
                style={styles.commentInput}
                placeholder="Escreva um comentário..."
                value={activeCommentPostId === item.id ? commentText : ''}
                onChangeText={setCommentText}
                onFocus={() => setActiveCommentPostId(item.id)}
              />
              <TouchableOpacity
                style={[
                  styles.commentSubmitButton,
                  (!commentText.trim() || activeCommentPostId !== item.id) && styles.commentSubmitButtonDisabled
                ]}
                onPress={() => addComment(item.id)}
                disabled={!commentText.trim() || activeCommentPostId !== item.id}
              >
                <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  // Function to handle liking a post
  const handleLikePost = async (postId: string, currentLiked: boolean) => {
    try {
      // Optimistically update the UI
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            likes: currentLiked ? (post.likes - 1) : (post.likes + 1),
            liked_by_me: !currentLiked
          };
        }
        return post;
      }));

      // Update the database
      if (currentLiked) {
        // Unlike the post
        await supabase
          .from('post_likes')
          .delete()
          .match({ post_id: postId, user_id: user?.id });

        // Decrement the likes count in community_posts
        await supabase
          .rpc('decrement_post_likes', { post_id: postId });
      } else {
        // Like the post
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user?.id });

        // Increment the likes count in community_posts
        await supabase
          .rpc('increment_post_likes', { post_id: postId });
      }
    } catch (error) {
      error2("Erro", "Não foi possível curtir o post.")
      // Revert the optimistic update if there was an error
      fetchPosts();
    }
  };

  // Function to handle liking a comment
  const handleLikeComment = async (commentId: string, postId: string, currentLiked: boolean) => {
    try {
      // Optimistically update the UI
      setPosts(posts.map(post => {
        if (post.id === postId && post.comments) {
          return {
            ...post,
            comments: post.comments.map(comment => {
              if (comment.id === commentId) {
                return {
                  ...comment,
                  comment_likes: currentLiked ? (comment.comment_likes - 1) : (comment.comment_likes + 1),
                  liked_by_me: !currentLiked
                };
              }
              return comment;
            })
          };
        }
        return post;
      }));

      // Update the database
      if (currentLiked) {
        // Unlike the comment
        await supabase
          .from('comment_likes')
          .delete()
          .match({ comment_id: commentId, user_id: user?.id });

        // Decrement the likes count in community_comments
        await supabase
          .rpc('decrement_comment_likes', { comment_id: commentId });
      } else {
        // Like the comment
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user?.id });

        // Increment the likes count in community_comments
        await supabase
          .rpc('increment_comment_likes', { comment_id: commentId });
      }
    } catch (error) {
      error2("Erro", "Não foi possível curtir o comentário.")
      // Revert the optimistic update if there was an error
      fetchPostComments(postId);
    }
  };

  // Function to toggle showing comments for a post
  const toggleComments = async (postId: string, commentsId: string) => {
    // Find the post
    const post = posts.find(p => p.id === postId);

    // If comments are already loaded, just toggle visibility
    if (post?.comments) {
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return { ...p, show_comments: !p.show_comments };
        }
        return p;
      }));
    } else {
      // Otherwise, fetch comments first
      await fetchPostComments(postId);

      // Then show them
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return { ...p, show_comments: true };
        }
        return p;
      }));
    }

    // Set the active comment post for the input field
    if (post?.show_comments) {
      setActiveCommentPostId(null);
    } else {
      setActiveCommentPostId(postId);
    }
  };

  // Function to fetch comments for a post
  const fetchPostComments = async (postId: string) => {
    try {
      // Find the post to get its comments_id
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Fetch comments for this post
      const { data: commentsData, error } = await supabase
        .from('community_comments')
        .select('*')
        .eq('comments_id', post.comments_id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Check which comments the current user has liked
      const { data: likedComments, error: likedError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user?.id)
        .in('comment_id', commentsData.map(c => c.id));

      if (likedError) throw likedError;

      // Mark comments as liked by the current user
      const commentsWithLikeStatus = commentsData.map(comment => ({
        ...comment,
        liked_by_me: likedComments.some(lc => lc.comment_id === comment.id)
      }));

      // Update the posts state with the comments
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: commentsWithLikeStatus };
        }
        return p;
      }));
    } catch (error) {
      error2("Erro", "Não foi possível carregar os comentários.")
    }
  };

  // Function to add a new comment
  const addComment = async (postId: string) => {
    if (!commentText.trim() || !user) return;

    try {
      // Find the post to get its comments_id
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      // Lista de nomes de animais para usuários anônimos
      const animalNames = {
        lion: "Leão",
        tiger: "Tigre",
        bear: "Urso",
        elefant: "Elefante",
        giraffe: "Girafa",
        zebra: "Zebra",
        monkey: "Macaco",
        pandaBear: "Panda",
        koala: "Coala",
        kangaroo: "Canguru",
        wolf: "Lobo",
        fox: "Raposa",
        dolphin: "Golfinho",
        whale: "Baleia",
        penguim: "Pinguim",
        owl: "Coruja",
        eagle: "Águia",
        toucan: "Tucano",
      };

      // URL das imagens para usuários anônimos
      const ANIMAL_IMAGES_URLS = {
        lion: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//lion.png",
        tiger: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//tiger.png",
        bear: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//bear.png",
        elefant: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//elefant.png",
        giraffe: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//giraffe.png",
        zebra: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//zebra.png",
        monkey: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//monkey.png",
        pandaBear: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//panda_bear.png",
        koala: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//koala.png",
        kangaroo: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//kangaroo.png",
        wolf: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//wolf.png",
        fox: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//red_fox.png",
        dolphin: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//dolphin.png",
        whale: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//whale.png",
        penguim: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//penguim.png",
        owl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//owl.png",
        eagle: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//eagle.png",
        toucan: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//toucan.png",
      };

      // Verificar a configuração de privacidade do usuário
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('show_profile_in_shared')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Determinar o nome e avatar a serem usados no banco de dados
      // Sempre salvar com os dados reais do usuário no banco
      const newComment = {
        comments_id: post.comments_id,
        comments_user_id: user.id,
        comments_user_avatar_url: userProfile?.avatar_url || '',
        comments_user_full_name: userProfile?.full_name || 'Usuário',
        comment_text: commentText,
        comment_likes: 0,
        created_at: new Date().toISOString()
      };

      // Insert the comment into the database
      const { data, error } = await supabase
        .from('community_comments')
        .insert(newComment)
        .select();

      if (error) throw error;

      // Clear the comment text
      setCommentText('');

      // Determinar o nome e avatar a serem exibidos na UI com base na configuração de privacidade
      let displayName = userProfile?.full_name || 'Usuário';
      let displayAvatar = userProfile?.avatar_url || '';

      // Se o usuário optou por não mostrar seu perfil, substituir nome e avatar na UI
      if (profileData && profileData.show_profile_in_shared === false) {
        // Gerar um índice aleatório mas consistente para o mesmo usuário
        const nameIndex = user.id.charCodeAt(0) % Object.keys(animalNames).length;
        const randomAnimalKey = Object.keys(animalNames)[nameIndex] as keyof typeof animalNames;
        const randomAnimal = animalNames[randomAnimalKey];

        // Buscar a URL da imagem correspondente ao animal sorteado
        const randomAnimalImageUrl = ANIMAL_IMAGES_URLS[randomAnimalKey];

        // Substituir nome e avatar para exibição
        displayName = `${randomAnimal} Anônimo`;
        displayAvatar = randomAnimalImageUrl;
      }

      // Update the UI with the new comment, applying privacy settings immediately
      if (data && data[0]) {
        setPosts(posts.map(p => {
          if (p.id === postId) {
            const updatedComment = {
              ...data[0],
              liked_by_me: false,
              // Aplicar configurações de privacidade imediatamente na UI
              comments_user_full_name: displayName,
              comments_user_avatar_url: displayAvatar
            };

            const updatedComments = p.comments ? [...p.comments, updatedComment] : [updatedComment];
            return { ...p, comments: updatedComments, show_comments: true };
          }
          return p;
        }));
      }
    } catch (error) {
      error2('Erro', 'Não foi possível adicionar o comentário.');
    }
  };

  if (passwordModalVisible) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{hasParentPassword ? "Digite sua senha" : "Crie uma senha"}</Text>

            {!hasParentPassword && (
              <Text style={styles.modalSubtitle}>Esta senha será usada para acessar o diário dos pais</Text>
            )}

            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError("");
              }}
              placeholder="Digite sua senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />

            {!hasParentPassword && (
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setPasswordError("");
                }}
                placeholder="Confirme sua senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            )}

            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalSubmitButton, passwordLoading && styles.modalSubmitButtonDisabled]}
                onPress={handlePasswordSubmit}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>{hasParentPassword ? "Entrar" : "Criar Senha"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Comunidade',
          headerStyle: {
            backgroundColor: '#F163E0',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />

      <Text style={styles.screenTitle}>Comunidade</Text>



      <View style={styles.shareButtonsContainer}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => handleShare('points')}
        >
          <MaterialCommunityIcons name="star" size={24} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Compartilhar Pontos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => handleShare('achievement')}
        >
          <MaterialCommunityIcons name="trophy" size={24} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Compartilhar Conquista</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => handleShare('drawing')}
        >
          <MaterialCommunityIcons name="draw" size={24} color="#FFFFFF" />
          <Text style={styles.shareButtonText}>Compartilhar Desenho</Text>
        </TouchableOpacity>
      </View>


      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Carregando comunidade...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#F163E0']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-group" size={60} color="#CCCCCC" />
              <Text style={styles.emptyText}>
                Ainda não há publicações na comunidade.
              </Text>
              <Text style={styles.emptySubtext}>
                Seja o primeiro a compartilhar algo!
              </Text>
            </View>
          }
        />
      )}

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {shareType === 'achievement' ? 'Compartilhar Conquista' :
                    shareType === 'points' ? 'Compartilhar Pontos' :
                      'Compartilhar Desenho'}
                </Text>

                {shareType === 'achievement' && selectedItem && (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: selectedItem.reward?.image_url || selectedItem.reward?.reward?.image_url }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.previewTitle}>
                      {selectedItem.reward?.name || selectedItem.reward?.reward?.name}
                    </Text>
                  </View>
                )}

                {shareType === 'points' && (
                  <View style={styles.previewContainer}>
                    <View style={styles.pointsPreview}>
                      <MaterialCommunityIcons name="star" size={40} color="#FFD700" />
                      <Text style={styles.pointsPreviewText}>
                        {userProfile?.points || 0} pontos
                      </Text>
                    </View>
                  </View>
                )}

                {shareType === 'drawing' && selectedItem && (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: selectedItem.drawing_url }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.previewTitle}>{selectedItem.challenge_title}</Text>
                  </View>
                )}

                <TextInput
                  style={styles.shareInput}
                  placeholder="Escreva algo sobre isso..."
                  multiline
                  value={shareContent}
                  onChangeText={setShareContent}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setShowShareModal(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.shareModalButton]}
                    onPress={submitShare}
                  >
                    <Text style={styles.shareModalButtonText}>Compartilhar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Drawing Selector Modal */}
      <Modal
        visible={showDrawingSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDrawingSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectorModalContent}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Escolha um desenho</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowDrawingSelector(false)}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={userDrawings}
              keyExtractor={(item) => item.id}
              numColumns={2}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.drawingItem}
                  onPress={() => handleSelectItem(item)}
                >
                  <Image
                    source={{ uri: item.drawing_url }}
                    style={styles.drawingItemImage}
                    resizeMode="cover"
                  />
                  <View style={styles.drawingItemOverlay}>
                    <Text style={styles.drawingItemTitle} numberOfLines={2}>
                      {item.challenge_title || 'Desafio'}
                    </Text>
                    <Text style={styles.drawingItemDate}>
                      {new Date(item.created_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.selectorGrid}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptySelector}>
                  <MaterialCommunityIcons name="draw" size={60} color="#CCCCCC" />
                  <Text style={styles.emptySelectorText}>
                    Você ainda não tem desenhos para compartilhar.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Achievement Selector Modal */}
      <Modal
        visible={showAchievementSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAchievementSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.selectorModalContent}>
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>Escolha uma conquista</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAchievementSelector(false)}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={userRewards}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.achievementItem}
                  onPress={() => handleSelectItem(item)}
                >
                  <Image
                    source={{ uri: item.reward.image_url }}
                    style={styles.achievementItemImage}
                    resizeMode="contain"
                  />
                  <View style={styles.achievementItemInfo}>
                    <Text style={styles.achievementItemTitle}>{item.reward.name}</Text>
                    <Text style={styles.achievementItemDescription} numberOfLines={2}>
                      {item.reward.description}
                    </Text>
                    <Text style={styles.achievementItemDate}>
                      Conquistado em: {new Date(item.redeemed_at).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.selectorList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptySelector}>
                  <MaterialCommunityIcons name="trophy" size={60} color="#CCCCCC" />
                  <Text style={styles.emptySelectorText}>
                    Você ainda não tem conquistas para compartilhar.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  shareButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F163E0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  postsList: {
    padding: 16,
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F163E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  postTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  postContent: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    lineHeight: 22,
  },
  achievementContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  achievementImage: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#4B5563',
  },
  pointsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
  },
  drawingContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  drawingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  drawingImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  postActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  actionText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4B5563',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  pointsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  pointsPreviewText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 8,
  },
  shareInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 16,
  },
  shareModalButton: {
    backgroundColor: '#F163E0',
    marginLeft: 8,
  },
  shareModalButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  moderationPanel: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B',
  },
  moderationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 12,
  },
  moderationList: {
    paddingBottom: 8,
  },
  pendingPostCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginRight: 16,
    width: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  moderationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  moderationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
  },
  approveButton: {
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    marginLeft: 8,
  },
  moderationButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  // Selector modal styles
  selectorModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    marginTop: 'auto',
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorGrid: {
    paddingBottom: 20,
  },
  selectorList: {
    paddingBottom: 20,
  },
  drawingItem: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    height: 160,
    position: 'relative',
  },
  drawingItemImage: {
    width: '100%',
    height: '100%',
  },
  drawingItemOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
  },
  drawingItemTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  drawingItemDate: {
    color: '#E5E7EB',
    fontSize: 12,
    marginTop: 2,
  },
  achievementItem: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  achievementItemImage: {
    width: 60,
    height: 60,
    marginRight: 12,
  },
  achievementItemInfo: {
    flex: 1,
  },
  achievementItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  achievementItemDescription: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  achievementItemDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptySelector: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptySelectorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginVertical: 16, // Espaçamento acima e abaixo
  },

  // Like and comment counts
  engagementCount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  likeCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6B7280',
  },

  // Comments section
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentItem: {
    marginBottom: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F163E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentInfo: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 8,
  },
  commentUserName: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#374151',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 40,
    marginTop: 4,
  },
  commentLikeButton: {
    marginRight: 12,
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  commentTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  commentLikeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  commentCountText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  noCommentsText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },

  // Comment input
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentInputAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F163E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentInputAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  commentSubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F163E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  commentSubmitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  passwordInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16,
  },
  passwordError: {
    color: "#EF4444",
    marginBottom: 16,
    fontSize: 14,
  },
  modalSubmitButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F163E0",
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  modalSubmitButtonDisabled: {
    backgroundColor: "#ED77DF",
  },
  modalSubmitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default CommunityScreen;