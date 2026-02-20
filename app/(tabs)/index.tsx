import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, RefreshControl, TextInput, Modal, ScrollView, ActivityIndicator, Animated, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Look } from '@/lib/supabase';
import { Heart, Search, X, Bell, BadgeCheck, ArrowLeft, Trophy, Award, TrendingUp, UserPlus } from 'lucide-react-native';
import { Profile, Notification } from '@/lib/supabase';
import { FollowButton } from '@/components/FollowButton';
import { Video, ResizeMode } from 'expo-av';
import { AuthenticLookBadge } from '@/components/BadgeDisplay';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 2;
const IMAGE_SIZE = (width - 48) / COLUMN_COUNT;

export default function FeedScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [looks, setLooks] = useState<Look[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedLooks, setLikedLooks] = useState<Set<string>>(new Set());
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    } else if (user) {
      loadLooks();
      loadUserLikes();
      loadUnreadNotifications();
    }
  }, [user, authLoading]);

  const loadLooks = async () => {
    try {
      const { data, error } = await supabase
        .from('looks')
        .select(`
          *,
          profiles (
            id,
            username,
            avatar_url,
            profile_image_url,
            is_authentic,
            clan_members (
              clans (
                id,
                name
              )
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLooks(data || []);
    } catch (error) {
      console.error('Error loading looks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserLikes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('likes')
        .select('look_id')
        .eq('user_id', user.id);

      if (error) throw error;
      const likedSet = new Set(data?.map(like => like.look_id) || []);
      setLikedLooks(likedSet);
    } catch (error) {
      console.error('Error loading user likes:', error);
    }
  };

  const loadUnreadNotifications = async () => {
    if (!user) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread notifications:', error);
    }
  };

  const loadNotifications = async () => {
    if (!user) return;

    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter(n => !n.read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unreadIds);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleLike = async (lookId: string) => {
    if (!user) return;

    const isLiked = likedLooks.has(lookId);

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('look_id', lookId);

        if (error) throw error;

        setLikedLooks(prev => {
          const newSet = new Set(prev);
          newSet.delete(lookId);
          return newSet;
        });

        setLooks(prev =>
          prev.map(look =>
            look.id === lookId ? { ...look, likes_count: look.likes_count - 1 } : look
          )
        );
      } else {
        const { error } = await supabase
          .from('likes')
          .insert([{ user_id: user.id, look_id: lookId }]);

        if (error) throw error;

        setLikedLooks(prev => new Set(prev).add(lookId));

        setLooks(prev =>
          prev.map(look =>
            look.id === lookId ? { ...look, likes_count: look.likes_count + 1 } : look
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLooks();
    loadUserLikes();
  };

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);


  const VideoLookCard = ({ item }: { item: Look }) => {
    const isLiked = likedLooks.has(item.id);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const clanName = item.profiles?.clan_members?.[0]?.clans?.name;
    const isAuthentic = item.profiles?.is_authentic;
    const profileImageUrl = item.profiles?.profile_image_url;

    useEffect(() => {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }, []);

    return (
      <TouchableOpacity
        style={styles.videoContainer}
        onPress={() => router.push(`/look/${item.id}`)}
        activeOpacity={0.9}
      >
        <Video
          source={{ uri: item.video_url }}
          style={styles.videoImage}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
          isMuted
        />
        <AuthenticLookBadge isAuthentic={item.is_authentic_look || false} />
        <View style={styles.overlay}>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.profiles?.username}</Text>
            {clanName && <Text style={styles.clanName}>{clanName}</Text>}
          </View>
          <View style={styles.profileSection}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {item.profiles?.username?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isAuthentic && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={12} color="#00D9A3" fill="#00D9A3" />
              </View>
            )}
          </View>
        </View>
        <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
      </TouchableOpacity>
    );
  };

  const CarouselLookCard = ({ item }: { item: Look }) => {
    const isLiked = likedLooks.has(item.id);
    const images = item.image_urls && item.image_urls.length > 0 ? item.image_urls : [item.image_url];
    const hasMultipleImages = images.length > 1;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [nextImageIndex, setNextImageIndex] = useState(1);
    const slideAnim = useRef(new Animated.Value(0)).current;
    const clanName = item.profiles?.clan_members?.[0]?.clans?.name;
    const isAuthentic = item.profiles?.is_authentic;
    const profileImageUrl = item.profiles?.profile_image_url;

    useEffect(() => {
      if (!hasMultipleImages) return;

      const interval = setInterval(() => {
        const next = (currentImageIndex + 1) % images.length;
        setNextImageIndex(next);

        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          setCurrentImageIndex(next);
          slideAnim.setValue(0);
        });
      }, 3000);

      return () => clearInterval(interval);
    }, [hasMultipleImages, images.length, currentImageIndex]);

    const currentTranslate = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, IMAGE_SIZE],
    });

    const nextTranslate = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-IMAGE_SIZE, 0],
    });

    return (
      <TouchableOpacity
        style={styles.lookContainer}
        onPress={() => router.push(`/look/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.imageContainer}>
          <Animated.Image
            source={{ uri: images[currentImageIndex] }}
            style={[
              styles.image,
              styles.absoluteImage,
              { transform: [{ translateX: currentTranslate }] },
            ]}
          />
          {hasMultipleImages && (
            <Animated.Image
              source={{ uri: images[nextImageIndex] }}
              style={[
                styles.image,
                styles.absoluteImage,
                { transform: [{ translateX: nextTranslate }] },
              ]}
            />
          )}
        </View>
        <AuthenticLookBadge isAuthentic={item.is_authentic_look || false} />
        <View style={styles.overlay}>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.profiles?.username}</Text>
            {clanName && <Text style={styles.clanName}>{clanName}</Text>}
          </View>
          <View style={styles.profileSection}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImageText}>
                  {item.profiles?.username?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {isAuthentic && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={12} color="#00D9A3" fill="#00D9A3" />
              </View>
            )}
          </View>
        </View>
        {hasMultipleImages && (
          <View style={styles.multipleImagesBadge}>
            <Text style={styles.multipleImagesText}>{currentImageIndex + 1}/{images.length}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const columns = useMemo(() => {
    const leftColumn: Look[] = [];
    const rightColumn: Look[] = [];
    let leftHeight = 0;
    let rightHeight = 0;

    looks.forEach((look) => {
      const hasVideo = look.video_url && look.video_url.length > 0;
      const itemHeight = hasVideo ? IMAGE_SIZE * 2 + 8 : IMAGE_SIZE;

      if (leftHeight <= rightHeight) {
        leftColumn.push(look);
        leftHeight += itemHeight;
      } else {
        rightColumn.push(look);
        rightHeight += itemHeight;
      }
    });

    return { leftColumn, rightColumn };
  }, [looks]);

  const renderLookInColumn = (item: Look) => {
    const hasVideo = item.video_url && item.video_url.length > 0;

    if (hasVideo) {
      return (
        <View key={item.id} style={styles.videoItem}>
          <VideoLookCard item={item} />
        </View>
      );
    }

    return (
      <View key={item.id} style={styles.imageItem}>
        <CarouselLookCard item={item} />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>LOOKS</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setNotificationsModalVisible(true);
              loadNotifications();
            }}
          >
            <Bell size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSearchModalVisible(true)}
          >
            <Search size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        style={styles.flatList}
      >
        <View style={styles.grid}>
          <View style={styles.column}>
            {columns.leftColumn.map(renderLookInColumn)}
          </View>
          <View style={styles.column}>
            {columns.rightColumn.map(renderLookInColumn)}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>RECHERCHER</Text>
            <TouchableOpacity onPress={() => {
              setSearchModalVisible(false);
              setSearchQuery('');
              setSearchResults([]);
            }}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputContainer}>
            <Search size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Nom d'utilisateur..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <ScrollView style={styles.searchResults}>
            {searching ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
              <View style={styles.emptySearchContainer}>
                <Text style={styles.emptySearchText}>Aucun utilisateur trouvé</Text>
              </View>
            ) : (
              searchResults.map(profile => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.userResultItem}
                  onPress={() => {
                    setSearchModalVisible(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    router.push(`/user/${profile.id}`);
                  }}
                >
                  {profile.profile_image_url ? (
                    <Image
                      source={{ uri: profile.profile_image_url }}
                      style={styles.userResultAvatar}
                    />
                  ) : (
                    <View style={styles.userResultAvatar}>
                      <Text style={styles.userResultAvatarText}>
                        {profile.username?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.userResultInfo}>
                    <Text style={styles.userResultUsername}>@{profile.username}</Text>
                    <Text style={styles.userResultStats}>
                      {profile.total_likes} likes · Niveau {profile.level}
                    </Text>
                  </View>
                  <FollowButton targetUserId={profile.id} size="small" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={notificationsModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setNotificationsModalVisible(false)}
      >
        <ImageBackground
          source={require('@/assets/images/bg_notifications.jpg')}
          style={styles.notificationsBackgroundImage}
          resizeMode="cover"
        >
          <View style={styles.notificationsOverlay} />

          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.05)', 'transparent']}
            locations={[0, 0.3, 0.65, 1]}
            style={styles.gradientTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.45)']}
            locations={[0, 0.35, 0.7, 1]}
            style={styles.gradientBottom}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.04)', 'transparent']}
            locations={[0, 0.3, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientLeft}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.04)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.35)']}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientRight}
            pointerEvents="none"
          />

          <View style={styles.notificationsHeader}>
            <Text style={styles.notificationsTitle}>NOTIFICATIONS</Text>
            <TouchableOpacity onPress={() => setNotificationsModalVisible(false)} style={styles.closeButton}>
              <X size={32} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
          <View style={styles.notificationsHeaderSeparator} />

          {loadingNotifications ? (
            <View style={styles.notificationsLoadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyNotifications}>
              <Bell size={64} color="rgba(255, 255, 255, 0.3)" strokeWidth={1.5} />
              <Text style={styles.emptyNotificationsTitle}>Aucune notification</Text>
              <Text style={styles.emptyNotificationsSubtitle}>
                Vous serez notifié lorsque vous recevrez{'\n'}des likes ou des badges
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.notificationsContent}>
              <View style={styles.notificationsList}>
                {notifications.length > 0 && (
                  notifications.map(notification => (
                    <View key={notification.id} style={styles.notificationCard}>
                      <View style={styles.notificationIconContainer}>
                        {notification.type === 'like' && <Heart size={32} color="#ff4757" fill="#ff4757" />}
                        {notification.type === 'badge_earned' && <Trophy size={32} color="#ffd700" />}
                        {notification.type === 'top_100' && <Award size={32} color="#ffd700" />}
                        {notification.type === 'level_up' && <TrendingUp size={32} color="#4caf50" />}
                        {notification.type === 'follow' && <UserPlus size={32} color="#3b82f6" />}
                      </View>
                      <View style={styles.notificationInfo}>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <Text style={styles.notificationMessage}>{notification.message}</Text>
                        <Text style={styles.notificationTime}>
                          {(() => {
                            const date = new Date(notification.created_at);
                            const now = new Date();
                            const diffInMs = now.getTime() - date.getTime();
                            const diffInMinutes = Math.floor(diffInMs / 60000);
                            const diffInHours = Math.floor(diffInMinutes / 60);
                            const diffInDays = Math.floor(diffInHours / 24);

                            if (diffInMinutes < 1) return "À l'instant";
                            if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
                            if (diffInHours < 24) return `Il y a ${diffInHours}h`;
                            if (diffInDays === 1) return 'Hier';
                            if (diffInDays < 7) return `Il y a ${diffInDays}j`;
                            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                          })()}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </ImageBackground>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flatList: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  logo: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  grid: {
    flexDirection: 'row',
    padding: 8,
    paddingBottom: 100,
    gap: 8,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  imageItem: {
    height: IMAGE_SIZE,
  },
  videoItem: {
    height: IMAGE_SIZE * 2 + 8,
  },
  lookContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  videoImage: {
    width: '100%',
    height: '100%',
  },
  recDot: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ff4444',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  absoluteImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  clanName: {
    color: '#aaa',
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  profileSection: {
    position: 'relative',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  profileImageText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter-Bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 1,
  },
  multipleImagesBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multipleImagesText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  searchModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  searchTitle: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
  },
  searchResults: {
    flex: 1,
  },
  searchLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptySearchContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#999',
  },
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  userResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userResultAvatarText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  userResultInfo: {
    flex: 1,
  },
  userResultUsername: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 4,
  },
  userResultStats: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
  },
  notificationsBackgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  notificationsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  gradientLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 60,
    zIndex: 1,
  },
  gradientRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 60,
    zIndex: 1,
  },
  notificationsHeader: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  notificationsHeaderSeparator: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 0,
    zIndex: 2,
  },
  notificationsTitle: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  notificationsLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationsContent: {
    flex: 1,
  },
  notificationsList: {
    padding: 20,
    paddingTop: 0,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    gap: 16,
  },
  notificationIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  notificationInfo: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
    fontWeight: '600',
  },
  notificationMessage: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  emptyNotifications: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyNotificationsTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
    marginTop: 24,
    fontWeight: '600',
  },
  emptyNotificationsSubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
