import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Upload } from 'lucide-react-native';

export default function CreateClanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const fileExt = uri.split('.').pop();
      const fileName = `${user!.id}-${Date.now()}.${fileExt}`;
      const filePath = `clan-images/${fileName}`;

      let fileToUpload;

      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileToUpload = blob;
      } else {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        fileToUpload = new Uint8Array(arrayBuffer);
      }

      const { error: uploadError } = await supabase.storage
        .from('looks')
        .upload(filePath, fileToUpload, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('looks')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom du clan est requis');
      return;
    }

    if (name.length < 3 || name.length > 20) {
      Alert.alert('Erreur', 'Le nom doit contenir entre 3 et 20 caractères');
      return;
    }

    if (description && description.length > 300) {
      Alert.alert('Erreur', 'La description ne peut pas dépasser 300 caractères');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      const { data, error } = await supabase
        .from('clans')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          image_url: imageUrl,
          leader_id: user!.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Erreur', 'Ce nom de clan est déjà pris');
        } else {
          Alert.alert('Erreur', 'Impossible de créer le clan');
        }
        return;
      }

      Alert.alert('Succès', 'Ton clan a été créé !', [
        {
          text: 'OK',
          onPress: () => router.replace(`/clan/${data.id}`),
        },
      ]);
    } catch (error) {
      console.error('Error creating clan:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Créer un clan</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.clanImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Upload size={32} color="#666" />
              <Text style={styles.imagePlaceholderText}>Ajouter un logo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Nom du clan *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Les Stylés"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoCapitalize="words"
          />
          <Text style={styles.helperText}>{name.length}/20 caractères</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Décris ton clan..."
            placeholderTextColor="#666"
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>{description.length}/300 caractères</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Règles du clan</Text>
          <Text style={styles.infoText}>• Maximum 50 membres</Text>
          <Text style={styles.infoText}>• Tu seras le chef du clan</Text>
          <Text style={styles.infoText}>• Tu ne peux créer qu'un seul clan</Text>
          <Text style={styles.infoText}>• Le nom doit être unique</Text>
        </View>

        <TouchableOpacity
          style={[styles.createButton, loading && styles.disabledButton]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Créer le clan</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  imagePickerContainer: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  clanImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Break SemiBold',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#fff',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'Break SemiBold',
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#888',
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: 'Break Bold',
    color: '#fff',
  },
});
