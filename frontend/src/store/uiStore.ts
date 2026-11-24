import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  darkMode: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
}

// Helper to determine initial dark mode state
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const savedTheme = localStorage.getItem('mv_theme');
  if (savedTheme === 'dark') return true;
  if (savedTheme === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// Sync HTML element with dark class
const applyDarkModeClass = (isDark: boolean) => {
  if (typeof document !== 'undefined') {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

const initialDarkMode = getInitialDarkMode();
applyDarkModeClass(initialDarkMode);

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  darkMode: initialDarkMode,
  isMobile: typeof window !== 'undefined' ? window.innerWidth < 1024 : false,

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  toggleDarkMode: () => {
    set((state) => {
      const newDarkMode = !state.darkMode;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mv_theme', newDarkMode ? 'dark' : 'light');
      }
      applyDarkModeClass(newDarkMode);
      return { darkMode: newDarkMode };
    });
  },

  setDarkMode: (dark: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mv_theme', dark ? 'dark' : 'light');
    }
    applyDarkModeClass(dark);
    set({ darkMode: dark });
  },

  setIsMobile: (isMobile: boolean) => {
    set({ isMobile });
  },
}));

// Setup window resize listener if in browser environment
if (typeof window !== 'undefined') {
  const handleResize = () => {
    const isMobile = window.innerWidth < 1024;
    useUIStore.getState().setIsMobile(isMobile);
    if (!isMobile && useUIStore.getState().sidebarOpen) {
      // Auto close mobile overlay drawer when resizing to desktop
      useUIStore.getState().setSidebarOpen(false);
    }
  };

  window.addEventListener('resize', handleResize);
}

export default useUIStore;
