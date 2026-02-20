import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Award, Trophy, Star, ShieldCheck, Crown, BadgeCheck } from 'lucide-react-native';
import { Badge } from '@/lib/supabase';

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
}

interface LookBadgeProps {
  isAuthentic: boolean;
}

export default function BadgeDisplay({ badge, size = 'medium' }: BadgeDisplayProps) {
  const getBadgeInfo = (badgeType: string) => {
    switch (badgeType) {
      case 'authentic_user':
        return {
          label: 'Authentic User',
          color: '#00D9A3',
          icon: ShieldCheck,
          description: 'Identité vérifiée'
        };
      case 'verified_authentic':
        return {
          label: 'Verified Authentic',
          color: '#9F7AEA',
          icon: Crown,
          description: '20+ tenues authentiques'
        };
      case 'rookie':
        return {
          label: 'Rookie',
          color: '#4CAF50',
          icon: Star,
          description: 'Niveau 5 atteint'
        };
      case 'rising_star':
        return {
          label: 'Rising Star',
          color: '#FFD700',
          icon: Star,
          description: 'Top 100 hebdomadaire'
        };
      case 'elite_style':
        return {
          label: 'Elite Style',
          color: '#C0C0C0',
          icon: Award,
          description: 'Style d\'élite'
        };
      case 'legend':
        return {
          label: 'Legend',
          color: '#CD7F32',
          icon: Trophy,
          description: 'Légende du style'
        };
      default:
        return {
          label: 'Badge',
          color: '#999',
          icon: Award,
          description: ''
        };
    }
  };

  const badgeInfo = getBadgeInfo(badge.badge_type);
  const Icon = badgeInfo.icon;

  const iconSize = size === 'small' ? 16 : size === 'large' ? 32 : 20;
  const fontSize = size === 'small' ? 10 : size === 'large' ? 16 : 12;

  return (
    <View style={[
      styles.badge,
      size === 'small' && styles.badgeSmall,
      size === 'large' && styles.badgeLarge
    ]}>
      <Icon size={iconSize} color={badgeInfo.color} />
      <Text style={[styles.badgeText, { color: badgeInfo.color, fontSize }]}>
        {badgeInfo.label}
      </Text>
    </View>
  );
}

export function AuthenticLookBadge({ isAuthentic }: LookBadgeProps) {
  if (!isAuthentic) return null;

  return (
    <View style={styles.lookBadge}>
      <BadgeCheck size={14} color="#00D9A3" fill="#00D9A3" />
      <Text style={styles.lookBadgeText}>Authentic</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  badgeSmall: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  badgeLarge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  badgeText: {
    fontFamily: 'Inter-SemiBold',
  },
  lookBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 163, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 163, 0.3)',
  },
  lookBadgeText: {
    color: '#00D9A3',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.5,
  },
});
