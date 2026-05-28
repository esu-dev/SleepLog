import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SleepState {
  isTracking: boolean;
  startTime: string | null;
  startSleep: () => void;
  wakeUp: () => void;
  resetTracking: () => void;
  
  // Alarm state
  alarmEnabled: boolean;
  alarmHour: number;
  alarmMinute: number;
  setAlarmEnabled: (enabled: boolean) => void;
  setAlarmTime: (hour: number, minute: number) => void;

  // Snooze state
  snoozeDuration: number; // minutes, 0 means OFF
  isSnoozing: boolean;
  snoozeTargetTime: string | null; // ISO Date String of next alarm
  setSnoozeDuration: (minutes: number) => void;
  startSnoozing: (targetTime: string) => void;
  stopSnoozing: () => void;
}

export const useSleepStore = create<SleepState>()(
  persist(
    (set) => ({
      isTracking: false,
      startTime: null,
      
      // Alarm default values
      alarmEnabled: false,
      alarmHour: 7,
      alarmMinute: 0,

      // Snooze default values
      snoozeDuration: 5, // default 5 minutes
      isSnoozing: false,
      snoozeTargetTime: null,
      
      startSleep: () => {
        const now = new Date().toISOString();
        console.log('[Store] startSleep called. startTime:', now);
        set({
          isTracking: true,
          startTime: now,
          isSnoozing: false,
          snoozeTargetTime: null,
        });
      },
      
      wakeUp: () => {
        console.log('[Store] wakeUp called.');
        set({
          isTracking: false,
          startTime: null,
          isSnoozing: false,
          snoozeTargetTime: null,
        });
      },
      
      resetTracking: () => {
        console.log('[Store] resetTracking called.');
        set({
          isTracking: false,
          startTime: null,
          isSnoozing: false,
          snoozeTargetTime: null,
        });
      },

      setAlarmEnabled: (enabled) => {
        console.log('[Store] setAlarmEnabled:', enabled);
        set({ alarmEnabled: enabled });
      },
      
      setAlarmTime: (hour, minute) => {
        console.log('[Store] setAlarmTime:', hour, minute);
        set({ alarmHour: hour, alarmMinute: minute });
      },

      setSnoozeDuration: (minutes) => {
        console.log('[Store] setSnoozeDuration:', minutes);
        set({ snoozeDuration: minutes });
      },

      startSnoozing: (targetTime) => {
        console.log('[Store] startSnoozing. targetTime:', targetTime);
        set({ isSnoozing: true, snoozeTargetTime: targetTime });
      },

      stopSnoozing: () => {
        console.log('[Store] stopSnoozing called.');
        set({ isSnoozing: false, snoozeTargetTime: null });
      },
    }),
    {
      name: 'sleep-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
