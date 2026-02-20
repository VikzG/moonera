import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import VerificationCamera from '@/components/VerificationCamera';
import { supabase } from '@/lib/supabase';
import { CheckCircle } from 'lucide-react-native';

type VerificationStep = 'auth' | 'choice' | 'liveness' | 'ai_detection' | 'complete';

const topImages = [
  require('@/assets/images/top_img_auth.png'),
  require('@/assets/images/top_img_auth_2.png'),
  require('@/assets/images/top_img_auth_3.png'),
];

const bottomImages = [
  require('@/assets/images/bot_img_auth.png'),
  require('@/assets/images/bot_img_auth_2.png'),
  require('@/assets/images/bot_img_auth_3.png'),
];

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState<VerificationStep>('auth');
  const [wantVerification, setWantVerification] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { signUp, signIn } = useAuth();
  const router = useRouter();

  const usernameHeight = useRef(new Animated.Value(0)).current;
  const usernameOpacity = useRef(new Animated.Value(0)).current;
  const imageOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(usernameHeight, {
        toValue: isSignUp ? 69 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(usernameOpacity, {
        toValue: isSignUp ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isSignUp]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(imageOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setCurrentImageIndex((prev) => (prev + 1) % 3);
        Animated.timing(imageOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !username)) {
      setError('Tous les champs sont requis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, username);
        if (error) {
          setError(error.message || 'Erreur lors de l\'inscription');
        } else {
          setVerificationStep('choice');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message || 'Email ou mot de passe incorrect');
        } else {
          router.replace('/(tabs)');
        }
      }
    } catch (err) {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationChoice = async (choice: boolean) => {
    setWantVerification(choice);
    if (choice) {
      setVerificationStep('liveness');
    } else {
      await completeWithoutVerification();
    }
  };

  const handleLivenessSuccess = () => {
    setVerificationStep('ai_detection');
  };

  const handleAiDetectionSuccess = async (faceEmbedding?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({
          is_authentic: true,
          verification_status: 'verified',
          face_embedding: faceEmbedding || null,
        })
        .eq('id', user.id);

      setVerificationStep('complete');
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000);
    } catch (error) {
      console.error('Error updating verification status:', error);
      await completeWithoutVerification();
    }
  };

  const completeWithoutVerification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({
          verification_status: 'libre',
        })
        .eq('id', user.id);

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error:', error);
      router.replace('/(tabs)');
    }
  };

  if (verificationStep === 'liveness') {
    return (
      <VerificationCamera
        step="liveness"
        onSuccess={handleLivenessSuccess}
        onSkip={completeWithoutVerification}
      />
    );
  }

  if (verificationStep === 'ai_detection') {
    return (
      <VerificationCamera
        step="ai_detection"
        onSuccess={handleAiDetectionSuccess}
        onSkip={completeWithoutVerification}
      />
    );
  }

  if (verificationStep === 'complete') {
    return (
      <View style={styles.completeContainer}>
        <CheckCircle size={80} color="#f71c0b" />
        <Text style={styles.completeTitle}>Vérification réussie</Text>
        <Text style={styles.completeText}>
          Vous êtes maintenant un utilisateur authentique
        </Text>
      </View>
    );
  }

  if (verificationStep === 'choice') {
    return (
      <View style={styles.outerContainer}>
        <View style={styles.container}>
          <Animated.Image
            source={topImages[currentImageIndex]}
            style={[styles.topBackgroundImage, { filter: 'grayscale(100%)', opacity: imageOpacity } as any]}
            resizeMode="cover"
          />
          <View style={styles.topImageOverlay} />

          <Animated.Image
            source={bottomImages[currentImageIndex]}
            style={[styles.bottomBackgroundImage, { filter: 'grayscale(100%)', opacity: imageOpacity } as any]}
            resizeMode="cover"
          />
          <View style={styles.bottomImageOverlay} />

          <View style={styles.logoContainer}>
            <Text style={styles.choiceTitleLarge}>Devenir Authentique ?</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.choiceDescription}>
              Les utilisateurs authentiques ont accès à des fonctionnalités exclusives et plus de crédibilité dans la communauté.
            </Text>

            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <CheckCircle size={20} color="#f71c0b" />
                <Text style={styles.benefitText}>Badge vérifié sur votre profil</Text>
              </View>
              <View style={styles.benefitItem}>
                <CheckCircle size={20} color="#f71c0b" />
                <Text style={styles.benefitText}>Plus de visibilité</Text>
              </View>
              <View style={styles.benefitItem}>
                <CheckCircle size={20} color="#f71c0b" />
                <Text style={styles.benefitText}>Participer aux duels authentiques</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={() => handleVerificationChoice(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                Devenir Authentique
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerButton}
              onPress={() => handleVerificationChoice(false)}
            >
              <Text style={styles.footerText}>
                Continuer sans vérification
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        <Animated.Image
          source={topImages[currentImageIndex]}
          style={[styles.topBackgroundImage, { filter: 'grayscale(100%)', opacity: imageOpacity } as any]}
          resizeMode="cover"
        />
        <View style={styles.topImageOverlay} />

        <Animated.Image
          source={bottomImages[currentImageIndex]}
          style={[styles.bottomBackgroundImage, { filter: 'grayscale(100%)', opacity: imageOpacity } as any]}
          resizeMode="cover"
        />
        <View style={styles.bottomImageOverlay} />

        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/logo_png.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.formContainer}>
          <Animated.View style={{
            height: usernameHeight,
            opacity: usernameOpacity,
            overflow: 'hidden',
          }}>
            <TextInput
              placeholder="Nom d'utilisateur"
              placeholderTextColor="#8d8d8d"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={isSignUp}
            />
          </Animated.View>

          <TextInput
            placeholder="Email"
            placeholderTextColor="#8d8d8d"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Mot de passe"
            placeholderTextColor="#8d8d8d"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Chargement...' : isSignUp ? 'S\'inscrire' : 'Se connecter'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
          >
            <Text style={styles.footerText}>
              {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    position: 'relative',
    overflow: 'hidden',
  },
  topBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    width: '100%',
    opacity: 0.5,
  },
  topImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(12, 12, 12, 0.4)',
  },
  bottomBackgroundImage: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    width: '100%',
    opacity: 0.5,
  },
  bottomImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(12, 12, 12, 0.4)',
  },
  logoContainer: {
    position: 'absolute',
    top: '15%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 20,
  },
  logo: {
    width: 300,
    height: 150,
  },
  formContainer: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  input: {
    height: 55,
    width: '100%',
    backgroundColor: 'rgba(12, 12, 12, 0.8)',
    borderWidth: 1,
    borderColor: '#8d8d8d',
    borderRadius: 0,
    paddingHorizontal: 20,
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: '#f5f5f5',
    marginBottom: 14,
  },
  button: {
    height: 60,
    width: '100%',
    backgroundColor: '#f71c0b',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  footerButton: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#f5f5f5',
    textAlign: 'center',
  },
  error: {
    color: '#f71c0b',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    marginBottom: 10,
  },
  choiceTitleLarge: {
    fontSize: 36,
    fontFamily: 'Inter-Bold',
    color: '#f5f5f5',
    textAlign: 'center',
    lineHeight: 42,
  },
  choiceDescription: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  benefitsList: {
    width: '100%',
    marginBottom: 28,
    gap: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#f5f5f5',
    flex: 1,
  },
  completeContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  completeTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  completeText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#f5f5f5',
    textAlign: 'center',
  },
});
