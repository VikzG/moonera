import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface XPBarProps {
  xp: number;
  level: number;
}

export default function XPBar({ xp, level }: XPBarProps) {
  const xpForCurrentLevel = (level - 1) * 100;
  const xpForNextLevel = level * 100;
  const xpInCurrentLevel = xp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progress = Math.min(xpInCurrentLevel / xpNeededForNextLevel, 1);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.levelText}>Niveau {level}</Text>
        <Text style={styles.xpText}>{xp} XP</Text>
      </View>

      <View style={styles.barContainer}>
        <View style={styles.barBackground}>
          <LinearGradient
            colors={['#4CAF50', '#8BC34A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${progress * 100}%` }]}
          />
        </View>
      </View>

      <Text style={styles.progressText}>
        {xpInCurrentLevel} / {xpNeededForNextLevel} XP jusqu'au niveau {level + 1}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#fff',
  },
  xpText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#4CAF50',
  },
  barContainer: {
    marginBottom: 8,
  },
  barBackground: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#999',
    textAlign: 'center',
  },
});
