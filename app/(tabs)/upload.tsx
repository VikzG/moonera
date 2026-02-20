import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, FlatList, Switch, TextInput, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Camera, Image as ImageIcon, X, Plus, Video as VideoIcon, Shirt, Trash2 } from 'lucide-react-native';

const CATEGORIES = [
  'Streetwear',
  'Chic',
  'Casual',
  'Vintage',
  'Sport',
  'Business',
  'Soirée',
  'Minimaliste',
];

const ITEM_TYPES = [
  'Haut',
  'Pantalon',
  'Veste',
  'Chaussures',
  'Accessoires',
  'Chapeau',
  'Sac',
  'Bijoux',
  'Autre',
];

interface OutfitItem {
  type: string;
  brand: string;
  link: string;
}

export default function UploadScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [outfitItems, setOutfitItems] = useState<OutfitItem[]>([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<OutfitItem>({ type: '', brand: '', link: '' });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const pickImage = async (fromCamera: boolean) => {
    try {
      let result;

      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire');
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
          presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire');
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.8,
          presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
        });
      }

      if (!result.canceled && result.assets[0]) {
        if (selectedImages.length < 3) {
          setSelectedImages([...selectedImages, result.assets[0].uri]);
        } else {
          Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu\'à 3 photos par tenue');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const pickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        if (result.assets[0].duration && result.assets[0].duration > 30000) {
          Alert.alert('Vidéo trop longue', 'La vidéo doit durer maximum 30 secondes');
          return;
        }
        setSelectedVideo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner la vidéo');
    }
  };

  const recordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'L\'accès à la caméra est nécessaire');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedVideo(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo');
    }
  };

  const uploadLook = async () => {
    if (selectedImages.length === 0 || !selectedCategory || !user) {
      Alert.alert('Erreur', 'Veuillez sélectionner au moins une image et une catégorie');
      return;
    }

    setUploading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const imageUri of selectedImages) {
        const fileExt = imageUri.split('.').pop() || 'jpg';
        const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

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
          .from('looks')
          .upload(fileName, fileToUpload, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('looks')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      let videoUrl = null;
      if (selectedVideo) {
        const videoExt = selectedVideo.split('.').pop() || 'mp4';
        const videoFileName = `${user.id}/videos/${Date.now()}_${Math.random().toString(36).substring(7)}.${videoExt}`;

        let videoToUpload;

        if (selectedVideo.startsWith('http://') || selectedVideo.startsWith('https://')) {
          const response = await fetch(selectedVideo);
          const blob = await response.blob();
          videoToUpload = blob;
        } else {
          const response = await fetch(selectedVideo);
          const arrayBuffer = await response.arrayBuffer();
          videoToUpload = new Uint8Array(arrayBuffer);
        }

        const { error: videoUploadError } = await supabase.storage
          .from('looks')
          .upload(videoFileName, videoToUpload, {
            contentType: 'video/mp4',
            upsert: false,
          });

        if (videoUploadError) throw videoUploadError;

        const { data: { publicUrl: videoPublicUrl } } = supabase.storage
          .from('looks')
          .getPublicUrl(videoFileName);

        videoUrl = videoPublicUrl;
      }

      const currentDate = new Date();
      const weekNumber = getWeekNumber(currentDate);
      const year = currentDate.getFullYear();

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_authentic')
        .eq('id', user.id)
        .maybeSingle();

      const isAuthenticUser = profile?.is_authentic || false;

      let aiAnalysis = null;
      try {
        const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/analyze-style`;
        const headers = {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        };
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ imageUrl: uploadedUrls[0] }),
        });

        if (response.ok) {
          aiAnalysis = await response.json();
        }
      } catch (error) {
        console.error('Error analyzing style:', error);
      }

      const { data: insertedLook, error: insertError } = await supabase
        .from('looks')
        .insert([
          {
            user_id: user.id,
            image_url: uploadedUrls[0],
            image_urls: uploadedUrls,
            video_url: videoUrl,
            category: selectedCategory,
            week_number: weekNumber,
            year: year,
            ai_analysis: aiAnalysis,
            requires_verification: isAuthenticUser,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      if (insertedLook && outfitItems.length > 0) {
        const itemsToInsert = outfitItems.map((item, index) => ({
          look_id: insertedLook.id,
          item_type: item.type,
          brand: item.brand,
          link: item.link || null,
          position: index,
        }));

        const { error: itemsError } = await supabase
          .from('look_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Error inserting outfit items:', itemsError);
        }
      }

      if (isAuthenticUser && insertedLook) {
        try {
          const imageResponse = await fetch(uploadedUrls[0]);
          const imageBlob = await imageResponse.blob();
          const reader = new FileReader();

          await new Promise((resolve, reject) => {
            reader.onloadend = async () => {
              try {
                const base64data = reader.result as string;

                const { data: { session } } = await supabase.auth.getSession();
                const verifyApiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-look`;

                const verifyResponse = await fetch(verifyApiUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    imageBase64: base64data,
                    lookId: insertedLook.id,
                  }),
                });

                if (verifyResponse.ok) {
                  const verificationResult = await verifyResponse.json();

                  if (verificationResult.isAuthentic) {
                    Alert.alert(
                      'Look Authentique',
                      'Votre look a été vérifié et classé comme authentique !',
                      [{ text: 'OK' }]
                    );
                  } else {
                    let reason = 'Vérification échouée';
                    if (verificationResult.isAiGenerated) {
                      reason = 'Image générée par IA détectée';
                    } else if (!verificationResult.faceMatches) {
                      reason = 'Le visage ne correspond pas à votre profil';
                    }
                    Alert.alert(
                      'Look Libre',
                      `Votre look a été publié en tant que "Look Libre". Raison: ${reason}`,
                      [{ text: 'OK' }]
                    );
                  }
                }
                resolve(null);
              } catch (error) {
                console.error('Error verifying look:', error);
                resolve(null);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageBlob);
          });
        } catch (error) {
          console.error('Error in verification process:', error);
        }
      } else {
        Alert.alert('Succès', 'Votre look a été publié !');
      }

      setSelectedImages([]);
      setSelectedVideo(null);
      setSelectedCategory(null);
      setOutfitItems([]);
      router.push('/(tabs)');
    } catch (error) {
      console.error('Error uploading look:', error);
      Alert.alert('Erreur', 'Impossible de publier le look');
    } finally {
      setUploading(false);
    }
  };

  const openItemModal = (index: number | null = null) => {
    if (index !== null) {
      setCurrentItem(outfitItems[index]);
      setEditingIndex(index);
    } else {
      setCurrentItem({ type: '', brand: '', link: '' });
      setEditingIndex(null);
    }
    setShowItemModal(true);
  };

  const saveOutfitItem = () => {
    if (!currentItem.type || !currentItem.brand) {
      Alert.alert('Erreur', 'Veuillez remplir le type et la marque');
      return;
    }

    if (editingIndex !== null) {
      const updatedItems = [...outfitItems];
      updatedItems[editingIndex] = currentItem;
      setOutfitItems(updatedItems);
    } else {
      if (outfitItems.length >= 8) {
        Alert.alert('Limite atteinte', 'Vous pouvez ajouter jusqu\'à 8 éléments');
        return;
      }
      setOutfitItems([...outfitItems, currentItem]);
    }

    setShowItemModal(false);
    setCurrentItem({ type: '', brand: '', link: '' });
    setEditingIndex(null);
  };

  const deleteOutfitItem = (index: number) => {
    setOutfitItems(outfitItems.filter((_, i) => i !== index));
  };

  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  return (
    <>
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/bg_publier.png')}
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
        <Text style={styles.title}>PUBLIER UNE TENUE</Text>
      </View>
      <View style={styles.headerSeparator} />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {selectedImages.length === 0 ? (
          <View style={styles.imagePickerContainer}>
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={() => pickImage(true)}
            >
              <Camera size={48} color="#fff" />
              <Text style={styles.imagePickerText}>Prendre une photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={() => pickImage(false)}
            >
              <ImageIcon size={48} color="#fff" />
              <Text style={styles.imagePickerText}>Choisir dans la galerie</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.previewContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
                {selectedImages.map((uri, index) => (
                  <View key={index} style={styles.imagePreviewWrapper}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <X size={20} color="#fff" />
                    </TouchableOpacity>
                    {index === 0 && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Principale</Text>
                      </View>
                    )}
                  </View>
                ))}
                {selectedImages.length < 3 && (
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={() => pickImage(false)}
                  >
                    <Plus size={32} color="#999" />
                    <Text style={styles.addMoreText}>Ajouter</Text>
                    <Text style={styles.addMoreSubtext}>({selectedImages.length}/3)</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            <View style={styles.videoContainer}>
              <Text style={styles.sectionTitle}>Vidéo (optionnelle - max 30s)</Text>
              {selectedVideo ? (
                <View style={styles.videoPreviewWrapper}>
                  <Video
                    source={{ uri: selectedVideo }}
                    style={styles.videoPreview}
                    useNativeControls
                    resizeMode="contain"
                    isLooping
                  />
                  <TouchableOpacity
                    style={styles.removeVideoButton}
                    onPress={() => setSelectedVideo(null)}
                  >
                    <X size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.videoButtons}>
                  <TouchableOpacity
                    style={styles.videoButton}
                    onPress={recordVideo}
                  >
                    <Camera size={24} color="#fff" />
                    <Text style={styles.videoButtonText}>Filmer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.videoButton}
                    onPress={pickVideo}
                  >
                    <VideoIcon size={24} color="#fff" />
                    <Text style={styles.videoButtonText}>Galerie</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.categoriesContainer}>
              <Text style={styles.sectionTitle}>Catégorie</Text>
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map(category => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButton,
                      selectedCategory === category && styles.categoryButtonActive,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        selectedCategory === category && styles.categoryTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.itemsContainer}>
              <View style={styles.itemsHeader}>
                <Text style={styles.sectionTitle}>Détails de la tenue (optionnel)</Text>
                <Text style={styles.itemsSubtitle}>Jusqu'à 8 éléments</Text>
              </View>

              {outfitItems.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemCardContent}>
                    <Shirt size={20} color="#F71D0C" />
                    <View style={styles.itemCardInfo}>
                      <Text style={styles.itemType}>{item.type}</Text>
                      <Text style={styles.itemBrand}>{item.brand}</Text>
                    </View>
                  </View>
                  <View style={styles.itemCardActions}>
                    <TouchableOpacity
                      style={styles.itemEditBtn}
                      onPress={() => openItemModal(index)}
                    >
                      <Text style={styles.itemEditText}>Modifier</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemDeleteBtn}
                      onPress={() => deleteOutfitItem(index)}
                    >
                      <Trash2 size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {outfitItems.length < 8 && (
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => openItemModal()}
                >
                  <Plus size={20} color="#fff" />
                  <Text style={styles.addItemText}>Ajouter un élément</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {selectedImages.length > 0 && (
        <View style={styles.publishButtonContainer}>
          <TouchableOpacity
            style={[
              styles.publishButton,
              (!selectedCategory || uploading) && styles.publishButtonDisabled,
            ]}
            onPress={uploadLook}
            disabled={!selectedCategory || uploading}
          >
            <Text style={styles.publishButtonText}>
              {uploading ? 'Publication...' : 'Publier'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>

    <Modal
        visible={showItemModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingIndex !== null ? 'Modifier l\'élément' : 'Ajouter un élément'}
              </Text>
              <TouchableOpacity onPress={() => setShowItemModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Type d'élément *</Text>
              <View style={styles.typeGrid}>
                {ITEM_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      currentItem.type === type && styles.typeButtonActive,
                    ]}
                    onPress={() => setCurrentItem({ ...currentItem, type })}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        currentItem.type === type && styles.typeButtonTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Marque *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Nike, Zara, Adidas..."
                placeholderTextColor="#666"
                value={currentItem.brand}
                onChangeText={(text) => setCurrentItem({ ...currentItem, brand: text })}
              />

              <Text style={styles.inputLabel}>Lien du produit (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://..."
                placeholderTextColor="#666"
                value={currentItem.link}
                onChangeText={(text) => setCurrentItem({ ...currentItem, link: text })}
                keyboardType="url"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.saveItemButton}
                onPress={saveOutfitItem}
              >
                <Text style={styles.saveItemButtonText}>
                  {editingIndex !== null ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 16,
  },
  imagePickerContainer: {
    padding: 16,
    gap: 16,
  },
  imagePickerButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  previewContainer: {
    padding: 16,
  },
  imagesScroll: {
    flexDirection: 'row',
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  previewImage: {
    width: 200,
    height: 267,
    borderRadius: 16,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#000',
  },
  addMoreButton: {
    width: 200,
    height: 267,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#999',
    marginTop: 8,
  },
  addMoreSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#666',
    marginTop: 4,
  },
  categoriesContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoryButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#999',
  },
  categoryTextActive: {
    color: '#000',
  },
  publishButtonContainer: {
    padding: 16,
    paddingBottom: 100,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  publishButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.4,
  },
  publishButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#000',
  },
  videoContainer: {
    padding: 16,
  },
  videoPreviewWrapper: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoPreview: {
    width: '100%',
    height: 200,
  },
  removeVideoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  videoButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  videoButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  itemsContainer: {
    padding: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemsSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
  },
  itemCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#333',
  },
  itemCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  itemCardInfo: {
    flex: 1,
  },
  itemType: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    marginBottom: 2,
  },
  itemBrand: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
  },
  itemCardActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  itemEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#333',
    borderRadius: 6,
  },
  itemEditText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  itemDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6b1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  addItemText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: '#1a1a1a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
    marginBottom: 8,
    marginTop: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  typeButtonActive: {
    backgroundColor: '#F71D0C',
    borderColor: '#F71D0C',
  },
  typeButtonText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#999',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  saveItemButton: {
    backgroundColor: '#F71D0C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveItemButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
});
