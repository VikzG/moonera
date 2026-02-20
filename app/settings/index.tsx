import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, User, Lock, Trash2 } from 'lucide-react-native';

export default function SettingsScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          bio: bio || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditingProfile(false);
      Alert.alert('Succes', 'Profil mis a jour');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erreur', 'Impossible de mettre a jour le profil');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irreversible. Toutes vos donnees seront definitivement supprimees.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_user');
              if (error) throw error;
              await signOut();
              router.replace('/auth');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le compte');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Deconnexion',
      'Etes-vous sur de vouloir vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnexion',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/bg_paremetres.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.overlay} />

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

      <View style={styles.header}>
        <Text style={styles.title}>PARAMETRES</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={32} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerSeparator} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <User size={20} color="#fff" />
                <Text style={styles.sectionTitle}>Profil</Text>
              </View>

              {!isEditingProfile ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Nom d'utilisateur</Text>
                    <Text style={styles.value}>@{profile?.username}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Nom complet</Text>
                    <Text style={styles.value}>{profile?.full_name || 'Non renseigne'}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Bio</Text>
                    <Text style={styles.value}>{profile?.bio || 'Non renseignee'}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => setIsEditingProfile(true)}
                  >
                    <Text style={styles.buttonText}>Modifier le profil</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nom complet</Text>
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Votre nom complet"
                      placeholderTextColor="#666"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Bio</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Parlez-nous de votre style..."
                      placeholderTextColor="#666"
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      onPress={() => {
                        setIsEditingProfile(false);
                        setFullName(profile?.full_name || '');
                        setBio(profile?.bio || '');
                      }}
                    >
                      <Text style={styles.buttonSecondaryText}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.button, saving && styles.buttonDisabled]}
                      onPress={handleSaveProfile}
                      disabled={saving}
                    >
                      <Text style={styles.buttonText}>
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Lock size={20} color="#fff" />
                <Text style={styles.sectionTitle}>Compte</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email}</Text>
              </View>

              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleSignOut}
              >
                <Text style={styles.buttonDangerText}>Se deconnecter</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Trash2 size={20} color="#ff4444" />
                <Text style={[styles.sectionTitle, { color: '#ff4444' }]}>Zone dangereuse</Text>
              </View>

              <Text style={styles.warningText}>
                La suppression de votre compte est definitive et irreversible.
                Toutes vos photos et donnees seront supprimees.
              </Text>

              <TouchableOpacity
                style={[styles.button, styles.buttonDanger]}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.buttonDangerText}>Supprimer mon compte</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    filter: 'grayscale(1)',
  } as any,
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    zIndex: 1,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    zIndex: 1,
  },
  gradientLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '15%',
    zIndex: 1,
  },
  gradientRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '15%',
    zIndex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerSeparator: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 0,
    zIndex: 2,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  backButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  infoRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 0,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 0,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#000',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonSecondaryText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  buttonDanger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  buttonDangerText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#ff4444',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  warningText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 16,
    lineHeight: 20,
  },
});
