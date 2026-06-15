import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { GroupProvider } from '../context/GroupContext';
import {
  LayoutDashboard,
  LogOut,
  Zap,
  Moon,
  Sun
} from 'lucide-react';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    
    // Close on escape key
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isDropdownOpen]);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  const Header = () => (
    <div className="h-16 flex items-center justify-between px-6 bg-[#0d1424] lg:bg-transparent border-b border-[#00d4ff]/15 lg:border-none lg:justify-end sticky top-0 z-30 transition-colors duration-200">
      {/* Mobile Logo */}
      <div className="flex items-center gap-2 lg:hidden">
        <Zap className="w-5 h-5 text-[#00d4ff] fill-[#00d4ff]" />
        <span className="text-lg font-bold text-slate-100 tracking-wider">
          Split<span className="text-[#00d4ff]">Ledger</span>
        </span>
      </div>

      {/* Avatar & Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#00d4ff] text-white font-bold text-base shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#00d4ff]/50"
          aria-expanded={isDropdownOpen}
          aria-haspopup="true"
        >
          {userInitial}
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-3 w-64 glass-card rounded-xl overflow-hidden shadow-2xl animate-fade-in-up origin-top-right z-50">
            {/* User Info Header */}
            <div className="p-4 border-b border-[#00d4ff]/15 bg-black/10">
              <p className="text-sm font-bold truncate text-slate-100">{user?.name || 'User'}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email || ''}</p>
            </div>

            <div className="p-2 space-y-1">
              {/* Theme Toggle */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  toggleTheme();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-[#00d4ff]/10 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <span>Dark Mode</span>
                </div>
                {/* Toggle Switch UI */}
                <div className={`w-8 h-4 rounded-full transition-colors flex items-center px-0.5 ${isDark ? 'bg-[#00d4ff]' : 'bg-slate-600'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isDark ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <GroupProvider>
      <div className="min-h-screen flex flex-col lg:flex-row transition-colors duration-200">
        {/* Sidebar for Desktop */}
        <aside className="hidden lg:flex w-[260px] bg-[#0d1424] border-r border-[#00d4ff]/15 flex-col fixed inset-y-0 left-0 z-40 transition-colors duration-200">
          {/* Logo */}
          <div className="h-20 flex items-center gap-3 px-6 border-b border-[#00d4ff]/15">
            <Zap className="w-6 h-6 text-[#00d4ff] fill-[#00d4ff]" />
            <span className="text-xl font-bold tracking-wider text-slate-100">
              Split<span className="text-[#00d4ff]">Ledger</span>
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-sm font-semibold tracking-wide transition-all duration-200 rounded-lg group
                  ${
                    isActive
                      ? 'text-[#00d4ff] border-l-4 border-[#00d4ff] bg-[#00d4ff]/5 pl-3'
                      : 'text-slate-400 hover:text-[#00d4ff] hover:bg-[#00d4ff]/5 border-l-4 border-transparent hover:border-[#00d4ff]/30 pl-3'
                  }`
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Page Content area */}
        <div className="flex-1 flex flex-col min-w-0 lg:pl-[260px] pb-20 lg:pb-0">
          <Header />
          
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 lg:py-6">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Bottom Nav Bar for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0d1424] border-t border-[#00d4ff]/15 flex items-center justify-around z-30 px-4 shadow-lg transition-colors duration-200">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs font-semibold py-1 transition-all duration-200
                ${isActive ? 'text-[#00d4ff]' : 'text-slate-400 hover:text-[#00d4ff]'}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </GroupProvider>
  );
}
