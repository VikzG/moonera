import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Trophy, Crown, Medal } from 'lucide-react-native';
import { FollowButton } from '@/components/FollowButton';

interface TopUser {
  id: string;
  username: string;
  profile_image_url: string | null;
  level: number;
  xp: number;
  total_likes: number;
}

export default function TopScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    loadTopUsers();
  }, []);

  const loadTopUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, profile_image_url, level, xp, total_likes')
        .order('level', { ascending: false })
        .order('xp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTopUsers(data || []);

      if (user && data) {
        const rank = data.findIndex(u => u.id === user.id);
        setUserRank(rank !== -1 ? rank + 1 : null);
      }
    } catch (error) {
      console.error('Error loading top users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankStyle = (index: number) => {
    if (index === 0) return { color: '#FFD700', icon: Crown };
    if (index === 1) return { color: '#C0C0C0', icon: Medal };
    if (index === 2) return { color: '#CD7F32', icon: Medal };
    return { color: '#fff', icon: Trophy };
  };

  const renderUser = ({ item, index }: { item: TopUser; index: number }) => {
    const rankStyle = getRankStyle(index);
    const RankIcon = rankStyle.icon;
    const isCurrentUser = item.id === user?.id;

    return (
      <TouchableOpacity
        style={[
          styles.userCard,
          isCurrentUser && styles.currentUserCard,
        ]}
        onPress={() => router.push(`/user/${item.id}`)}
        activeOpacity={0.9}
      >
        <View style={styles.rankContainer}>
          <RankIcon size={20} color={rankStyle.color} />
          <Text style={[styles.rank, { color: rankStyle.color }]}>#{index + 1}</Text>
        </View>

        <View style={styles.userContent}>
          {item.profile_image_url ? (
            <Image source={{ uri: item.profile_image_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.userInfo}>
            <Text style={styles.username}>@{item.username}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Niveau</Text>
                <Text style={styles.statValue}>{item.level}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>XP</Text>
                <Text style={styles.statValue}>{item.xp.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Likes</Text>
                <Text style={styles.statValue}>{item.total_likes}</Text>
              </View>
            </View>
          </View>
        </View>

        {isCurrentUser ? (
          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>Vous</Text>
          </View>
        ) : (
          <View style={styles.followContainer}>
            <FollowButton targetUserId={item.id} size="small" />
          </View>
        )}
      </TouchableOpacity>
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
        <View>
          <Text style={styles.title}>Top 100</Text>
          <Text style={styles.subtitle}>Classement des utilisateurs par niveau</Text>
        </View>
        <Trophy size={32} color="#FFD700" />
      </View>

      {userRank && (
        <View style={styles.userRankBanner}>
          <Text style={styles.userRankText}>Votre classement : #{userRank}</Text>
        </View>
      )}

      {topUsers.length === 0 ? (
        <View style={styles.emptyState}>
          <Trophy size={64} color="#333" />
          <Text style={styles.emptyTitle}>Aucun utilisateur</Text>
          <Text style={styles.emptyText}>
            Le classement est vide pour le moment
          </Text>
        </View>
      ) : (
        <FlatList
          data={topUsers}
          renderItem={renderUser}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  title: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#999',
    marginTop: 4,
  },
  userRankBanner: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  userRankText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFD700',
    textAlign: 'center',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#999',
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  userCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  currentUserCard: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  rankContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    zIndex: 1,
  },
  rank: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#999',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  followContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  youBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  youBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#000',
  },
});
