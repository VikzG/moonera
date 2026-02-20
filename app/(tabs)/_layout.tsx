import { Tabs } from 'expo-router';
import { Home, PlusSquare, User, Trophy, Target, Swords, Users } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoIcon } from '@/components/LogoIcon';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.select({
    ios: 85,
    android: 80,
    default: 78,
  });

  const bottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 10),
    android: 10,
    default: 10,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#000',
          borderTopColor: '#1a1a1a',
          borderTopWidth: 1,
          height: tabBarHeight + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 16,
          elevation: 0,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter-SemiBold',
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: ({ size, color }) => <PlusSquare size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="duels"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: ({ size }) => <LogoIcon size={size} />,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: ({ size, color }) => <Target size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarLabel: '',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clans"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="top"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
