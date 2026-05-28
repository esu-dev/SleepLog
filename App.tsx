import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Modal,
  Animated,
  Easing,
  Alert,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { initializeDatabase, getAllSleepLogs, SleepLog, insertSleepLog } from './src/db/client';
import * as Notifications from 'expo-notifications';
import { playAlarmSound, stopAlarmSound } from './src/utils/alarmPlayer';

// Set up foreground notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
import { useSleepStore } from './src/store/useSleepStore';
import HomeScreen from './src/screens/HomeScreen';
import AddLogScreen from './src/screens/AddLogScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import { Moon, FilePlus, ClipboardList, BarChart3, Smile, Meh, Frown } from 'lucide-react-native';

type Tab = 'home' | 'add' | 'history' | 'stats';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [dbStatus, setDbStatus] = useState<'success' | 'failed'>('success');
  const [logs, setLogs] = useState<SleepLog[]>([]);

  // Alarm ringing states
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Wake up feedback states
  const [showWakeUpFeedback, setShowWakeUpFeedback] = useState(false);
  const [wakeUpMood, setWakeUpMood] = useState<number | null>(null);
  const [wakeUpMemo, setWakeUpMemo] = useState('');
  const [wakeUpTimeTemp, setWakeUpTimeTemp] = useState<string | null>(null);
  const [wakeUpDurationTemp, setWakeUpDurationTemp] = useState<number>(0);

  // Get active tracking state
  const {
    isTracking,
    startTime,
    wakeUp,
    snoozeDuration,
    startSnoozing,
    stopSnoozing,
    alarmEnabled,
    alarmHour,
    alarmMinute,
  } = useSleepStore();

  // Pulse animation for alarm ringing UI
  useEffect(() => {
    if (isAlarmRinging) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAlarmRinging]);

  // Register notification received handlers for audio play trigger
  useEffect(() => {
    // 1. Foreground notification
    const foregroundSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('[App] Foreground notification received:', notification);
      setIsAlarmRinging(true);
      await playAlarmSound();
    });

    // 2. Notification response (click from background)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('[App] Notification response received:', response);
      setIsAlarmRinging(true);
      await playAlarmSound();
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  // Action handlers to stop alarm
  const cancelSnoozeNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (alarmEnabled) {
        // Reschedule daily recurring alarm
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '起床の時間です！☀️',
            body: 'よく眠れましたか？今日も一日頑張りましょう！',
            sound: 'alarm.mp3',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: 'daily',
            hour: alarmHour,
            minute: alarmMinute,
          } as any,
        });
      }
    } catch (error) {
      console.error('[App] Failed to cancel snooze notifications:', error);
    }
  };

  const handleStopAlarmOnly = async () => {
    await stopAlarmSound();
    setIsAlarmRinging(false);
    stopSnoozing();
    await cancelSnoozeNotifications();
  };

  const handleSnoozeAlarm = async () => {
    await stopAlarmSound();
    setIsAlarmRinging(false);

    if (snoozeDuration > 0) {
      try {
        const targetDate = new Date();
        targetDate.setMinutes(targetDate.getMinutes() + snoozeDuration);

        // Update store
        startSnoozing(targetDate.toISOString());

        // Schedule snooze notification (X minutes from now)
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ 【スヌーズ】起床の時間です！☀️',
            body: `スヌーズ（${snoozeDuration}分後）のアラームです。`,
            sound: 'alarm.mp3',
            priority: Notifications.AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: 'timeInterval',
            seconds: snoozeDuration * 60,
            repeats: false,
          } as any,
        });

        console.log('[Snooze] Scheduled snooze alarm ID:', identifier);
        Alert.alert('スヌーズ設定', `${snoozeDuration}分後に再度アラームを鳴らします。`);
      } catch (error) {
        console.error('[Snooze] Failed to schedule snooze:', error);
        Alert.alert('エラー', 'スヌーズの設定に失敗しました。');
      }
    }
  };

  const handleStopAlarmAndWakeUp = async () => {
    await stopAlarmSound();
    setIsAlarmRinging(false);
    stopSnoozing();
    await cancelSnoozeNotifications();

    if (isTracking && startTime) {
      const wakeTimeStr = new Date().toISOString();
      const bedtimeMs = new Date(startTime).getTime();
      const wakeTimeMs = new Date(wakeTimeStr).getTime();
      const durationSeconds = Math.max(0, Math.floor((wakeTimeMs - bedtimeMs) / 1000));

      // 24 hours limit check
      const maxSeconds = 24 * 60 * 60;
      if (durationSeconds > maxSeconds) {
        Alert.alert(
          'エラー',
          '睡眠時間が24時間を超えています。計測を一度強制リセットし、手動入力から記録してください。'
        );
        // Reset tracking because it exceeded 24h
        wakeUp();
        return;
      }

      // Store temps and open feedback modal
      setWakeUpTimeTemp(wakeTimeStr);
      setWakeUpDurationTemp(durationSeconds);
      setWakeUpMood(null);
      setWakeUpMemo('');
      setShowWakeUpFeedback(true);
    } else {
      Alert.alert('アラーム停止', '今日も素晴らしい一日になりますように！☀️');
    }
  };

  const handleSaveWakeUpRecord = (moodValue: number | null, memoText: string) => {
    if (!startTime || !wakeUpTimeTemp) {
      Alert.alert('エラー', '睡眠データの計測開始時間が確認できません。');
      return;
    }

    try {
      // SQLite Insert
      insertSleepLog(startTime, wakeUpTimeTemp, wakeUpDurationTemp, memoText.trim() || null, moodValue);

      // Zustand State Reset
      wakeUp();

      // Refresh list
      refreshLogs();

      // Close modal and clear states
      setShowWakeUpFeedback(false);
      setWakeUpMood(null);
      setWakeUpMemo('');
      setWakeUpTimeTemp(null);
      setWakeUpDurationTemp(0);

      const hours = Math.floor(wakeUpDurationTemp / 3600);
      const minutes = Math.floor((wakeUpDurationTemp % 3600) / 60);

      Alert.alert(
        'おはようございます！',
        `睡眠データを記録しました。\n睡眠時間: ${hours}時間 ${minutes}分\n今日も一日頑張りましょう！☀️`
      );
    } catch (error) {
      console.error('[App] Failed to save sleep log in feedback modal:', error);
      Alert.alert('エラー', 'データの保存に失敗しました。');
    }
  };

  const handleSkipWakeUpRecord = () => {
    handleSaveWakeUpRecord(null, '');
  };

  // Initialize DB on startup
  useEffect(() => {
    try {
      initializeDatabase();
      setDbStatus('success');
      refreshLogs();
    } catch (e) {
      setDbStatus('failed');
    }
  }, []);

  // Automatically refresh sleep logs from DB when user switches tabs
  useEffect(() => {
    refreshLogs();
  }, [activeTab]);

  // Refresh logs from SQLite
  const refreshLogs = () => {
    try {
      const allLogs = getAllSleepLogs();
      setLogs(allLogs);
    } catch (e) {
      console.error('[App] Failed to reload sleep logs:', e);
    }
  };

  // Render the currently active tab screen
  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen />;
      
      case 'add':
        // CRITICAL REQUIREMENT: Disable manual log entry during active tracking
        if (isTracking) {
          return (
            <View style={styles.warningContainer}>
              <View style={styles.warningCard}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningTitle}>手動入力は制限されています</Text>
                <Text style={styles.warningText}>
                  現在リアルタイム睡眠計測を実行中のため、過去データの手動入力は非活性化されています。
                </Text>
                <Text style={styles.warningTextSub}>
                  起床ボタンを押して計測を完了するか、Home画面から計測を強制リセットした後に手動入力を行ってください。
                </Text>
                
                {startTime && (
                  <View style={styles.warningTimeBox}>
                    <Text style={styles.warningTimeLabel}>就寝開始時刻:</Text>
                    <Text style={styles.warningTimeVal}>
                      {new Date(startTime).toLocaleString('ja-JP')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }
        return <AddLogScreen />;

      case 'history':
        return <HistoryScreen logs={logs} onRefresh={refreshLogs} />;

      case 'stats':
        return <StatsScreen logs={logs} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      {/* DB Connection Warning Indicator */}
      {dbStatus === 'failed' && (
        <View style={styles.dbWarningBar}>
          <Text style={styles.dbWarningText}>⚠️ SQLite データベース接続エラー</Text>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.mainContent}>{renderContent()}</View>

      {/* Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'home' && styles.tabItemActive]}
          onPress={() => setActiveTab('home')}
        >
          <Moon size={20} color={activeTab === 'home' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, activeTab === 'home' && styles.tabLabelActive]}>計測</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'add' && styles.tabItemActive]}
          onPress={() => setActiveTab('add')}
        >
          <FilePlus size={20} color={activeTab === 'add' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, activeTab === 'add' && styles.tabLabelActive]}>手動追加</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
          onPress={() => setActiveTab('history')}
        >
          <ClipboardList size={20} color={activeTab === 'history' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>履歴</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'stats' && styles.tabItemActive]}
          onPress={() => setActiveTab('stats')}
        >
          <BarChart3 size={20} color={activeTab === 'stats' ? '#6366f1' : '#94a3b8'} />
          <Text style={[styles.tabLabel, activeTab === 'stats' && styles.tabLabelActive]}>統計</Text>
        </TouchableOpacity>
      </View>

      {/* Alarm Ringing Fullscreen Modal */}
      <Modal
        visible={isAlarmRinging}
        transparent={false}
        animationType="fade"
        onRequestClose={handleStopAlarmOnly}
      >
        <View style={styles.modalRingingContainer}>
          <View style={styles.modalRingingOverlay}>
            {/* Glowing Ring Animation */}
            <View style={styles.glowingRingContainer}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <View style={styles.centerAlarmIconBox}>
                <Text style={styles.centerAlarmEmoji}>⏰</Text>
              </View>
            </View>

            <Text style={styles.alarmRingingTitle}>朝の音楽が流れています ☀️</Text>
            <Text style={styles.alarmRingingSub}>心地よい朝のクラシック音楽で一日を始めましょう</Text>

            {isTracking && startTime && (
              <View style={styles.alarmTrackingInfoBox}>
                <Text style={styles.alarmTrackingInfoLabel}>現在の睡眠時間:</Text>
                <Text style={styles.alarmTrackingInfoValue}>
                  {(() => {
                    const start = new Date(startTime).getTime();
                    const now = new Date().getTime();
                    const diffMs = Math.max(0, now - start);
                    const hrs = Math.floor(diffMs / 3600000);
                    const mins = Math.floor((diffMs % 3600000) / 60000);
                    return `${hrs}時間 ${mins}分`;
                  })()}
                </Text>
              </View>
            )}

            <View style={styles.alarmButtonRow}>
              {snoozeDuration > 0 && (
                <TouchableOpacity
                  style={styles.btnSnoozeAlarm}
                  onPress={handleSnoozeAlarm}
                >
                  <Text style={styles.btnSnoozeAlarmText}>💤 スヌーズ（あと {snoozeDuration} 分）</Text>
                </TouchableOpacity>
              )}

              {isTracking && (
                <TouchableOpacity
                  style={styles.btnWakeUpAlarm}
                  onPress={handleStopAlarmAndWakeUp}
                >
                  <Text style={styles.btnWakeUpAlarmText}>☀️ 音楽を止めて起床する</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.btnStopAlarmOnly, !isTracking && styles.btnStopAlarmOnlyFull]}
                onPress={handleStopAlarmOnly}
              >
                <Text style={styles.btnStopAlarmOnlyText}>🔕 アラーム音を止める</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wake Up Feedback Modal */}
      <Modal
        visible={showWakeUpFeedback}
        transparent={true}
        animationType="slide"
        onRequestClose={handleSkipWakeUpRecord}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.feedbackModalContainer}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.feedbackModalContent}>
              <ScrollView 
                contentContainerStyle={styles.feedbackModalScroll}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.feedbackModalHeader}>
                  <Text style={styles.feedbackTitle}>おはようございます！☀️</Text>
                  <Text style={styles.feedbackSubtitle}>睡眠記録を保存します。今朝の気分はいかがですか？</Text>
                </View>

                {/* Duration summary card */}
                <View style={styles.feedbackDurationCard}>
                  <Text style={styles.feedbackDurationLabel}>睡眠時間</Text>
                  <Text style={styles.feedbackDurationVal}>
                    {(() => {
                      const hrs = Math.floor(wakeUpDurationTemp / 3600);
                      const mins = Math.floor((wakeUpDurationTemp % 3600) / 60);
                      return `${hrs}時間 ${mins}分`;
                    })()}
                  </Text>
                </View>

                {/* Mood Selection Row */}
                <View style={styles.feedbackFormGroup}>
                  <View style={styles.feedbackLabelContainer}>
                    <Smile size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                    <Text style={styles.feedbackFormLabel}>目覚めの気分 (任意)</Text>
                  </View>
                  <View style={styles.feedbackMoodRow}>
                    <Pressable
                      onPress={() => setWakeUpMood(wakeUpMood === 0 ? null : 0)}
                      style={({ pressed }) => [
                        styles.feedbackMoodBtn,
                        wakeUpMood === 0 ? styles.feedbackMoodBtnActiveGood : styles.feedbackMoodBtnInactive,
                        pressed && { transform: [{ scale: 0.97 }] }
                      ]}
                    >
                      <Smile size={24} color={wakeUpMood === 0 ? '#a3e635' : '#64748b'} />
                      <Text style={[styles.feedbackMoodText, wakeUpMood === 0 && styles.feedbackMoodTextActive]}>良い</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setWakeUpMood(wakeUpMood === 1 ? null : 1)}
                      style={({ pressed }) => [
                        styles.feedbackMoodBtn,
                        wakeUpMood === 1 ? styles.feedbackMoodBtnActiveNormal : styles.feedbackMoodBtnInactive,
                        pressed && { transform: [{ scale: 0.97 }] }
                      ]}
                    >
                      <Meh size={24} color={wakeUpMood === 1 ? '#facc15' : '#64748b'} />
                      <Text style={[styles.feedbackMoodText, wakeUpMood === 1 && styles.feedbackMoodTextActive]}>普通</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setWakeUpMood(wakeUpMood === 2 ? null : 2)}
                      style={({ pressed }) => [
                        styles.feedbackMoodBtn,
                        wakeUpMood === 2 ? styles.feedbackMoodBtnActiveBad : styles.feedbackMoodBtnInactive,
                        pressed && { transform: [{ scale: 0.97 }] }
                      ]}
                    >
                      <Frown size={24} color={wakeUpMood === 2 ? '#ef4444' : '#64748b'} />
                      <Text style={[styles.feedbackMoodText, wakeUpMood === 2 && styles.feedbackMoodTextActive]}>悪い</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Memo Input Section */}
                <View style={styles.feedbackFormGroup}>
                  <View style={styles.feedbackLabelContainer}>
                    <Text style={styles.feedbackFormLabel}>起床時のメモ (任意)</Text>
                  </View>
                  <View style={styles.feedbackMemoBox}>
                    <TextInput
                      style={styles.feedbackMemoInput}
                      placeholder="夢の内容や寝起きの調子など..."
                      placeholderTextColor="#475569"
                      value={wakeUpMemo}
                      onChangeText={(text) => {
                        if (text.length <= 100) setWakeUpMemo(text);
                      }}
                      multiline={true}
                      numberOfLines={3}
                    />
                    <Text style={styles.feedbackCharCount}>
                      {wakeUpMemo.length} / 100
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.feedbackActionRow}>
                  <TouchableOpacity
                    style={styles.feedbackBtnSkip}
                    onPress={handleSkipWakeUpRecord}
                  >
                    <Text style={styles.feedbackBtnSkipText}>スキップして保存</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.feedbackBtnSave}
                    onPress={() => handleSaveWakeUpRecord(wakeUpMood, wakeUpMemo)}
                  >
                    <Text style={styles.feedbackBtnSaveText}>保存して記録する</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  dbWarningBar: {
    backgroundColor: '#ef4444',
    paddingVertical: 4,
    alignItems: 'center',
  },
  dbWarningText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mainContent: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#1e293b', // Slate 800
    borderTopWidth: 1,
    borderTopColor: '#334155', // Slate 700
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    // Styling for active state (optional)
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#6366f1', // Indigo 500
    fontWeight: '800',
  },
  /* Manual Entry disabled Warning Overlay style */
  warningContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  warningCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#b91c1c', // Dark red border
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  warningIcon: {
    fontSize: 44,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  warningTextSub: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  warningTimeBox: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  warningTimeLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  warningTimeVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
  },
  /* Alarm Ringing Modal Styles */
  modalRingingContainer: {
    flex: 1,
    backgroundColor: '#070a13', // Deep cosmic blue
  },
  modalRingingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  glowingRingContainer: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3b82f6', // Bright Blue
    opacity: 0.15,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  centerAlarmIconBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#1e3a8a', // Deep Blue
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  centerAlarmEmoji: {
    fontSize: 56,
  },
  alarmRingingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  alarmRingingSub: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  alarmTrackingInfoBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 40,
  },
  alarmTrackingInfoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  alarmTrackingInfoValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981', // Emerald
  },
  alarmButtonRow: {
    width: '100%',
    paddingHorizontal: 16,
  },
  btnSnoozeAlarm: {
    backgroundColor: '#4f46e5', // Indigo 600
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  btnSnoozeAlarmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  btnWakeUpAlarm: {
    backgroundColor: '#10b981', // Emerald 500
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnWakeUpAlarmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  btnStopAlarmOnly: {
    backgroundColor: '#334155', // Slate 700
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  btnStopAlarmOnlyFull: {
    width: '100%',
  },
  btnStopAlarmOnlyText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700',
  },
  feedbackModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.9)', // Deep dark transparent background
    justifyContent: 'flex-end', // Slide from bottom
  },
  feedbackModalContent: {
    backgroundColor: '#1e293b', // Slate 800
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: '90%',
  },
  feedbackModalScroll: {
    padding: 24,
    paddingBottom: 40,
  },
  feedbackModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  feedbackTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center',
  },
  feedbackSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  feedbackDurationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  feedbackDurationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackDurationVal: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366f1', // Indigo accent
  },
  feedbackFormGroup: {
    marginBottom: 20,
    width: '100%',
  },
  feedbackLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackFormLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  feedbackMoodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  feedbackMoodBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  feedbackMoodBtnInactive: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    opacity: 0.6,
  },
  feedbackMoodBtnActiveGood: {
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderColor: '#a3e635',
  },
  feedbackMoodBtnActiveNormal: {
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderColor: '#facc15',
  },
  feedbackMoodBtnActiveBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
  },
  feedbackMoodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 6,
  },
  feedbackMoodTextActive: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  feedbackMemoBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  feedbackMemoInput: {
    color: '#f8fafc',
    fontSize: 14,
    height: 60,
    textAlignVertical: 'top',
    padding: 0,
  },
  feedbackCharCount: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'right',
    marginTop: 4,
  },
  feedbackActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  feedbackBtnSkip: {
    flex: 0.45,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackBtnSkipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  feedbackBtnSave: {
    flex: 0.5,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  feedbackBtnSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
