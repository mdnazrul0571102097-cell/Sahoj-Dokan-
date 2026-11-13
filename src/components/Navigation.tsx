import React from 'react';
import { Language } from '../types';
import { Home, LayoutGrid, Settings } from 'lucide-react';

export type NavTab = 'pos' | 'menu' | 'settings';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  language: Language;
  cartItemCount: number;
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  onTabChange,
  language,
  cartItemCount,
}) => {
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: number | null;
  }[] = [
    {
      id: 'pos',
      label: language === 'bn' ? 'হোম / বিক্রি' : 'Home / POS',
      icon: Home,
      badge: cartItemCount > 0 ? cartItemCount : null,
    },
    {
      id: 'menu',
      label: language === 'bn' ? 'হিসাব / মেনু' : 'Menu',
      icon: LayoutGrid,
      badge: null,
    },
    {
      id: 'settings',
      label: language === 'bn' ? 'সেটিংস' : 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-2xs select-none">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1 sm:py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-2 transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'text-[#0E6B6B] font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <div className="relative">
                <div
                  className={`px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                    isActive
                      ? 'bg-[#E0F2F1] text-[#0E6B6B]'
                      : 'text-[#64748B]'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.3]" />
                </div>
                {item.badge !== null && (
                  <span className="absolute -top-0.5 right-0.5 px-1.5 py-0 rounded-full text-[10px] font-extrabold leading-tight bg-[#D32F2F] text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] sm:text-xs leading-tight mt-0.5 tracking-tight whitespace-nowrap ${
                  isActive ? 'font-extrabold text-[#0E6B6B]' : 'font-semibold text-[#64748B]'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
