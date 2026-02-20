import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { UserPlus, UserCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface FollowButtonProps {
  targetUserId: string;
  size?: 'small' | 'medium';
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({ targetUserId, size = 'medium', onFollowChange }: FollowButtonProps) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const isOwn = user?.id === targetUserId;

  useEffect(() => {
    if (user && !isOwn) {
      checkFollowStatus();
    } else {
      setLoading(false);
    }
  }, [user, targetUserId]);

  const checkFollowStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!user || isOwn || toggling) return;
    setToggling(true);

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);

        if (error) throw error;
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: targetUserId });

        if (error) throw error;
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setToggling(false);
    }
  };

  if (!user || isOwn || loading) return null;

  const isSmall = size === 'small';
  const iconSize = isSmall ? 13 : 15;

  return (
    <TouchableOpacity
      onPress={handleToggle}
      disabled={toggling}
      activeOpacity={0.7}
      style={[
        styles.button,
        isSmall && styles.buttonSmall,
        isFollowing && styles.buttonFollowing,
        isFollowing && isSmall && styles.buttonFollowingSmall,
      ]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      {toggling ? (
        <ActivityIndicator size="small" color={isFollowing ? '#fff' : '#000'} />
      ) : (
        <>
          {isFollowing ? (
            <UserCheck size={iconSize} color="#fff" />
          ) : (
            <UserPlus size={iconSize} color="#000" />
          )}
          {!isSmall && (
            <Text style={[styles.text, isFollowing && styles.textFollowing]}>
              {isFollowing ? 'Suivi' : 'Suivre'}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
  },
  buttonSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 36,
    gap: 0,
  },
  buttonFollowing: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonFollowingSmall: {
    borderColor: '#555',
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#000',
  },
  textFollowing: {
    color: '#fff',
  },
});
