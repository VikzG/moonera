import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, Look } from '@/lib/supabase';
import { X, Heart, BadgeCheck, ChevronLeft, ExternalLink, Shirt } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { FollowButton } from '@/components/FollowButton';
import { Video, ResizeMode } from 'expo-av';
import * as Linking from 'expo-linking';

interface OutfitItem {
  id: string;
  item_type: string;
  brand: string;
  link: string | null;
  position: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_WIDTH = SCREEN_WIDTH;
const ITEM_GAP = 0;
const SNAP_INTERVAL = ITEM_WIDTH;
const SIDE_PADDING = 0;
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.65;
const BEIGE = '#e9dfc7';
const BEIGE_DARK = '#d4c9ad';
const TOP_INSET = Platform.OS === 'web' ? 24 : 54;

export default function LookDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [look, setLook] = useState<Look | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [outfitItems, setOutfitItems] = useState<OutfitItem[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadLook();
    checkIfLiked();
    loadOutfitItems();
  }, [id]);

  const loadLook = async () => {
    try {
      const { data, error } = await supabase
        .from('looks')
        .select(`
          *,
          profiles (
            id,
            username,
            profile_image_url,
            is_authentic
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setLook(data);
      setLikesCount(data.likes_count || 0);
    } catch (error) {
      console.error('Error loading look:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfLiked = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('look_id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setIsLiked(!!data);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const loadOutfitItems = async () => {
    try {
      const { data, error } = await supabase
        .from('look_items')
        .select('*')
        .eq('look_id', id)
        .order('position', { ascending: true });

      if (error) throw error;
      setOutfitItems(data || []);
    } catch (error) {
      console.error('Error loading outfit items:', error);
    }
  };

  const toggleLike = async () => {
    if (!user || !look) return;
    try {
      if (isLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('look_id', look.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        const { error } = await supabase
          .from('likes')
          .insert([{ look_id: look.id, user_id: user.id }]);

        if (error) throw error;
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SNAP_INTERVAL);
    setCurrentImageIndex(index);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#f71c0b" />
      </View>
    );
  }

  if (!look) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Look introuvable</Text>
        <TouchableOpacity style={styles.errorBackButton} onPress={() => router.back()}>
          <Text style={styles.errorBackText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = look.image_urls && look.image_urls.length > 0 ? look.image_urls : [look.image_url];
  const hasVideo = look.video_url && look.video_url.length > 0;
  const mediaItems: { type: 'image' | 'video'; uri: string }[] = images.map((uri: string) => ({
    type: 'image' as const,
    uri,
  }));
  if (hasVideo) {
    mediaItems.push({ type: 'video', uri: look.video_url });
  }

  const styleTags: string[] = [];
  if (look.category) {
    styleTags.push(look.category);
  }
  if (look.ai_analysis?.style_category) {
    const exists = styleTags.some(
      tag => tag.toLowerCase() === look.ai_analysis.style_category.toLowerCase()
    );
    if (!exists) {
      styleTags.push(look.ai_analysis.style_category);
    }
  }
  if (look.ai_analysis?.dominant_colors) {
    styleTags.push(...look.ai_analysis.dominant_colors);
  }

  const description = look.description || look.title || '';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollInner}
      >
        <View style={styles.carouselSection}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SIDE_PADDING }}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {mediaItems.map((item, index) => {
              const isActive = index === currentImageIndex;
              return (
                <View
                  key={`media-${index}`}
                  style={[
                    styles.carouselItem,
                    index < mediaItems.length - 1 && { marginRight: ITEM_GAP },
                  ]}
                >
                  {item.type === 'image' ? (
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.lookImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Video
                      source={{ uri: item.uri }}
                      style={styles.lookImage}
                      resizeMode={ResizeMode.COVER}
                      useNativeControls
                      isLooping
                      shouldPlay={isActive}
                    />
                  )}

                  <View style={styles.overlayGradient1} />
                  <View style={styles.overlayGradient2} />
                  <View style={styles.overlayGradient3} />

                  {!isActive && (
                    <View style={styles.inactiveDarkOverlay} />
                  )}

                  {isActive && look.is_authentic_look && (
                    <View style={styles.authenticBadge}>
                      <BadgeCheck size={13} color="#00D9A3" fill="#00D9A3" />
                      <Text style={styles.authenticText}>Authentic</Text>
                    </View>
                  )}

                  {isActive && (
                    <View style={styles.overlayContent}>
                      <View style={styles.bottomRow}>
                        <TouchableOpacity
                          style={styles.userRow}
                          onPress={() => router.push(`/user/${look.user_id}`)}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                          <View style={styles.avatarWrapper}>
                            {look.profiles?.profile_image_url ? (
                              <Image
                                source={{ uri: look.profiles.profile_image_url }}
                                style={styles.avatar}
                              />
                            ) : (
                              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>
                                  {look.profiles?.username?.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            {look.profiles?.is_authentic && (
                              <View style={styles.verifiedDot}>
                                <BadgeCheck size={10} color="#00D9A3" fill="#00D9A3" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.username}>@{look.profiles?.username}</Text>
                        </TouchableOpacity>

                        <View style={styles.rightActions}>
                          {look.user_id && (
                            <FollowButton targetUserId={look.user_id} size="small" />
                          )}
                          <TouchableOpacity
                            onPress={toggleLike}
                            activeOpacity={0.7}
                            style={styles.likeButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                          <Heart
                            size={26}
                            color={isLiked ? '#f71c0b' : '#fff'}
                            fill={isLiked ? '#f71c0b' : 'transparent'}
                          />
                          {likesCount > 0 && (
                            <Text style={styles.likesCount}>{likesCount}</Text>
                          )}
                        </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>

        {mediaItems.length > 1 && (
          <View style={styles.pagination}>
            {mediaItems.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  currentImageIndex === index && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}

        <Text style={styles.description}>
          {description.length > 0 ? description : 'Description de la tenue'}
        </Text>

        {styleTags.length > 0 && (
          <View style={styles.tagsSection}>
            {styleTags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {outfitItems.length > 0 && (
          <View style={styles.outfitItemsSection}>
            <View style={styles.outfitItemsHeader}>
              <Shirt size={18} color="#3a3428" />
              <Text style={styles.outfitItemsTitle}>Détails de la tenue</Text>
            </View>
            {outfitItems.map((item, index) => (
              <View key={item.id} style={styles.outfitItemCard}>
                <View style={styles.outfitItemMain}>
                  <Text style={styles.outfitItemType}>{item.item_type}</Text>
                  <Text style={styles.outfitItemBrand}>{item.brand}</Text>
                </View>
                {item.link && (
                  <TouchableOpacity
                    style={styles.outfitItemLinkBtn}
                    onPress={() => Linking.openURL(item.link!)}
                    activeOpacity={0.7}
                  >
                    <ExternalLink size={16} color="#f71c0b" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#fff" strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BEIGE,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#4a4438',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  errorBackButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#1a1a1a',
  },
  errorBackText: {
    color: BEIGE,
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: TOP_INSET,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingBottom: 40,
  },
  carouselSection: {
    height: IMAGE_HEIGHT,
  },
  carouselItem: {
    width: ITEM_WIDTH,
    height: IMAGE_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  lookImage: {
    width: ITEM_WIDTH,
    height: IMAGE_HEIGHT,
  },
  overlayGradient1: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  overlayGradient2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: 'rgba(0, 0, 0, 0.14)',
  },
  overlayGradient3: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  inactiveDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  authenticBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  authenticText: {
    color: '#00D9A3',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarPlaceholder: {
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#f5f5f5',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 1,
  },
  username: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  likeButton: {
    alignItems: 'center',
    gap: 3,
  },
  likesCount: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 4,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BEIGE_DARK,
  },
  paginationDotActive: {
    backgroundColor: '#f71c0b',
    width: 18,
  },
  description: {
    color: '#3a3428',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 14,
  },
  tagsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f71c0b',
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tagText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: BEIGE,
    textTransform: 'capitalize',
  },
  outfitItemsSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  outfitItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  outfitItemsTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#3a3428',
  },
  outfitItemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  outfitItemMain: {
    flex: 1,
  },
  outfitItemType: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#2a2418',
    marginBottom: 3,
  },
  outfitItemBrand: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#5a5448',
  },
  outfitItemLinkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BEIGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
