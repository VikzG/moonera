import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const letterL = useRef(new Animated.Value(0)).current;
  const letterO = useRef(new Animated.Value(0)).current;
  const letterO2 = useRef(new Animated.Value(0)).current;
  const letterK = useRef(new Animated.Value(0)).current;
  const letterS = useRef(new Animated.Value(0)).current;
  const subtitleStyleAnim = useRef(new Animated.Value(0)).current;
  const subtitleInspiration = useRef(new Animated.Value(0)).current;
  const subtitleCommunity = useRef(new Animated.Value(0)).current;
  const containerTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const letterDuration = 100;
    const subtitleDuration = 150;

    Animated.sequence([
      Animated.delay(0),
      Animated.timing(letterL, { toValue: 1, duration: letterDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(100),
      Animated.timing(letterO, { toValue: 1, duration: letterDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(200),
      Animated.timing(letterO2, { toValue: 1, duration: letterDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.timing(letterK, { toValue: 1, duration: letterDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.timing(letterS, { toValue: 1, duration: letterDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.timing(subtitleStyleAnim, { toValue: 1, duration: subtitleDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(750),
      Animated.timing(subtitleInspiration, { toValue: 1, duration: subtitleDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(900),
      Animated.timing(subtitleCommunity, { toValue: 1, duration: subtitleDuration, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(1700),
      Animated.timing(containerTranslateY, { toValue: -SCREEN_HEIGHT, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      onFinish();
    });
  }, []);

  const makeLetterStyle = (opacity: Animated.Value) => ({
    opacity,
    transform: [{
      translateY: opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [20, 0],
      }),
    }],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: containerTranslateY }] }]}>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Animated.Text style={[styles.letter, makeLetterStyle(letterL)]}>
            L
          </Animated.Text>
          <Animated.Text style={[styles.letter, makeLetterStyle(letterO)]}>
            O
          </Animated.Text>
          <Animated.Text style={[styles.letter, makeLetterStyle(letterO2)]}>
            O
          </Animated.Text>
          <Animated.Text style={[styles.letter, makeLetterStyle(letterK)]}>
            K
          </Animated.Text>
          <Animated.Text style={[styles.letter, makeLetterStyle(letterS)]}>
            S
          </Animated.Text>
        </View>

        <View style={styles.subtitleContainer}>
          <Animated.Text style={[styles.subtitle, { opacity: subtitleStyleAnim }]}>
            Style
          </Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: subtitleStyleAnim }]}>
            {' \u2022 '}
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, { opacity: subtitleInspiration }]}>
            Inspiration
          </Animated.Text>
          <Animated.Text style={[styles.dot, { opacity: subtitleInspiration }]}>
            {' \u2022 '}
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, { opacity: subtitleCommunity }]}>
            Community
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  letter: {
    fontSize: 48,
    fontFamily: 'Break-Bold',
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 4,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666666',
  },
  dot: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#666666',
  },
});
