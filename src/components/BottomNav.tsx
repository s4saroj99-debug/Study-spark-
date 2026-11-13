import React from 'react';
import { BookOpen, Search, Heart, History, Settings2 } from 'lucide-react';
import { NavTab } from '../types';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  favoritesCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  favoritesCount,
}) => {
  const tabs = [
    { id: 'batches' as NavTab, label: 'Batches', icon: BookOpen },
    { id: 'search' as NavTab, label: 'Search', icon: Search },
    {
      id: 'favorites' as NavTab,
      label: 'Favorites',
      icon: Heart,
      badge: favoritesCount > 0 ? favoritesCount : null,
    },
    { id: 'history' as NavTab, label: 'History', icon: History },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--card-border)] bg-[var(--bg-primary)]/90 backdrop-blur-lg sm:hidden pb-safe">
      <div className="flex h-16 items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-1 px-2.5 py-1 transition-all ${
                isActive
                  ? 'text-[var(--primary-color)] font-bold scale-105'
                  : 'text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-pink-500 px-1 text-[9px] font-bold text-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-[var(--primary-color)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
