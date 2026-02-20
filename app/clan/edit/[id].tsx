import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Clan, Profile } from '@/lib/supabase';
import { ArrowLeft, Save, UserPlus, Search, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

interface ClanInvitation {
  id: string;
  clan_id: string;
  invited_user_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  profiles?: Profile;
}

export default function EditClanScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clan, setClan] = useState<Clan | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<ClanInvitation[]>([]);

  useEffect(() => {
    loadClanData();
    loadPendingInvitations();
  }, [id]);

  const loadClanData = async () => {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('*')
        .eq('id', id as string)
        .single();

      if (error) throw error;

      if (data.leader_id !== user?.id) {
        Alert.alert('Erreur', 'Seul le chef du clan peut modifier les paramètres');
        router.back();
        return;
      }

      setClan(data);
      setName(data.name);
      setDescription(data.description || '');
      setImageUrl(data.image_url || '');
    } catch (error) {
      console.error('Error loading clan:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du clan');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('clan_invitations')
        .select(`
          *,
          profiles:invited_user_id (
            id,
            username,
            profile_image_url,
            level
          )
        `)
        .eq('clan_id', id as string)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du clan est requis');
      return;
    }

    if (name.length < 3 || name.length > 20) {
      Alert.alert('Erreur', 'Le nom doit contenir entre 3 et 20 caractères');
      return;
    }

    if (description.length > 300) {
      Alert.alert('Erreur', 'La description ne peut pas dépasser 300 caractères');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('clans')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          image_url: imageUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id as string);

      if (error) throw error;

      Alert.alert('Succès', 'Les paramètres du clan ont été mis à jour', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error updating clan:', error);
      if (error.message?.includes('duplicate')) {
        Alert.alert('Erreur', 'Ce nom de clan est déjà utilisé');
      } else {
        Alert.alert('Erreur', 'Impossible de mettre à jour le clan');
      }
    } finally {
      setSaving(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data: existingMembers } = await supabase
        .from('clan_members')
        .select('user_id');

      const memberIds = existingMembers?.map(m => m.user_id) || [];

      const { data: existingInvites } = await supabase
        .from('clan_invitations')
        .select('invited_user_id')
        .eq('clan_id', id as string)
        .eq('status', 'pending');

      const invitedIds = existingInvites?.map(i => i.invited_user_id) || [];

      const excludedIds = [...memberIds, ...invitedIds, user!.id];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .not('id', 'in', `(${excludedIds.join(',')})`)
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

  const handleInviteUser = async (userId: string, username: string) => {
    try {
      const { error } = await supabase
        .from('clan_invitations')
        .insert({
          clan_id: id as string,
          inviter_id: user!.id,
          invited_user_id: userId,
        });

      if (error) throw error;

      Alert.alert('Succès', `${username} a été invité à rejoindre le clan`);
      setInviteModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      loadPendingInvitations();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      if (error.message?.includes('duplicate')) {
        Alert.alert('Erreur', 'Cet utilisateur a déjà une invitation en attente');
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer l\'invitation');
      }
    }
  };

  const handleCancelInvitation = async (invitationId: string, username: string) => {
    Alert.alert(
      'Annuler l\'invitation',
      `Es-tu sûr de vouloir annuler l'invitation de ${username} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('clan_invitations')
                .delete()
                .eq('id', invitationId);

              if (error) throw error;

              Alert.alert('Succès', 'L\'invitation a été annulée');
              loadPendingInvitations();
            } catch (error) {
              console.error('Error canceling invitation:', error);
              Alert.alert('Erreur', 'Impossible d\'annuler l\'invitation');
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Paramètres du clan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations du clan</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du clan</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nom du clan"
              placeholderTextColor="#666"
              maxLength={20}
            />
            <Text style={styles.helperText}>{name.length}/20 caractères</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description du clan (optionnel)"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              maxLength={300}
            />
            <Text style={styles.helperText}>{description.length}/300 caractères</Text>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Save size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Invitations</Text>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => setInviteModalVisible(true)}
            >
              <UserPlus size={18} color="#fff" />
              <Text style={styles.inviteButtonText}>Inviter</Text>
            </TouchableOpacity>
          </View>

          {pendingInvitations.length === 0 ? (
            <View style={styles.emptyInvitations}>
              <Text style={styles.emptyText}>Aucune invitation en attente</Text>
            </View>
          ) : (
            pendingInvitations.map((invitation) => {
              const profile = invitation.profiles;
              return (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationUsername}>
                      @{profile?.username || 'Unknown'}
                    </Text>
                    <Text style={styles.invitationDate}>
                      Invité le {new Date(invitation.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() =>
                      handleCancelInvitation(invitation.id, profile?.username || 'cet utilisateur')
                    }
                  >
                    <X size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        visible={inviteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.inviteModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Inviter un membre</Text>
            <TouchableOpacity
              onPress={() => {
                setInviteModalVisible(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputContainer}>
            <Search size={20} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un utilisateur..."
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
              searchResults.map((profile) => (
                <TouchableOpacity
                  key={profile.id}
                  style={styles.userResultItem}
                  onPress={() => handleInviteUser(profile.id, profile.username)}
                >
                  <View style={styles.userResultInfo}>
                    <Text style={styles.userResultUsername}>@{profile.username}</Text>
                    <Text style={styles.userResultLevel}>Niveau {profile.level}</Text>
                  </View>
                  <UserPlus size={20} color="#6366f1" />
                </TouchableOpacity>
              ))
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
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Break Bold',
    color: '#fff',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  inviteButtonText: {
    fontSize: 14,
    fontFamily: 'Break SemiBold',
    color: '#fff',
  },
  emptyInvitations: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationUsername: {
    fontSize: 14,
    fontFamily: 'Break SemiBold',
    color: '#fff',
    marginBottom: 4,
  },
  invitationDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  cancelButton: {
    padding: 8,
  },
  inviteModal: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 24,
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
  userResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  userResultInfo: {
    flex: 1,
  },
  userResultUsername: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
    marginBottom: 4,
  },
  userResultLevel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
  },
});
