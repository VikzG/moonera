import { useState, useEffect } from 'react';
import { LogoNav } from './LogoNav';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface LogoIconProps {
  size: number;
}

export function LogoIcon({ size }: LogoIconProps) {
  const { user } = useAuth();
  const [isMuneraMember, setIsMuneraMember] = useState(false);

  useEffect(() => {
    const checkClanMembership = async () => {
      if (!user) {
        setIsMuneraMember(false);
        return;
      }

      const { data, error } = await supabase
        .from('clan_members')
        .select('clans(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data && (data.clans as any)?.name === 'MUNERA') {
        setIsMuneraMember(true);
      } else {
        setIsMuneraMember(false);
      }
    };

    checkClanMembership();
  }, [user]);

  return <LogoNav size={size * (isMuneraMember ? 2.4 : 1.2)} color="#F71D0C" />;
}
