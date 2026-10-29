import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { Moon, Sunrise, Smile, Frown } from 'lucide-react-native';
import { useSleepStore } from '../store/useSleepStore';
import { insertSleepLog } from '../db/client';

export default function HomeScreen() {
  const {
    isTracking,
    startTime,
    startSleep,
    wakeUp,
  } = useSleepStore();
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [memo, setMemo] = useState('');
  const [mood, setMood] = useState<number | null>(null);

  // Update real-time timer every second when tracking
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (isTracking && startTime) {
      const updateTimer = () => {
        const start = new Date(startTime).getTime();
        const now = new Date().getTime();
        const diffMs = Math.max(0, now - start);

        const totalSecs = Math.floor(diffMs / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;

        const formatted = [
          hrs.toString().padStart(2, '0'),
          mins.toString().padStart(2, '0'),
          secs.toString().padStart(2, '0'),
        ].join(':');

        setElapsedTime(formatted);
      };

      // Initial run
      updateTimer();

      // Setup 1-second interval
      intervalId = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime('00:00:00');
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isTracking, startTime]);

  // Handle sleep tracking start
  const handleStartSleep = () => {
    setMemo('');
    setMood(null);
    startSleep();
  };

  // Handle sleep tracking end (Wake Up)
  const handleWakeUp = () => {
    if (!startTime) return;

    try {
      const wakeTimeStr = new Date().toISOString();
      const bedtimeMs = new Date(startTime).getTime();
      const wakeTimeMs = new Date(wakeTimeStr).getTime();

      const durationSeconds = Math.max(0, Math.floor((wakeTimeMs - bedtimeMs) / 1000));

      // Validation check: duration must not exceed 24 hours
      const maxSeconds = 24 * 60 * 60; // 86400 seconds
      if (durationSeconds > maxSeconds) {
        Alert.alert(
          'エラー',
          '睡眠時間が24時間を超えています。計測を一度強制リセットし、手動入力から記録してください。'
        );
        return;
      }

      // SQLite Insert
      insertSleepLog(startTime, wakeTimeStr, durationSeconds, memo.trim() || null, mood);

      // Zustand State Reset
      wakeUp();

      // Show Success Alert
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.floor((durationSeconds % 3600) / 60);

      Alert.alert(
        'おはようございます！',
        `睡眠データを記録しました。\n睡眠時間: ${hours}時間 ${minutes}分\n今日も一日頑張りましょう！`,
        [{ text: 'OK', onPress: () => { setMemo(''); setMood(null); } }]
      );
    } catch (error: any) {
      console.error('[Home] Failed to save sleep log:', error);
      Alert.alert('エラー', 'データの保存に失敗しました。');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {!isTracking ? (
          /* Standby State */
          <View style={styles.stateContainer}>
            <View style={styles.glowingRingPlaceholder}>
              <Pressable
                style={({ pressed }) => [
                  styles.circleButtonStart,
                  pressed && { transform: [{ scale: 0.95 }] }
                ]}
                onPress={handleStartSleep}
              >
                <Moon size={48} color="#f8fafc" style={styles.circleButtonEmoji} />
                <Text style={styles.circleButtonTitle}>就寝する</Text>
              </Pressable>
            </View>
            <Text style={styles.promptText}>
              布団に入る準備はできましたか？{'\n'}上のボタンを押して、心地よい睡眠を記録しましょう。
            </Text>
          </View>
        ) : (
          /* Tracking State */
          <View style={styles.stateContainer}>
            <View style={styles.activeTimerCard}>
              <View style={styles.pulseIndicatorRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.trackingLabel}>睡眠計測中...</Text>
              </View>

              {/* Live Timer Display */}
              <Text style={styles.timerText}>{elapsedTime}</Text>

              <Text style={styles.startTimeSubText}>
                就寝開始: {new Date(startTime || '').toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {/* Memo input card */}
            <View style={styles.memoCard}>
              <Text style={styles.memoTitle}>起床時のメモ (任意)</Text>
              <TextInput
                style={styles.memoInput}
                placeholder="目覚めの気分や、夢の内容を記録..."
                placeholderTextColor="#64748b"
                value={memo}
                onChangeText={setMemo}
                maxLength={100}
                multiline
                blurOnSubmit
                returnKeyType="done"
              />
              <Text style={styles.charCount}>
                {memo.length} / 100
              </Text>
            </View>

            {/* Mood Selection Section */}
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}>
                <Smile size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                <Text style={styles.label}>寝起き評価 (任意)</Text>
              </View>
              <View style={styles.moodButtonRow}>
                <Pressable
                  onPress={() => setMood(mood === 1 ? null : 1)}
                  style={({ pressed }) => [
                    styles.moodButton,
                    mood === 1 ? styles.moodButtonActiveGood : styles.moodButtonInactive,
                    pressed && { transform: [{ scale: 0.97 }] }
                  ]}
                >
                  <Smile size={24} color={mood === 1 ? '#a3e635' : '#64748b'} />
                  <Text style={[styles.moodButtonText, mood === 1 && styles.moodButtonTextActive]}>良い</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMood(mood === 0 ? null : 0)}
                  style={({ pressed }) => [
                    styles.moodButton,
                    mood === 0 ? styles.moodButtonActiveBad : styles.moodButtonInactive,
                    pressed && { transform: [{ scale: 0.97 }] }
                  ]}
                >
                  <Frown size={24} color={mood === 0 ? '#ef4444' : '#64748b'} />
                  <Text style={[styles.moodButtonText, mood === 0 && styles.moodButtonTextActive]}>悪い</Text>
                </Pressable>
              </View>
            </View>

            {/* Wake Up Button */}
            <Pressable
              style={({ pressed }) => [
                styles.buttonWakeUp,
                pressed && { transform: [{ scale: 0.95 }] }
              ]}
              onPress={handleWakeUp}
            >
              <View style={styles.buttonWakeUpContent}>
                <Sunrise size={24} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonWakeUpText}>起床する (wakeUp)</Text>
              </View>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  glowingRingPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1b4b', // Indigo 950
    shadowColor: '#6366f1', // Indigo 500 Glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 40,
    borderWidth: 2,
    borderColor: '#4f46e5', // Indigo 600
  },
  circleButtonStart: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#312e81', // Indigo 900
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  circleButtonTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  promptText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
  },
  activeTimerCard: {
    width: '100%',
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155', // Slate 700
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  pulseIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#0f172a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8b5cf6', // Violet 500
    marginRight: 8,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  trackingLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timerText: {
    fontSize: 54,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: 2,
    marginVertical: 12,
  },
  startTimeSubText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  memoCard: {
    width: '100%',
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  memoInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    color: '#f1f5f9',
    fontSize: 15,
    height: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
  },
  charCount: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 6,
  },
  formGroup: {
    width: '100%',
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  moodButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  moodButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  moodButtonInactive: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    opacity: 0.6,
  },
  moodButtonActiveGood: {
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderColor: '#a3e635',
  },
  moodButtonActiveBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
  },
  moodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 6,
  },
  moodButtonTextActive: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  buttonWakeUp: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#10b981', // Emerald 500
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonWakeUpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWakeUpText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
