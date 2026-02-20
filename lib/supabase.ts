import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  profile_image_url: string | null;
  total_likes: number;
  weekly_top_count: number;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface Look {
  id: string;
  user_id: string;
  image_url: string;
  image_urls: string[];
  video_url: string | null;
  category: string;
  likes_count: number;
  is_weekly_top: boolean;
  week_number: number | null;
  year: number | null;
  is_duel_entry: boolean;
  duel_wins: number;
  duel_losses: number;
  ai_analysis: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface Like {
  id: string;
  user_id: string;
  look_id: string;
  created_at: string;
}

export interface Badge {
  id: string;
  user_id: string;
  badge_type: 'rising_star' | 'elite_style' | 'legend' | 'rookie';
  achieved_at: string;
  metadata: Record<string, any>;
}

export interface Challenge {
  id: string;
  challenge_type: string;
  title: string;
  description: string;
  target_count: number;
  xp_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_type: string;
  week_number: number;
  year: number;
  current_count: number;
  target_count: number;
  xp_reward: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface DailyChallenge {
  id: string;
  user_id: string;
  challenge_type: string;
  day_date: string;
  current_count: number;
  target_count: number;
  xp_reward: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'like' | 'badge_earned' | 'top_100' | 'level_up';
  title: string;
  message: string;
  read: boolean;
  related_user_id: string | null;
  related_look_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Clan {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  leader_id: string;
  member_count: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface ClanMember {
  id: string;
  clan_id: string;
  user_id: string;
  joined_at: string;
  profiles?: Profile;
  clans?: Clan;
}

export interface ClanInvitation {
  id: string;
  clan_id: string;
  inviter_id: string;
  invited_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  profiles?: Profile;
  clans?: Clan;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}
