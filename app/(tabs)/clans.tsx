import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Clan, ClanInvitation } from '@/lib/supabase';
import { Users, Plus, Crown, Search, X, Mail, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userClanId, setUserClanId] = useState<string | null>(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Clan[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<ClanInvitation[]>([]);
  const [invitationsModalVisible, setInvitationsModalVisible] = useState(false);

  useEffect(() => {
    fetchClans();
    checkUserClan();
    loadPendingInvitations();
  }, []);

  const checkUserClan = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('clan_members')
      .select('clan_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setUserClanId(data.clan_id);
    }
  };

  const fetchClans = async () => {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select(`
          *,
          profiles:leader_id (
            username,
            avatar_url,
            profile_image_url
          )
        `)
        .order('member_count', { ascending: false });

      if (error) throw error;

      setClans(data || []);
    } catch (error) {
      console.error('Error fetching clans:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchClans();
    await checkUserClan();
    await loadPendingInvitations();
    setRefreshing(false);
  };

  const loadPendingInvitations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('clan_invitations')
        .select(`
          *,
          clans (
            id,
            name,
            image_url,
            member_count
          ),
          profiles:inviter_id (
            username
          )
        `)
        .eq('invited_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleAcceptInvitation = async (invitationId: string, clanId: string, clanName: string) => {
    try {
      if (userClanId) {
        Alert.alert('Erreur', 'Tu es déjà membre d\'un clan. Quitte ton clan actuel pour accepter cette invitation.');
        return;
      }

      const { error: updateError } = await supabase
        .from('clan_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      const { error: joinError } = await supabase
        .from('clan_members')
        .insert({
          clan_id: clanId,
          user_id: user!.id,
        });

      if (joinError) throw joinError;

      Alert.alert('Succès', `Tu as rejoint le clan ${clanName} !`);
      setInvitationsModalVisible(false);
      await loadPendingInvitations();
      await checkUserClan();
      await fetchClans();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Erreur', 'Impossible d\'accepter l\'invitation');
    }
  };

  const handleDeclineInvitation = async (invitationId: string, clanName: string) => {
    Alert.alert(
      'Refuser l\'invitation',
      `Es-tu sûr de vouloir refuser l'invitation à rejoindre ${clanName} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clan_invitations')
                .update({ status: 'declined' })
                .eq('id', invitationId);

              if (error) throw error;

              Alert.alert('Succès', 'L\'invitation a été refusée');
              await loadPendingInvitations();
            } catch (error) {
              console.error('Error declining invitation:', error);
              Alert.alert('Erreur', 'Impossible de refuser l\'invitation');
            }
          },
        },
      ]
    );
  };

  const handleCreateClan = () => {
    if (userClanId) {
      Alert.alert(
        'Déjà dans un clan',
        'Tu es déjà membre d\'un clan. Quitte ton clan actuel pour en créer un nouveau.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push('/clan/create');
  };

  const searchClans = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('clans')
        .select(`
          *,
          profiles:leader_id (
            username,
            avatar_url,
            profile_image_url
          )
        `)
        .ilike('name', `%${query}%`)
        .order('member_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching clans:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchClans(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const renderClanCard = ({ item }: { item: Clan }) => {
    const isUserClan = item.id === userClanId;
    const leaderProfile = item.profiles;

    return (
      <TouchableOpacity
        style={[styles.clanCard, isUserClan && styles.userClanCard]}
        onPress={() => router.push(`/clan/${item.id}`)}
      >
        <LinearGradient
          colors={isUserClan ? ['#1a1a1a', '#2d1a40'] : ['#1a1a1a', '#1a1a1a']}
          style={styles.clanCardGradient}
        >
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.clanImage} />
          ) : (
            <View style={styles.clanImagePlaceholder}>
              <Users size={40} color="#666" />
            </View>
          )}

          <View style={styles.clanInfo}>
            <View style={styles.clanHeader}>
              <Text style={styles.clanName}>{item.name}</Text>
              {isUserClan && (
                <View style={styles.yourClanBadge}>
                  <Text style={styles.yourClanText}>TON CLAN</Text>
                </View>
              )}
            </View>

            {item.description && (
              <Text style={styles.clanDescription} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.clanStats}>
              <View style={styles.statItem}>
                <Users size={16} color="#888" />
                <Text style={styles.statText}>{item.member_count}/50</Text>
              </View>

              <View style={styles.leaderInfo}>
                <Crown size={14} color="#FFD700" />
                <Text style={styles.leaderName}>
                  {leaderProfile?.username || 'Unknown'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clans</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setSearchModalVisible(true)}
          >
            <Search size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setInvitationsModalVisible(true)}
          >
            <Mail size={24} color="#fff" />
            {pendingInvitations.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {pendingInvitations.length > 9 ? '9+' : pendingInvitations.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateClan}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.createButtonText}>Créer</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={clans}
        keyExtractor={(item) => item.id}
        renderItem={renderClanCard}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Users size={64} color="#333" />
            <Text style={styles.emptyText}>Aucun clan pour le moment</Text>
            <Text style={styles.emptySubtext}>
              Sois le premier à créer un clan !
            </Text>
          </View>
        }
      />

      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Rechercher un clan</Text>
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
              placeholder="Nom du clan..."
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
                <Text style={styles.emptySearchText}>Aucun clan trouvé</Text>
              </View>
            ) : (
              searchResults.map(clan => {
                const isUserClan = clan.id === userClanId;
                const leaderProfile = clan.profiles;

                return (
                  <TouchableOpacity
                    key={clan.id}
                    style={styles.clanResultItem}
                    onPress={() => {
                      setSearchModalVisible(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      router.push(`/clan/${clan.id}`);
                    }}
                  >
                    {clan.image_url ? (
                      <Image
                        source={{ uri: clan.image_url }}
                        style={styles.clanResultImage}
                      />
                    ) : (
                      <View style={styles.clanResultImage}>
                        <Users size={32} color="#666" />
                      </View>
                    )}
                    <View style={styles.clanResultInfo}>
                      <View style={styles.clanResultHeader}>
                        <Text style={styles.clanResultName}>{clan.name}</Text>
                        {isUserClan && (
                          <View style={styles.yourClanBadgeSmall}>
                            <Text style={styles.yourClanTextSmall}>TON CLAN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.clanResultStats}>
                        {clan.member_count}/50 membres · Chef: {leaderProfile?.username || 'Unknown'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={invitationsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInvitationsModalVisible(false)}
      >
        <View style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Invitations</Text>
            <TouchableOpacity onPress={() => setInvitationsModalVisible(false)}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.searchResults}>
            {pendingInvitations.length === 0 ? (
              <View style={styles.emptySearchContainer}>
                <Mail size={64} color="#333" />
                <Text style={styles.emptySearchText}>Aucune invitation</Text>
              </View>
            ) : (
              pendingInvitations.map((invitation) => {
                const clan = invitation.clans;
                const inviter = invitation.profiles;

                return (
                  <View key={invitation.id} style={styles.invitationItem}>
                    <View style={styles.invitationContent}>
                      {clan?.image_url ? (
                        <Image
                          source={{ uri: clan.image_url }}
                          style={styles.invitationClanImage}
                        />
                      ) : (
                        <View style={styles.invitationClanImage}>
                          <Users size={24} color="#666" />
                        </View>
                      )}
                      <View style={styles.invitationDetails}>
                        <Text style={styles.invitationClanName}>{clan?.name}</Text>
                        <Text style={styles.invitationText}>
                          Invité par @{inviter?.username}
                        </Text>
                        <Text style={styles.invitationDate}>
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() =>
                          handleAcceptInvitation(invitation.id, clan!.id, clan!.name)
                        }
                      >
                        <Check size={20} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => handleDeclineInvitation(invitation.id, clan!.name)}
                      >
                        <X size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Break SemiBold',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  clanCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  userClanCard: {
    borderWidth: 2,
    borderColor: '#6366f1',
  },
  clanCardGradient: {
    padding: 16,
    flexDirection: 'row',
    gap: 16,
  },
  clanImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  clanImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clanInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  clanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clanName: {
    fontSize: 20,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  yourClanBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  yourClanText: {
    fontSize: 10,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  clanDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#888',
    marginTop: 4,
  },
  clanStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 14,
    fontFamily: 'Break SemiBold',
    color: '#888',
  },
  leaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderName: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#888',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Break SemiBold',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 8,
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
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
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
  clanResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  clanResultImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clanResultInfo: {
    flex: 1,
  },
  clanResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  clanResultName: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  yourClanBadgeSmall: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  yourClanTextSmall: {
    fontSize: 8,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  clanResultStats: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
  },
  invitationItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  invitationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  invitationClanImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invitationDetails: {
    flex: 1,
  },
  invitationClanName: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
    marginBottom: 4,
  },
  invitationText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#888',
    marginBottom: 2,
  },
  invitationDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
