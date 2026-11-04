import React from 'react';
import { Language } from '../types';
import { ShoppingCart, Package, BookOpen, TrendingUp, Settings } from 'lucide-react';

export type NavTab = 'pos' | 'products' | 'baki' | 'reports' | 'settings';

interface Props {
  activeTab: string;
  onTabChange: (tab: NavTab) => void;
  language: Language;
  cartItemCount: number;
  lowStockCount: number;
}

export const Navigation: React.FC<Props> = ({
  activeTab,
  onTabChange,
  language,
  cartItemCount,
  lowStockCount,
}) => {
  const navItems = [
    {
      id: 'pos' as NavTab,
      label: language === 'bn' ? 'বিক্রি / POS' : 'POS',
      icon: ShoppingCart,
      badge: cartItemCount > 0 ? cartItemCount : null,
      badgeColor: 'bg-[#D32F2F] text-white',
    },
    {
      id: 'products' as NavTab,
      label: language === 'bn' ? 'পণ্য ও স্টক' : 'Products',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-[#D32F2F] text-white animate-pulse',
    },
    {
      id: 'baki' as NavTab,
      label: language === 'bn' ? 'বাকি খাতা' : 'Baki Khata',
      icon: BookOpen,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'reports' as NavTab,
      label: language === 'bn' ? 'দৈনিক লাভ ও হিসাব' : 'Reports',
      icon: TrendingUp,
      badge: null,
      badgeColor: '',
    },
    {
      id: 'settings' as NavTab,
      label: language === 'bn' ? 'সেটিংস' : 'Settings',
      icon: Settings,
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-sm select-none">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1 sm:py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'text-[#0E6B6B] font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              <div className="relative">
                <div
                  className={`px-3 sm:px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                    isActive
                      ? 'bg-[#E0F2F1] text-[#0E6B6B]'
                      : 'text-[#64748B]'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                {item.badge !== null && (
                  <span
                    className={`absolute -top-0.5 right-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] sm:text-xs mt-0.5 tracking-tight truncate max-w-[72px] ${
                isActive ? 'font-bold text-[#0E6B6B]' : 'font-medium text-[#64748B]'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
