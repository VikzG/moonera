import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Camera, CheckCircle, XCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type VerificationStep = 'liveness' | 'ai_detection';

interface VerificationCameraProps {
  step: VerificationStep;
  onSuccess: (faceEmbedding?: string) => void;
  onSkip: () => void;
}

export default function VerificationCamera({ step, onSuccess, onSkip }: VerificationCameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Nous avons besoin de votre autorisation pour accéder à la caméra
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Camera size={20} color="#fff" />
          <Text style={styles.buttonText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipText}>Passer cette étape</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });

      if (!photo?.base64) {
        Alert.alert('Erreur', 'Impossible de capturer la photo');
        setIsProcessing(false);
        return;
      }

      const imageBase64 = `data:image/jpeg;base64,${photo.base64}`;
      setCapturedImage(imageBase64);

      const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-selfie`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          step,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const faceEmbedding = result.details?.faceEmbedding;
        onSuccess(faceEmbedding);
      } else {
        Alert.alert(
          'Vérification échouée',
          result.message || 'La vérification a échoué. Veuillez réessayer.',
          [
            { text: 'Réessayer', onPress: () => setCapturedImage(null) },
            { text: 'Passer', onPress: onSkip, style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la capture');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'liveness':
        return 'Vérification de présence';
      case 'ai_detection':
        return 'Vérification du selfie';
      default:
        return 'Vérification';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'liveness':
        return 'Positionnez votre visage dans le cadre et prenez une photo';
      case 'ai_detection':
        return 'Prenez un selfie clair pour vérifier votre authenticité';
      default:
        return 'Prenez une photo';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{getStepTitle()}</Text>
        <Text style={styles.description}>{getStepDescription()}</Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.faceFrame} />
          </View>
        </CameraView>
      </View>

      <View style={styles.controls}>
        {isProcessing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Vérification en cours...</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
              disabled={isProcessing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
              <Text style={styles.skipText}>Passer cette étape</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  description: {
    fontSize: 16,
    color: '#aaa',
    fontFamily: 'Inter-Regular',
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: 250,
    height: 330,
    borderRadius: 125,
    borderWidth: 3,
    borderColor: '#fff',
    borderStyle: 'dashed',
  },
  controls: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  skipButton: {
    padding: 12,
  },
  skipText: {
    color: '#aaa',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontFamily: 'Inter-Regular',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
    fontFamily: 'Inter-Regular',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});
