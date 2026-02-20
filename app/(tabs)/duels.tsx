import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  ImageBackground,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Look } from '@/lib/supabase';
import { Swords, X, Clock, Check, Search, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LogoNav } from '@/components/LogoNav';
import { LinearGradient } from 'expo-linear-gradient';

const TAB_BAR_HEIGHT = 88;

const CATEGORIES = [
  'Streetwear',
  'Chic',
  'Casual',
  'Vintage',
  'Sport',
  'Business',
  'Soiree',
  'Minimaliste',
];

interface FeedDuel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  challenger_votes: number;
  challenged_votes: number;
  total_votes: number;
  category: string | null;
  challengerImage: string;
  challengedImage: string;
  challengerUsername: string;
  challengedUsername: string;
  challengerAvatar: string | null;
  challengedAvatar: string | null;
  challengerClan: string | null;
  challengedClan: string | null;
  hasVoted: boolean;
}

interface Player {
  user_id: string;
  username: string;
  level: number;
  xp: number;
  profile_image_url: string | null;
}

interface MyDuel {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  category: string | null;
  challenger_look_id: string | null;
  challenged_look_id: string | null;
  challenger_deadline: string | null;
  challenged_deadline: string | null;
  opponent_username: string;
  opponent_avatar: string | null;
  opponent_level: number;
}

type TabType = 'feed' | 'challenge';

export default function DuelsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [feedDuels, setFeedDuels] = useState<FeedDuel[]>([]);
  const [myDuels, setMyDuels] = useState<MyDuel[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLookSelector, setShowLookSelector] = useState(false);
  const [selectedDuelId, setSelectedDuelId] = useState<string | null>(null);
  const [myLooks, setMyLooks] = useState<Look[]>([]);
  const [voteAnim, setVoteAnim] = useState<{ [key: string]: string }>({});
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [pendingChallengePlayerId, setPendingChallengePlayerId] = useState<string | null>(null);

  const lastTapRef = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    if (activeTab === 'feed') {
      loadFeed();
    } else {
      loadChallengeTab();
    }
  }, [activeTab]);

  const loadFeed = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: duels } = await supabase
        .from('duels')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!duels || duels.length === 0) {
        setFeedDuels([]);
        setLoading(false);
        return;
      }

      const duelIds = duels.map(d => d.id);
      const { data: votes } = await supabase
        .from('duel_votes')
        .select('duel_id')
        .eq('user_id', user.id)
        .in('duel_id', duelIds);
      const votedIds = new Set(votes?.map(v => v.duel_id) || []);

      const lookIds = new Set<string>();
      const userIds = new Set<string>();
      duels.forEach(d => {
        if (d.challenger_look_id) lookIds.add(d.challenger_look_id);
        if (d.challenged_look_id) lookIds.add(d.challenged_look_id);
        userIds.add(d.challenger_id);
        userIds.add(d.challenged_id);
      });

      let looksMap = new Map<string, string>();
      if (lookIds.size > 0) {
        const { data: looks } = await supabase
          .from('looks')
          .select('id, image_url, image_urls')
          .in('id', Array.from(lookIds));
        looks?.forEach((l: any) => {
          looksMap.set(l.id, l.image_urls?.[0] || l.image_url);
        });
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, profile_image_url')
        .in('id', Array.from(userIds));
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const { data: clanData } = await supabase
        .from('clan_members')
        .select('user_id, clans(name)')
        .in('user_id', Array.from(userIds));
      const clanMap = new Map<string, string>();
      clanData?.forEach((cm: any) => {
        if (cm.clans?.name) clanMap.set(cm.user_id, cm.clans.name);
      });

      const enriched: FeedDuel[] = duels
        .filter(d => d.challenger_look_id && d.challenged_look_id)
        .map(d => ({
          id: d.id,
          challenger_id: d.challenger_id,
          challenged_id: d.challenged_id,
          challenger_votes: d.challenger_votes,
          challenged_votes: d.challenged_votes,
          total_votes: d.total_votes,
          category: d.category || null,
          challengerImage: looksMap.get(d.challenger_look_id) || '',
          challengedImage: looksMap.get(d.challenged_look_id) || '',
          challengerUsername: profilesMap.get(d.challenger_id)?.username || '',
          challengedUsername: profilesMap.get(d.challenged_id)?.username || '',
          challengerAvatar: profilesMap.get(d.challenger_id)?.profile_image_url || null,
          challengedAvatar: profilesMap.get(d.challenged_id)?.profile_image_url || null,
          challengerClan: clanMap.get(d.challenger_id) || null,
          challengedClan: clanMap.get(d.challenged_id) || null,
          hasVoted: votedIds.has(d.id),
        }))
        .filter(d => d.challengerImage && d.challengedImage);

      setFeedDuels(enriched);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChallengeTab = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [duelsResult, playersResult] = await Promise.all([
        supabase
          .from('duels')
          .select('*')
          .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
          .in('status', ['pending', 'accepted', 'active'])
          .order('created_at', { ascending: false }),
        supabase.rpc('find_similar_level_players', {
          p_user_id: user.id,
          p_limit: 20,
        }),
      ]);

      setPlayers(playersResult.data || []);

      const duelsData = duelsResult.data || [];
      if (duelsData.length === 0) {
        setMyDuels([]);
        setLoading(false);
        return;
      }

      const opponentIds = new Set<string>();
      duelsData.forEach(d => {
        opponentIds.add(d.challenger_id === user.id ? d.challenged_id : d.challenger_id);
      });

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, profile_image_url, level')
        .in('id', Array.from(opponentIds));
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const enrichedDuels: MyDuel[] = duelsData.map(d => {
        const isChallenger = d.challenger_id === user.id;
        const opponentId = isChallenger ? d.challenged_id : d.challenger_id;
        const opp = profilesMap.get(opponentId);
        return {
          id: d.id,
          challenger_id: d.challenger_id,
          challenged_id: d.challenged_id,
          status: d.status,
          category: d.category || null,
          challenger_look_id: d.challenger_look_id,
          challenged_look_id: d.challenged_look_id,
          challenger_deadline: d.challenger_deadline,
          challenged_deadline: d.challenged_deadline,
          opponent_username: opp?.username || '',
          opponent_avatar: opp?.profile_image_url || null,
          opponent_level: opp?.level || 1,
        };
      });

      setMyDuels(enrichedDuels);
    } catch (error) {
      console.error('Error loading challenge tab:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTap = (duelId: string, side: 'challenger' | 'challenged') => {
    const key = `${duelId}-${side}`;
    const now = Date.now();
    const last = lastTapRef.current[key] || 0;

    if (now - last < 350) {
      voteFeedDuel(duelId, side);
      delete lastTapRef.current[key];
    } else {
      lastTapRef.current[key] = now;
    }
  };

  const voteFeedDuel = async (duelId: string, votedFor: 'challenger' | 'challenged') => {
    if (!user) return;

    setVoteAnim(prev => ({ ...prev, [duelId]: votedFor }));
    setTimeout(() => {
      setVoteAnim(prev => {
        const next = { ...prev };
        delete next[duelId];
        return next;
      });
    }, 800);

    try {
      const { error } = await supabase.from('duel_votes').insert({
        duel_id: duelId,
        user_id: user.id,
        voted_for: votedFor,
      });

      if (error) {
        if (error.message?.includes('duplicate')) return;
        throw error;
      }

      setFeedDuels(prev =>
        prev.map(d => {
          if (d.id !== duelId) return d;
          return {
            ...d,
            hasVoted: true,
            challenger_votes: d.challenger_votes + (votedFor === 'challenger' ? 1 : 0),
            challenged_votes: d.challenged_votes + (votedFor === 'challenged' ? 1 : 0),
            total_votes: d.total_votes + 1,
          };
        }),
      );
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const openCategoryPicker = (playerId: string) => {
    setPendingChallengePlayerId(playerId);
    setShowCategoryPicker(true);
  };

  const challengePlayer = async (category: string) => {
    if (!user || !pendingChallengePlayerId) return;
    setShowCategoryPicker(false);
    try {
      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        challenged_id: pendingChallengePlayerId,
        status: 'pending',
        category,
      });
      if (error) throw error;
      setPendingChallengePlayerId(null);
      Alert.alert('Succes', 'Defi envoye !');
      await loadChallengeTab();
    } catch (error) {
      console.error('Error creating challenge:', error);
    }
  };

  const acceptChallenge = async (duelId: string) => {
    if (!user) return;
    try {
      const now = new Date();
      const deadline = new Date(now.getTime() + 60 * 60 * 1000);
      const { error } = await supabase
        .from('duels')
        .update({
          status: 'accepted',
          accepted_at: now.toISOString(),
          challenger_deadline: deadline.toISOString(),
          challenged_deadline: deadline.toISOString(),
        })
        .eq('id', duelId);
      if (error) throw error;
      await loadChallengeTab();
    } catch (error) {
      console.error('Error accepting challenge:', error);
    }
  };

  const declineChallenge = async (duelId: string) => {
    try {
      const { error } = await supabase
        .from('duels')
        .update({ status: 'declined' })
        .eq('id', duelId);
      if (error) throw error;
      await loadChallengeTab();
    } catch (error) {
      console.error('Error declining challenge:', error);
    }
  };

  const openLookSelector = async (duelId: string) => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('looks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setMyLooks(data || []);
      setSelectedDuelId(duelId);
      setShowLookSelector(true);
    } catch (error) {
      console.error('Error loading looks:', error);
    }
  };

  const selectLookForDuel = async (lookId: string) => {
    if (!user || !selectedDuelId) return;
    try {
      const { data: duelInfo } = await supabase
        .from('duels')
        .select('challenger_id')
        .eq('id', selectedDuelId)
        .single();

      const isChallenger = duelInfo?.challenger_id === user.id;
      const field = isChallenger ? 'challenger_look_id' : 'challenged_look_id';

      const { error } = await supabase
        .from('duels')
        .update({ [field]: lookId })
        .eq('id', selectedDuelId);
      if (error) throw error;

      const { data: duelData } = await supabase
        .from('duels')
        .select('challenger_look_id, challenged_look_id')
        .eq('id', selectedDuelId)
        .single();

      if (duelData?.challenger_look_id && duelData?.challenged_look_id) {
        await supabase
          .from('duels')
          .update({ status: 'active' })
          .eq('id', selectedDuelId);
      }

      setShowLookSelector(false);
      await loadChallengeTab();
    } catch (error) {
      console.error('Error selecting look:', error);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return 'Expire';
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}min`;
    return `${Math.floor(m / 60)}h ${m % 60}min`;
  };

  const itemHeight = contentHeight > 0 ? contentHeight - TAB_BAR_HEIGHT : 0;

  const renderFeedItem = ({ item }: { item: FeedDuel }) => {
    const isParticipant = item.challenger_id === user?.id || item.challenged_id === user?.id;
    const showPct = item.hasVoted || isParticipant;
    const canVote = !item.hasVoted && !isParticipant;
    const cPct = item.total_votes > 0 ? Math.round((item.challenger_votes / item.total_votes) * 100) : 0;
    const dPct = item.total_votes > 0 ? Math.round((item.challenged_votes / item.total_votes) * 100) : 0;
    const animSide = voteAnim[item.id];

    return (
      <View style={[styles.feedItem, { height: itemHeight }]}>
        <TouchableOpacity
          style={styles.feedHalf}
          activeOpacity={canVote ? 0.85 : 1}
          onPress={() => canVote && handleTap(item.id, 'challenger')}
        >
          <Image source={{ uri: item.challengerImage }} style={styles.feedFullImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']}
            locations={[0, 0.4, 1]}
            style={StyleSheet.absoluteFill}
          />
          {showPct && (
            <View style={styles.feedPctWrap}>
              <Text style={styles.feedPctText}>{cPct}%</Text>
            </View>
          )}
          {animSide === 'challenger' && (
            <View style={styles.feedVoteFlash}>
              <Heart size={48} color="#F71D0C" fill="#F71D0C" />
            </View>
          )}
          <View style={styles.feedUserBL}>
            <View style={styles.feedUserRow}>
              <View>
                <Text style={styles.feedUserName}>@{item.challengerUsername}</Text>
                {item.challengerClan && <Text style={styles.feedClanName}>{item.challengerClan}</Text>}
              </View>
              {item.challengerAvatar && (
                <Image source={{ uri: item.challengerAvatar }} style={styles.feedSmallAvatar} />
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.feedHalf}
          activeOpacity={canVote ? 0.85 : 1}
          onPress={() => canVote && handleTap(item.id, 'challenged')}
        >
          <Image source={{ uri: item.challengedImage }} style={styles.feedFullImage} />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.feedUserTR}>
            <View style={styles.feedUserRowR}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.feedUserName}>@{item.challengedUsername}</Text>
                {item.challengedClan && <Text style={styles.feedClanName}>{item.challengedClan}</Text>}
              </View>
              {item.challengedAvatar && (
                <Image source={{ uri: item.challengedAvatar }} style={styles.feedSmallAvatar} />
              )}
            </View>
          </View>
          {showPct && (
            <View style={styles.feedPctWrap}>
              <Text style={styles.feedPctText}>{dPct}%</Text>
            </View>
          )}
          {animSide === 'challenged' && (
            <View style={styles.feedVoteFlash}>
              <Heart size={48} color="#F71D0C" fill="#F71D0C" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.feedLogoCenter} pointerEvents="none">
          <LogoNav size={36} color="#F71D0C" />
        </View>

        {item.category && (
          <View style={styles.feedCategoryWrap} pointerEvents="none">
            <View style={styles.feedCategoryBadge}>
              <Text style={styles.feedCategoryText}>{item.category}</Text>
            </View>
          </View>
        )}

        {canVote && (
          <View style={styles.feedHint} pointerEvents="none">
            <Text style={styles.feedHintText}>Double-tapez pour voter</Text>
          </View>
        )}
      </View>
    );
  };

  const filteredPlayers = searchQuery
    ? players.filter(p => p.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : players;

  const renderPlayer = ({ item }: { item: Player }) => (
    <TouchableOpacity
      style={styles.playerCard}
      onPress={() => router.push(`/user/${item.user_id}`)}
      activeOpacity={0.9}
    >
      {item.profile_image_url ? (
        <Image source={{ uri: item.profile_image_url }} style={styles.playerImg} />
      ) : (
        <View style={styles.playerImgPH}>
          <Text style={styles.playerInitial}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.playerOverlay}>
        <View style={styles.playerInfoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.playerName}>@{item.username}</Text>
            <Text style={styles.playerLvl}>Niv. {item.level}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.challengeBtn} onPress={() => openCategoryPicker(item.user_id)}>
        <Swords size={14} color="#fff" />
        <Text style={styles.challengeBtnTxt}>Defier</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderMyDuelItem = (duel: MyDuel) => {
    const isChallenger = duel.challenger_id === user?.id;
    const isPending = duel.status === 'pending';
    const isAccepted = duel.status === 'accepted';
    const isActive = duel.status === 'active';
    const needsLook = isAccepted && (
      (isChallenger && !duel.challenger_look_id) ||
      (!isChallenger && !duel.challenged_look_id)
    );
    const deadline = isChallenger ? duel.challenger_deadline : duel.challenged_deadline;

    return (
      <View style={styles.myDuelCard} key={duel.id}>
        <View style={styles.myDuelRow}>
          {duel.opponent_avatar ? (
            <Image source={{ uri: duel.opponent_avatar }} style={styles.myDuelAvatar} />
          ) : (
            <View style={styles.myDuelAvatarPH}>
              <Text style={styles.myDuelAvatarTxt}>{duel.opponent_username.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.myDuelInfo}>
            <Text style={styles.myDuelName} numberOfLines={1}>
              @{duel.opponent_username}
            </Text>
            {duel.category && (
              <View style={styles.myDuelCategoryRow}>
                <View style={styles.myDuelCategoryBadge}>
                  <Text style={styles.myDuelCategoryTxt}>{duel.category}</Text>
                </View>
              </View>
            )}
            <Text style={styles.myDuelStatus}>
              {isPending && isChallenger && 'En attente'}
              {isPending && !isChallenger && 'Defi recu'}
              {isAccepted && (needsLook ? 'Choisir une tenue' : 'En preparation')}
              {isActive && 'Actif'}
            </Text>
          </View>
          <View style={styles.myDuelActions}>
            {isPending && !isChallenger && (
              <View style={styles.myDuelBtns}>
                <TouchableOpacity style={styles.myAcceptBtn} onPress={() => acceptChallenge(duel.id)}>
                  <Check size={14} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.myDeclineBtn} onPress={() => declineChallenge(duel.id)}>
                  <X size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            {needsLook && (
              <TouchableOpacity style={styles.mySelectLookBtn} onPress={() => openLookSelector(duel.id)}>
                <Text style={styles.mySelectLookTxt}>Choisir</Text>
              </TouchableOpacity>
            )}
            {isActive && (
              <TouchableOpacity style={styles.myViewBtn} onPress={() => router.push(`/duel/${duel.id}`)}>
                <Text style={styles.myViewTxt}>Voir</Text>
              </TouchableOpacity>
            )}
            {isPending && isChallenger && (
              <Clock size={16} color="#555" />
            )}
          </View>
        </View>
        {needsLook && deadline && (
          <View style={styles.myDeadline}>
            <Clock size={12} color="#F71D0C" />
            <Text style={styles.myDeadlineTxt}>{getTimeRemaining(deadline)}</Text>
          </View>
        )}
      </View>
    );
  };

  const challengeTabHeader = () => (
    <View>
      <View style={styles.searchContainer}>
        <Search size={18} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Trouver un Utilisateur"
          placeholderTextColor="#555"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {myDuels.length > 0 && (
        <View style={styles.myDuelsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mes Duels</Text>
            <View style={styles.sectionLine} />
          </View>
          {myDuels.map(renderMyDuelItem)}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Joueurs</Text>
        <View style={styles.sectionLine} />
      </View>
    </View>
  );

  return (
    <ImageBackground
      source={require('@/assets/images/munera_bg.png')}
      style={styles.container}
      resizeMode="cover"
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.backgroundFilter} />
      <View style={styles.header}>
        <Text style={styles.title}>MUNERA</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.tabActive]}
          onPress={() => setActiveTab('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.tabTextActive]}>PARCOURIR</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenge' && styles.tabActive]}
          onPress={() => setActiveTab('challenge')}
        >
          <Text style={[styles.tabText, activeTab === 'challenge' && styles.tabTextActive]}>DEFIER</Text>
        </TouchableOpacity>
      </View>

      <View
        style={styles.content}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : activeTab === 'feed' ? (
          itemHeight > 0 ? (
            <FlatList
              key="feed-list"
              data={feedDuels}
              renderItem={renderFeedItem}
              keyExtractor={(item) => item.id}
              snapToInterval={itemHeight}
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => ({
                length: itemHeight,
                offset: itemHeight * index,
                index,
              })}
              contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}
              ListEmptyComponent={
                <View style={[styles.emptyFeed, { height: itemHeight }]}>
                  <Text style={styles.emptyTitle}>Aucun duel en cours</Text>
                  <Text style={styles.emptySub}>Defiez un joueur pour commencer !</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab('challenge')}>
                    <Text style={styles.emptyBtnTxt}>Defier un joueur</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          ) : null
        ) : (
          <FlatList
            key="players-grid"
            data={filteredPlayers}
            renderItem={renderPlayer}
            keyExtractor={(item) => item.user_id}
            numColumns={2}
            columnWrapperStyle={styles.playerColumns}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={challengeTabHeader}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Aucun joueur trouve</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={showCategoryPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.catPickerContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une categorie</Text>
              <TouchableOpacity onPress={() => { setShowCategoryPicker(false); setPendingChallengePlayerId(null); }}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.catPickerSubtitle}>
              Les votants jugeront si la categorie a ete respectee
            </Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.catItem}
                  onPress={() => challengePlayer(cat)}
                >
                  <Text style={styles.catItemText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showLookSelector} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une tenue</Text>
              <TouchableOpacity onPress={() => setShowLookSelector(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {myLooks.map((look) => (
                <TouchableOpacity
                  key={look.id}
                  style={styles.lookItem}
                  onPress={() => selectLookForDuel(look.id)}
                >
                  <Image source={{ uri: look.image_urls?.[0] || look.image_url }} style={styles.lookThumb} />
                  <View style={styles.lookItemInfo}>
                    <Text style={styles.lookCategory}>{look.category}</Text>
                    <Text style={styles.lookLikes}>{look.likes_count} likes</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.createNewBtn}
                onPress={() => {
                  setShowLookSelector(false);
                  router.push('/(tabs)/upload');
                }}
              >
                <Text style={styles.createNewText}>+ Creer une nouvelle tenue</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: {
    ...(Platform.OS === 'web' ? { filter: 'grayscale(100%) brightness(0.4)' } as any : { opacity: 0.25 }),
  },
  backgroundFilter: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS !== 'web' ? { backgroundColor: 'rgba(0, 0, 0, 0.65)' } : {}),
  },
  header: { paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20 },
  title: { fontSize: 32, fontFamily: 'Poppins-Regular', color: '#fff' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#F71D0C' },
  tabText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#555', letterSpacing: 0.5 },
  tabTextActive: { color: '#F71D0C' },
  content: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  feedItem: { position: 'relative' },
  feedHalf: { flex: 1, overflow: 'hidden' },
  feedFullImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  feedPctWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedPctText: {
    fontSize: 56,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  feedVoteFlash: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedUserBL: { position: 'absolute', bottom: 16, left: 14 },
  feedUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedUserTR: { position: 'absolute', top: 16, right: 14 },
  feedUserRowR: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedUserName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  feedClanName: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    marginTop: 2,
  },
  feedSmallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  feedLogoCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  feedHint: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  feedHintText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },

  emptyFeed: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#444' },
  emptySub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#555' },
  emptyBtn: {
    backgroundColor: '#F71D0C',
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 0,
    marginTop: 8,
    width: '60%',
    alignItems: 'center',
  },
  emptyBtnTxt: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#fff' },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#fff', padding: 0 },

  myDuelsSection: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#fff' },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#333' },

  myDuelCard: {
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
  },
  myDuelRow: { flexDirection: 'row', alignItems: 'center' },
  myDuelAvatar: { width: 40, height: 40, borderRadius: 20 },
  myDuelAvatarPH: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myDuelAvatarTxt: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#555' },
  myDuelInfo: { flex: 1, marginLeft: 12 },
  myDuelName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#fff' },
  myDuelStatus: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#666', marginTop: 3 },
  myDuelActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  myDuelBtns: { flexDirection: 'row', gap: 6 },
  myAcceptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a6b1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myDeclineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6b1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mySelectLookBtn: {
    backgroundColor: '#F71D0C',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  mySelectLookTxt: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#fff' },
  myViewBtn: {
    backgroundColor: '#222',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  myViewTxt: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#fff' },
  myDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(247,29,12,0.08)',
    padding: 8,
    borderRadius: 8,
  },
  myDeadlineTxt: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#F71D0C' },

  listContent: { padding: 8, paddingBottom: TAB_BAR_HEIGHT + 16 },
  playerColumns: { gap: 8 },
  playerCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 8,
  },
  playerImg: { width: '100%', aspectRatio: 3 / 4, resizeMode: 'cover' },
  playerImgPH: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInitial: { fontSize: 32, fontFamily: 'Inter-Bold', color: '#333' },
  playerOverlay: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  playerInfoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  playerName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#fff' },
  playerLvl: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#aaa', marginTop: 2 },
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F71D0C',
    paddingVertical: 10,
  },
  challengeBtnTxt: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#fff' },

  myDuelCategoryRow: { flexDirection: 'row', marginTop: 3 },
  myDuelCategoryBadge: {
    backgroundColor: 'rgba(247,29,12,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myDuelCategoryTxt: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#F71D0C' },

  feedCategoryWrap: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 12,
  },
  feedCategoryBadge: {
    backgroundColor: 'rgba(247,29,12,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
  },
  feedCategoryText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  catPickerContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#1a1a1a',
    paddingBottom: 40,
  },
  catPickerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#666',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  catItem: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: '45%',
    alignItems: 'center',
    flexGrow: 1,
  },
  catItemText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#fff' },

  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#555' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#fff' },
  modalScroll: { padding: 16 },
  lookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  lookThumb: { width: 56, height: 74, borderRadius: 8 },
  lookItemInfo: { flex: 1, marginLeft: 12 },
  lookCategory: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#fff' },
  lookLikes: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#666', marginTop: 4 },
  createNewBtn: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#222',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  createNewText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#fff' },
});
