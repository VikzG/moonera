import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, UserChallenge, DailyChallenge } from '@/lib/supabase';
import { Heart, Image as ImageIcon, ThumbsUp, Swords } from 'lucide-react-native';

export default function ChallengesScreen() {
  const { user } = useAuth();
  const [weeklyChallenges, setWeeklyChallenges] = useState<UserChallenge[]>([]);
  const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadChallenges();
    }
  }, [user]);

  const loadChallenges = async () => {
    if (!user) return;

    try {
      const currentWeek = getISOWeek(new Date());
      const currentYear = getISOYear(new Date());
      const today = new Date().toISOString().split('T')[0];

      const { data: weeklyData, error: weeklyError } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('week_number', currentWeek)
        .eq('year', currentYear)
        .order('completed', { ascending: true })
        .order('created_at', { ascending: false });

      if (weeklyError) throw weeklyError;

      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('user_id', user.id)
        .eq('day_date', today)
        .order('completed', { ascending: true })
        .order('created_at', { ascending: false });

      if (dailyError) throw dailyError;

      setWeeklyChallenges(weeklyData || []);
      setDailyChallenges(dailyData || []);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const getISOWeek = (date: Date) => {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  };

  const getISOYear = (date: Date) => {
    const target = new Date(date.valueOf());
    target.setDate(target.getDate() + 3 - (target.getDay() + 6) % 7);
    return target.getFullYear();
  };

  const getChallengeIcon = (challengeType: string) => {
    switch (challengeType) {
      case 'daily_post_look':
      case 'weekly_post_3_looks':
        return <ImageIcon size={32} color="#F71D0C" />;
      case 'daily_create_duel':
      case 'weekly_create_3_duels':
        return <Swords size={32} color="#F71D0C" />;
      case 'daily_like_look':
      case 'weekly_like_10_looks':
        return <ThumbsUp size={32} color="#F71D0C" />;
      default:
        return <Heart size={32} color="#F71D0C" />;
    }
  };

  const renderChallenge = (challenge: UserChallenge | DailyChallenge, isDone: boolean = false) => {
    const progress = Math.min(challenge.current_count, challenge.target_count);
    const percentage = (progress / challenge.target_count) * 100;

    return (
      <View key={challenge.id} style={[styles.challengeCard, isDone && styles.challengeCardCompleted]}>
        <View style={styles.challengeIconContainer}>
          {getChallengeIcon(challenge.challenge_type)}
        </View>
        <View style={styles.challengeInfo}>
          <Text style={[styles.challengeTitle, isDone && styles.challengeTitleCompleted]}>
            {getChallengeTitle(challenge)}
          </Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${percentage}%` }]} />
            </View>
            <Text style={[styles.progressText, isDone && styles.progressTextCompleted]}>
              {progress}/{challenge.target_count}
            </Text>
          </View>
          <Text style={[styles.xpText, isDone && styles.xpTextCompleted]}>+{challenge.xp_reward} XP</Text>
        </View>
      </View>
    );
  };

  const getChallengeTitle = (challenge: UserChallenge | DailyChallenge) => {
    const type = challenge.challenge_type;
    switch (type) {
      case 'daily_post_look':
        return 'Poste une tenue';
      case 'daily_create_duel':
        return 'Défie un joueur';
      case 'daily_like_look':
        return 'Like une tenue';
      case 'weekly_post_3_looks':
        return 'Poste 3 tenues';
      case 'weekly_create_3_duels':
        return 'Défie 3 joueurs';
      case 'weekly_like_10_looks':
        return 'Like 10 tenues';
      default:
        return 'Défi';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/bg_defis2.png')}
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
        <Text style={styles.title}>DEFIS</Text>
        <View style={styles.weekContainer}>
          <Text style={styles.weekText}>Semaine {getISOWeek(new Date())}</Text>
        </View>
      </View>
      <View style={styles.headerSeparator} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.challengesList}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>DEFIS JOURNALIERS</Text>
            {dailyChallenges.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucun défi journalier</Text>
              </View>
            ) : (
              dailyChallenges.map(challenge => renderChallenge(challenge, challenge.completed))
            )}
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>DEFIS HEBDOMADAIRES</Text>
            {weeklyChallenges.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucun défi hebdomadaire</Text>
              </View>
            ) : (
              weeklyChallenges.map(challenge => renderChallenge(challenge, challenge.completed))
            )}
          </View>
        </View>
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
    opacity: 0.4,
  },
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
    marginBottom: 32,
    zIndex: 2,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  weekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e9dfc7',
  },
  loadingText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
  },
  content: {
    flex: 1,
  },
  challengesList: {
    padding: 20,
    paddingTop: 0,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
    marginBottom: 16,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    gap: 16,
  },
  challengeCardCompleted: {
    opacity: 0.6,
  },
  challengeIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
    marginBottom: 8,
  },
  challengeTitleCompleted: {
    textDecorationLine: 'line-through',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F71D0C',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#fff',
    minWidth: 50,
    textAlign: 'right',
  },
  progressTextCompleted: {
    color: '#4cd964',
  },
  xpText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#F71D0C',
    marginTop: 4,
  },
  xpTextCompleted: {
    color: '#4cd964',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
