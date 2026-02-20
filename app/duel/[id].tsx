import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { LogoNav } from '@/components/LogoNav';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DuelData {
  id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_votes: number;
  challenged_votes: number;
  total_votes: number;
  status: string;
  category: string | null;
  challenger_look_id: string | null;
  challenged_look_id: string | null;
  created_at: string;
  accepted_at: string | null;
}

interface LookData {
  id: string;
  image_url: string;
  image_urls: string[];
  video_url: string | null;
  is_authentic_look: boolean;
}

interface ProfileData {
  username: string;
  profile_image_url: string | null;
}

export default function DuelViewScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [duel, setDuel] = useState<DuelData | null>(null);
  const [challengerLook, setChallengerLook] = useState<LookData | null>(null);
  const [challengedLook, setChallengedLook] = useState<LookData | null>(null);
  const [challengerProfile, setChallengerProfile] = useState<ProfileData | null>(null);
  const [challengedProfile, setChallengedProfile] = useState<ProfileData | null>(null);
  const [challengerClan, setChallengerClan] = useState<string | null>(null);
  const [challengedClan, setChallengedClan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const loadDuel = async () => {
    try {
      const { data: duelData, error } = await supabase
        .from('duels')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setDuel(duelData);

      if (duelData.challenger_look_id) {
        const { data: lookData } = await supabase
          .from('looks')
          .select('id, image_url, image_urls, video_url, is_authentic_look')
          .eq('id', duelData.challenger_look_id)
          .single();
        setChallengerLook(lookData);
      }

      if (duelData.challenged_look_id) {
        const { data: lookData } = await supabase
          .from('looks')
          .select('id, image_url, image_urls, video_url, is_authentic_look')
          .eq('id', duelData.challenged_look_id)
          .single();
        setChallengedLook(lookData);
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, profile_image_url')
        .in('id', [duelData.challenger_id, duelData.challenged_id]);

      if (profiles) {
        const challengerProf = profiles.find(p => p.id === duelData.challenger_id);
        const challengedProf = profiles.find(p => p.id === duelData.challenged_id);
        setChallengerProfile(challengerProf || null);
        setChallengedProfile(challengedProf || null);
      }

      const { data: clanData } = await supabase
        .from('clan_members')
        .select('user_id, clans(name)')
        .in('user_id', [duelData.challenger_id, duelData.challenged_id]);

      if (clanData) {
        clanData.forEach((cm: any) => {
          if (cm.user_id === duelData.challenger_id) {
            setChallengerClan(cm.clans?.name || null);
          }
          if (cm.user_id === duelData.challenged_id) {
            setChallengedClan(cm.clans?.name || null);
          }
        });
      }

      if (user) {
        const { data: voteData } = await supabase
          .from('duel_votes')
          .select('id')
          .eq('duel_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        setHasVoted(!!voteData);
        setShowResults(!!voteData);
      }
    } catch (error) {
      console.error('Error loading duel:', error);
    } finally {
      setLoading(false);
    }
  };

  const completeDuelAutomatically = useCallback(async () => {
    if (!duel) return;
    try {
      const { error } = await supabase.rpc('complete_duel', { p_duel_id: duel.id });
      if (!error) await loadDuel();
    } catch (error) {
      console.error('Error completing duel:', error);
    }
  }, [duel]);

  useEffect(() => {
    loadDuel();
  }, []);

  useEffect(() => {
    if (!duel) return;

    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const createdAt = new Date(duel.created_at).getTime();
      const duelDuration = 6 * 60 * 60 * 1000;
      const endTime = createdAt + duelDuration;
      const remaining = endTime - now;

      if (remaining <= 0 && duel.status === 'active') {
        completeDuelAutomatically();
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 10000);
    return () => clearInterval(interval);
  }, [duel, completeDuelAutomatically]);

  const vote = async (votedFor: 'challenger' | 'challenged') => {
    if (!user || !duel || hasVoted) return;
    setVoting(true);

    try {
      const { error } = await supabase
        .from('duel_votes')
        .insert({
          duel_id: duel.id,
          user_id: user.id,
          voted_for: votedFor,
        });

      if (error) throw error;
      setHasVoted(true);
      setShowResults(true);
      await loadDuel();
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        setHasVoted(true);
        setShowResults(true);
      }
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!duel || !challengerLook || !challengedLook) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Duel introuvable</Text>
        <TouchableOpacity style={styles.errorBackButton} onPress={() => router.back()}>
          <Text style={styles.errorBackText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const challengerPercentage = duel.total_votes > 0
    ? Math.round((duel.challenger_votes / duel.total_votes) * 100)
    : 0;
  const challengedPercentage = duel.total_votes > 0
    ? Math.round((duel.challenged_votes / duel.total_votes) * 100)
    : 0;

  const isDuelCompleted = duel.status === 'completed';
  const canVote = !hasVoted && !isDuelCompleted;
  const displayResults = showResults || isDuelCompleted;

  const challengerImage = challengerLook.image_urls?.[0] || challengerLook.image_url;
  const challengedImage = challengedLook.image_urls?.[0] || challengedLook.image_url;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.halfContainer}
        activeOpacity={canVote ? 0.85 : 1}
        onPress={() => canVote && vote('challenger')}
        disabled={voting}
      >
        <Image source={{ uri: challengerImage }} style={styles.fullImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        {displayResults && (
          <View style={styles.percentageWrapper}>
            <Text style={styles.percentageText}>{challengerPercentage}%</Text>
          </View>
        )}
        <View style={styles.userInfoBottomLeft}>
          <View style={styles.userInfoContent}>
            <View>
              <Text style={styles.userNameOverlay}>@{challengerProfile?.username}</Text>
              {challengerClan && <Text style={styles.clanNameOverlay}>{challengerClan}</Text>}
            </View>
            {challengerProfile?.profile_image_url && (
              <Image source={{ uri: challengerProfile.profile_image_url }} style={styles.avatarSmall} />
            )}
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.halfContainer}
        activeOpacity={canVote ? 0.85 : 1}
        onPress={() => canVote && vote('challenged')}
        disabled={voting}
      >
        <Image source={{ uri: challengedImage }} style={styles.fullImage} />
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.userInfoTopRight}>
          <View style={styles.userInfoContentRight}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.userNameOverlay}>@{challengedProfile?.username}</Text>
              {challengedClan && <Text style={styles.clanNameOverlay}>{challengedClan}</Text>}
            </View>
            {challengedProfile?.profile_image_url && (
              <Image source={{ uri: challengedProfile.profile_image_url }} style={styles.avatarSmall} />
            )}
          </View>
        </View>
        {displayResults && (
          <View style={styles.percentageWrapper}>
            <Text style={styles.percentageText}>{challengedPercentage}%</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.centerLogoWrapper} pointerEvents="none">
        <View style={styles.centerLogoBg}>
          <LogoNav size={36} color="#F71D0C" />
        </View>
      </View>

      {duel.category && (
        <View style={styles.categoryBadgeWrap} pointerEvents="none">
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{duel.category}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <X size={24} color="#fff" />
      </TouchableOpacity>

      {canVote && !voting && (
        <View style={styles.voteHint} pointerEvents="none">
          <Text style={styles.voteHintText}>Tapez pour voter</Text>
        </View>
      )}

      {voting && (
        <View style={styles.votingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#666',
  },
  errorBackButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  errorBackText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#fff',
  },
  halfContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  fullImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  percentageWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 64,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  userInfoBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 16,
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userInfoTopRight: {
    position: 'absolute',
    top: 20,
    right: 16,
  },
  userInfoContentRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userNameOverlay: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  clanNameOverlay: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    marginTop: 2,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  centerLogoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  centerLogoBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeWrap: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(247,29,12,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  voteHint: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  voteHintText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  votingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
});
