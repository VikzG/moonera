import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Clan, ClanMember } from '@/lib/supabase';
import { ArrowLeft, Crown, Users, UserPlus, Settings, LogOut, UserMinus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [clan, setClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    fetchClanDetails();
  }, [id]);

  const fetchClanDetails = async () => {
    try {
      const { data: clanData, error: clanError } = await supabase
        .from('clans')
        .select(`
          *,
          profiles:leader_id (
            username,
            avatar_url,
            profile_image_url
          )
        `)
        .eq('id', id as string)
        .single();

      if (clanError) throw clanError;

      setClan(clanData);
      setIsLeader(clanData.leader_id === user?.id);

      const { data: membersData, error: membersError } = await supabase
        .from('clan_members')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            avatar_url,
            profile_image_url,
            level
          )
        `)
        .eq('clan_id', id as string)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      setMembers(membersData || []);
      setIsMember(membersData?.some(m => m.user_id === user?.id) || false);
    } catch (error) {
      console.error('Error fetching clan details:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du clan');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClanDetails();
    setRefreshing(false);
  };

  const handleJoinClan = async () => {
    try {
      const { error } = await supabase
        .from('clan_members')
        .insert({
          clan_id: id as string,
          user_id: user!.id,
        });

      if (error) {
        if (error.message.includes('duplicate')) {
          Alert.alert('Erreur', 'Tu es déjà membre d\'un clan');
        } else {
          Alert.alert('Erreur', 'Impossible de rejoindre le clan');
        }
        return;
      }

      Alert.alert('Succès', 'Tu as rejoint le clan !');
      fetchClanDetails();
    } catch (error) {
      console.error('Error joining clan:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  const handleLeaveClan = async () => {
    Alert.alert(
      'Quitter le clan',
      'Es-tu sûr de vouloir quitter ce clan ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clan_members')
                .delete()
                .eq('user_id', user!.id)
                .eq('clan_id', id as string);

              if (error) throw error;

              Alert.alert('Succès', 'Tu as quitté le clan', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error leaving clan:', error);
              Alert.alert('Erreur', 'Impossible de quitter le clan');
            }
          },
        },
      ]
    );
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    Alert.alert(
      'Exclure le membre',
      `Es-tu sûr de vouloir exclure ${memberName} du clan ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Exclure',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clan_members')
                .delete()
                .eq('id', memberId);

              if (error) throw error;

              Alert.alert('Succès', 'Le membre a été exclu');
              fetchClanDetails();
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Erreur', 'Impossible d\'exclure le membre');
            }
          },
        },
      ]
    );
  };

  const handleDeleteClan = async () => {
    Alert.alert(
      'Supprimer le clan',
      'Es-tu sûr de vouloir supprimer définitivement ce clan ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clans')
                .delete()
                .eq('id', id as string);

              if (error) throw error;

              Alert.alert('Succès', 'Le clan a été supprimé', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/clans') },
              ]);
            } catch (error) {
              console.error('Error deleting clan:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le clan');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!clan) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Clan introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{clan.name}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        <LinearGradient
          colors={['#1a1a1a', '#0a0a0a']}
          style={styles.clanHeader}
        >
          {clan.image_url ? (
            <Image source={{ uri: clan.image_url }} style={styles.clanImage} />
          ) : (
            <View style={styles.clanImagePlaceholder}>
              <Users size={48} color="#666" />
            </View>
          )}

          <Text style={styles.clanName}>{clan.name}</Text>

          {clan.description && (
            <Text style={styles.clanDescription}>{clan.description}</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Users size={24} color="#6366f1" />
              <Text style={styles.statValue}>{clan.member_count}/50</Text>
              <Text style={styles.statLabel}>Membres</Text>
            </View>
          </View>

          {!isMember && !isLeader && (
            <TouchableOpacity style={styles.joinButton} onPress={handleJoinClan}>
              <UserPlus size={20} color="#fff" />
              <Text style={styles.joinButtonText}>Rejoindre le clan</Text>
            </TouchableOpacity>
          )}

          {isMember && !isLeader && (
            <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveClan}>
              <LogOut size={20} color="#fff" />
              <Text style={styles.leaveButtonText}>Quitter le clan</Text>
            </TouchableOpacity>
          )}

          {isLeader && (
            <>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => router.push(`/clan/edit/${id}`)}
              >
                <Settings size={20} color="#fff" />
                <Text style={styles.settingsButtonText}>Paramètres du clan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteClan}>
                <Text style={styles.deleteButtonText}>Supprimer le clan</Text>
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>

        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>Membres ({members.length})</Text>

          {members.map((member) => {
            const profile = member.profiles;
            const isThisLeader = member.user_id === clan.leader_id;

            return (
              <View key={member.id} style={styles.memberCard}>
                <TouchableOpacity
                  style={styles.memberInfo}
                  onPress={() => router.push(`/user/${member.user_id}`)}
                >
                  {profile?.profile_image_url || profile?.avatar_url ? (
                    <Image
                      source={{ uri: (profile.profile_image_url || profile.avatar_url) ?? undefined }}
                      style={styles.memberAvatar}
                    />
                  ) : (
                    <View style={styles.memberAvatarPlaceholder}>
                      <Text style={styles.memberAvatarText}>
                        {profile?.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.memberDetails}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{profile?.username || 'Unknown'}</Text>
                      {isThisLeader && (
                        <View style={styles.leaderBadge}>
                          <Crown size={12} color="#FFD700" />
                          <Text style={styles.leaderBadgeText}>Chef</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberLevel}>Niveau {profile?.level || 1}</Text>
                  </View>
                </TouchableOpacity>

                {isLeader && !isThisLeader && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveMember(member.id, profile?.username || 'ce membre')}
                  >
                    <UserMinus size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  clanHeader: {
    padding: 24,
    alignItems: 'center',
  },
  clanImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginBottom: 16,
  },
  clanImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  clanName: {
    fontSize: 28,
    fontFamily: 'Break Bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  clanDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 100,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Break Bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 4,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    width: '100%',
  },
  joinButtonText: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    width: '100%',
  },
  leaveButtonText: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    width: '100%',
  },
  settingsButtonText: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#ef4444',
  },
  membersSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Break Bold',
    color: '#fff',
    marginBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 20,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  memberDetails: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Break SemiBold',
    color: '#fff',
  },
  memberLevel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 2,
  },
  leaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  leaderBadgeText: {
    fontSize: 10,
    fontFamily: 'Break Bold',
    color: '#FFD700',
  },
  removeButton: {
    padding: 8,
  },
});
