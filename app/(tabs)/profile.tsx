import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Look, Badge } from '@/lib/supabase';
import { Settings, Camera } from 'lucide-react-native';
import { LogoNav } from '@/components/LogoNav';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [looks, setLooks] = useState<Look[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [duelWins, setDuelWins] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user) {
      loadUserLooks();
      loadUserBadges();
      loadUserRank();
      loadFollowCounts();
    }
  }, [user]);

  const loadFollowCounts = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('followers_count, following_count')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setFollowersCount(data.followers_count || 0);
        setFollowingCount(data.following_count || 0);
      }
    } catch (error) {
      console.error('Error loading follow counts:', error);
    }
  };

  const loadUserLooks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('looks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLooks(data || []);

      const wins = data?.reduce((sum, look) => sum + (look.duel_wins || 0), 0) || 0;
      setDuelWins(wins);
    } catch (error) {
      console.error('Error loading user looks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserBadges = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      setBadges(data || []);
    } catch (error) {
      console.error('Error loading badges:', error);
    }
  };

  const loadUserRank = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, level, xp')
        .order('level', { ascending: false })
        .order('xp', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data) {
        const rank = data.findIndex(u => u.id === user.id);
        setUserRank(rank !== -1 ? rank + 1 : null);
      }
    } catch (error) {
      console.error('Error loading user rank:', error);
    }
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const pickProfileImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const uploadProfileImage = async (imageUri: string) => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      let fileToUpload;

      if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        fileToUpload = blob;
      } else {
        const response = await fetch(imageUri);
        const arrayBuffer = await response.arrayBuffer();
        fileToUpload = new Uint8Array(arrayBuffer);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, fileToUpload, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error uploading profile image:', error);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const getXPProgress = () => {
    const level = profile?.level || 1;
    const xp = profile?.xp || 0;
    const xpForNextLevel = level * 100;
    const xpInCurrentLevel = xp % 100;
    return {
      current: xpInCurrentLevel,
      total: 100,
      percentage: (xpInCurrentLevel / 100) * 100,
      nextLevel: level + 1,
    };
  };

  const xpProgress = getXPProgress();

  const blurRadius = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 10],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const profileImageUrl = profile?.profile_image_url || (looks.length > 0 ? looks[0].image_url : null);

  return (
    <View style={styles.container}>
      <View style={styles.fixedImageContainer}>
        <TouchableOpacity onPress={pickProfileImage} activeOpacity={0.8} style={StyleSheet.absoluteFill}>
          <Image
            source={profileImageUrl ? { uri: profileImageUrl } : require('@/assets/images/icon.png')}
            style={styles.profileImage}
          />
          {Platform.OS === 'web' ? (
            <Animated.View
              style={[
                styles.blurOverlay,
                {
                  opacity: scrollY.interpolate({
                    inputRange: [0, 200],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  }),
                }
              ]}
            />
          ) : (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: scrollY.interpolate({
                    inputRange: [0, 200],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  }),
                }
              ]}
              pointerEvents="none"
            >
              <BlurView intensity={50} style={StyleSheet.absoluteFill} />
            </Animated.View>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,1)']}
            locations={[0, 0.15, 0.4, 0.75, 1]}
            style={styles.profileGradient}
            pointerEvents="none"
          />
          {uploadingAvatar && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.header, {
        opacity: scrollY.interpolate({
          inputRange: [0, 150],
          outputRange: [1, 0],
          extrapolate: 'clamp',
        }),
      }]}>
        <Text style={styles.title}>PROFIL</Text>
        <TouchableOpacity onPress={handleSettings} style={styles.settingsButton}>
          <Settings size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.scrollSpacer}>
          <View style={styles.usernameContainer}>
            <Text style={styles.username}>@{profile?.username}</Text>
          </View>
        </View>

        <View style={styles.profileContent}>

          <View style={styles.followSection}>
            <View style={styles.followStat}>
              <Text style={styles.followStatNumber}>{followersCount}</Text>
              <Text style={styles.followStatLabel}>Followers</Text>
            </View>
            <View style={styles.followDivider} />
            <View style={styles.followStat}>
              <Text style={styles.followStatNumber}>{followingCount}</Text>
              <Text style={styles.followStatLabel}>Suivis</Text>
            </View>
          </View>

          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Niveau {profile?.level || 1}</Text>
            <Text style={styles.levelPercentage}>{xpProgress.percentage.toFixed(1)}%</Text>
          </View>

          <View style={styles.xpBarContainer}>
            <View style={styles.xpBarBackground}>
              <View style={[styles.xpBarFill, { width: `${xpProgress.percentage}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {xpProgress.current}/{xpProgress.total} XP jusqu'au niveau {xpProgress.nextLevel}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{duelWins}V</Text>
            </View>

            <View style={styles.logoContainer}>
              <LogoNav size={50} color="#F71D0C" />
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statValue}>R-{userRank || 55}</Text>
            </View>
          </View>

          <View style={styles.badgesSection}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.badgesRow}>
              {profile?.is_authentic && (
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeText}>Authentic User</Text>
                </View>
              )}
              {badges.some(b => b.badge_type === 'verified') && (
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeText}>Verified</Text>
                </View>
              )}
              {badges.length === 0 && !profile?.is_authentic && (
                <Text style={styles.noBadgesText}>Aucun badge</Text>
              )}
            </View>
          </View>

          <View style={styles.looksSection}>
            <Text style={styles.sectionTitle}>Looks</Text>
            <View style={styles.looksGrid}>
              {looks.slice(0, 3).map((look, index) => (
                <TouchableOpacity
                  key={look.id}
                  onPress={() => router.push(`/look/${look.id}`)}
                  style={styles.lookThumbnail}
                >
                  <Image
                    source={{ uri: look.image_urls?.[0] || look.image_url }}
                    style={styles.lookImage}
                  />
                </TouchableOpacity>
              ))}
              {looks.length === 0 && (
                <Text style={styles.noLooksText}>Aucun look</Text>
              )}
            </View>
          </View>

          <View style={styles.battleHistorySection}>
            <Text style={styles.sectionTitle}>Battle History</Text>
            <View style={styles.battleHistoryPlaceholder}>
              <Text style={styles.comingSoonText}>Bientôt disponible</Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  settingsButton: {
    padding: 4,
  },
  scrollView: {
    position: 'relative',
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  fixedImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.9,
    zIndex: 1,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  scrollSpacer: {
    height: 480,
    justifyContent: 'flex-end',
    position: 'relative',
    zIndex: 11,
  },
  profileGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
  } as any,
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  usernameContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  username: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  followSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  followStat: {
    alignItems: 'center',
    minWidth: 70,
  },
  followStatNumber: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  followStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
    marginTop: 2,
  },
  followDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  profileContent: {
    padding: 20,
    paddingTop: 24,
    position: 'relative',
    zIndex: 11,
  },
  levelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  levelPercentage: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#FF3B30',
  },
  xpBarContainer: {
    marginBottom: 30,
    padding: 12,
    borderRadius: 12,
  },
  xpBarBackground: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
  },
  xpText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#999',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
    padding: 20,
    borderRadius: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  badgesSection: {
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  badgeItem: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  noBadgesText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  looksSection: {
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
  },
  looksGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  lookThumbnail: {
    flex: 1,
    aspectRatio: 3 / 4,
    overflow: 'hidden',
  },
  lookImage: {
    width: '100%',
    height: '100%',
  },
  noLooksText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  battleHistorySection: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
  },
  battleHistoryPlaceholder: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  comingSoonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
});
