import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Home, Wallet, Users, Bell, Settings, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors, Spacing } from '../constants/theme';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store';

const NavItem = ({
  label,
  icon: Icon,
  isActive,
  onPress,
  isCollapsed,
}: {
  label: string;
  icon: React.ComponentType<any>;
  isActive: boolean;
  onPress: () => void;
  isCollapsed?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.navItem, isActive && styles.navItemActive, isCollapsed && styles.navItemCollapsed]}
    onPress={onPress}
  >
    <Icon
      size={20}
      color={isActive ? Colors.primary : Colors.textSecondary}
      strokeWidth={isActive ? 2.5 : 2}
    />
    {!isCollapsed && (
      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
    )}
  </TouchableOpacity>
);

export const Sidebar: React.FC<DrawerContentComponentProps> = (props) => {
  const currentRouteName = props.state.routeNames[props.state.index];
  const { isSidebarCollapsed, toggleSidebar } = useUIStore();
  const user = useAuthStore((s) => s.user);

  const navigateTo = (screen: string) => {
    props.navigation.navigate(screen);
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={[styles.logoContainer, isSidebarCollapsed && styles.logoContainerCollapsed]}>
        {!isSidebarCollapsed && (
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>C</Text>
            </View>
            <Text style={styles.logoText}>
              Chingi<Text style={{ fontWeight: '400' }}>Ringi</Text>
            </Text>
          </View>
        )}
        {isSidebarCollapsed && (
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>C</Text>
          </View>
        )}
        <TouchableOpacity style={styles.collapseBtn} onPress={toggleSidebar}>
          {isSidebarCollapsed ? (
            <ChevronRight size={16} color={Colors.textSecondary} />
          ) : (
            <ChevronLeft size={16} color={Colors.textSecondary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Main Navigation */}
      <View style={styles.mainNav}>
        <NavItem
          label="Discover"
          icon={Home}
          isActive={currentRouteName === 'Home'}
          onPress={() => navigateTo('Home')}
          isCollapsed={isSidebarCollapsed}
        />
        <NavItem
          label="Wallet"
          icon={Wallet}
          isActive={currentRouteName === 'Wallet'}
          onPress={() => navigateTo('Wallet')}
          isCollapsed={isSidebarCollapsed}
        />
        <NavItem
          label="Referrals"
          icon={Users}
          isActive={currentRouteName === 'Referrals'}
          onPress={() => navigateTo('Referrals')}
          isCollapsed={isSidebarCollapsed}
        />
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <NavItem
          label="Notifications"
          icon={Bell}
          isActive={currentRouteName === 'Notifications'}
          onPress={() => navigateTo('Notifications')}
          isCollapsed={isSidebarCollapsed}
        />
        <NavItem
          label="Settings"
          icon={Settings}
          isActive={currentRouteName === 'Settings'}
          onPress={() => navigateTo('Settings')}
          isCollapsed={isSidebarCollapsed}
        />

        {/* Profile Section */}
        <TouchableOpacity
          style={[styles.profileSection, isSidebarCollapsed && styles.profileSectionCollapsed]}
          onPress={() => navigateTo('Profile')}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {(user?.name || 'D')[0].toUpperCase()}
              </Text>
            </View>
          </View>
          {!isSidebarCollapsed && (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {user?.name || 'Dev Chavan'}
              </Text>
              <Text style={styles.profileBalance}>₹1250</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  logoContainerCollapsed: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    gap: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primary,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainNav: {
    flex: 1,
    marginTop: 8,
  },
  bottomNav: {},
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 12,
    paddingHorizontal: 8,
    gap: 10,
  },
  profileSectionCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  avatarContainer: {},
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  profileBalance: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
