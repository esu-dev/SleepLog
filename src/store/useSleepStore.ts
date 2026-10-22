import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SleepState {
  isTracking: boolean;
  startTime: string | null;
  startSleep: () => void;
  wakeUp: () => void;
  resetTracking: () => void;
}

export const useSleepStore = create<SleepState>()(
  persist(
    (set) => ({
      isTracking: false,
      startTime: null,

      startSleep: () => {
        const now = new Date().toISOString();
        console.log('[Store] startSleep called. startTime:', now);
        set({
          isTracking: true,
          startTime: now,
        });
      },

      wakeUp: () => {
        console.log('[Store] wakeUp called.');
        set({
          isTracking: false,
          startTime: null,
        });
      },

      resetTracking: () => {
        console.log('[Store] resetTracking called.');
        set({
          isTracking: false,
          startTime: null,
        });
      },
    }),
    {
      name: 'sleep-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
