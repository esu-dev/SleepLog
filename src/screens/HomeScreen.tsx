import React, { useEffect, useState } from 'react';
import { Smile, Meh, Frown } from 'lucide-react-native';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  ScrollView,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Moon, AlarmClock, Edit, Sunrise } from 'lucide-react-native';
import { useSleepStore } from '../store/useSleepStore';
import { insertSleepLog } from '../db/client';

interface CustomSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void | Promise<void>;
}

const CustomSwitch: React.FC<CustomSwitchProps> = ({ value, onValueChange }) => {
  return (
    <View style={styles.segmentContainer}>
      <TouchableOpacity
        style={[
          styles.segmentButton,
          value ? styles.segmentButtonActiveOn : styles.segmentButtonInactive
        ]}
        onPress={() => {
          if (!value) onValueChange(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.segmentText, value && styles.segmentTextActive]}>ON</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.segmentButton,
          !value ? styles.segmentButtonActiveOff : styles.segmentButtonInactive
        ]}
        onPress={() => {
          if (value) onValueChange(false);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.segmentText, !value && styles.segmentTextActive]}>OFF</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function HomeScreen() {
  const {
    isTracking,
    startTime,
    startSleep,
    wakeUp,
    resetTracking,
    alarmEnabled,
    alarmHour,
    alarmMinute,
    setAlarmEnabled,
    setAlarmTime,
    snoozeDuration,
    setSnoozeDuration,
    isSnoozing,
    snoozeTargetTime,
    stopSnoozing,
    startSnoozing,
  } = useSleepStore();
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [memo, setMemo] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  
  // Alarm pickers & status state
  const [showPicker, setShowPicker] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [snoozeCountdown, setSnoozeCountdown] = useState('');
  const [showCustomSnooze, setShowCustomSnooze] = useState(false);
  const snoozePulseAnim = React.useRef(new Animated.Value(1)).current;

  // Remaining time dynamic calculation
  useEffect(() => {
    if (!alarmEnabled) {
      setTimeRemaining('');
      return;
    }

    const updateRemainingTime = () => {
      const now = new Date();
      const alarmDate = new Date(now);
      alarmDate.setHours(alarmHour, alarmMinute, 0, 0);

      if (alarmDate.getTime() <= now.getTime()) {
        alarmDate.setDate(alarmDate.getDate() + 1);
      }

      const diffMs = alarmDate.getTime() - now.getTime();
      const totalMins = Math.ceil(diffMs / 60000); // round up to nearest minute
      
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;

      if (hrs > 0) {
        setTimeRemaining(`あと ${hrs}時間 ${mins}分`);
      } else {
        setTimeRemaining(`あと ${mins}分`);
      }
    };

    updateRemainingTime();

    // Update every minute (60,000 ms)
    const intervalId = setInterval(updateRemainingTime, 60000);
    return () => clearInterval(intervalId);
  }, [alarmEnabled, alarmHour, alarmMinute]);

  // Pulse animation for active snooze UI
  useEffect(() => {
    if (isSnoozing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(snoozePulseAnim, {
            toValue: 1.15,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(snoozePulseAnim, {
            toValue: 1.0,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      snoozePulseAnim.setValue(1);
    }
  }, [isSnoozing]);

  // Update snooze countdown every second
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (isSnoozing && snoozeTargetTime) {
      const updateSnoozeCountdown = () => {
        const now = new Date().getTime();
        const target = new Date(snoozeTargetTime).getTime();
        const diffMs = target - now;

        if (diffMs <= 0) {
          setSnoozeCountdown('00分00秒');
          return;
        }

        const totalSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;

        setSnoozeCountdown(
          `${mins.toString().padStart(2, '0')}分${secs.toString().padStart(2, '0')}秒`
        );
      };

      updateSnoozeCountdown();
      intervalId = setInterval(updateSnoozeCountdown, 1000);
    } else {
      setSnoozeCountdown('');
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isSnoozing, snoozeTargetTime]);

  // Notification scheduling
  const scheduleDailyAlarm = async (hour: number, minute: number) => {
    try {
      // Clean existing notifications first
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Schedule daily recurring alarm
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '起床の時間です！☀️',
          body: 'よく眠れましたか？今日も一日頑張りましょう！',
          sound: 'alarm.mp3',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: 'daily',
          hour,
          minute,
        } as any,
      });
      console.log('[Alarm] Scheduled alarm ID:', identifier);
      return true;
    } catch (error) {
      console.error('[Alarm] Failed to schedule alarm:', error);
      Alert.alert('エラー', 'アラームのスケジュール設定に失敗しました。');
      return false;
    }
  };

  const cancelDailyAlarm = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Alarm] Cancelled all scheduled notifications.');
    } catch (error) {
      console.error('[Alarm] Failed to cancel notifications:', error);
    }
  };

  const cancelSnoozeNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (alarmEnabled) {
        await scheduleDailyAlarm(alarmHour, alarmMinute);
      }
    } catch (error) {
      console.error('[Home] Failed to cancel snooze notifications:', error);
    }
  };

  const handleCancelSnooze = async () => {
    try {
      await cancelSnoozeNotifications();
      stopSnoozing();
      Alert.alert('スヌーズ解除', 'スヌーズをキャンセルしました。');
    } catch (error) {
      console.error('[Snooze] Failed to cancel snooze:', error);
    }
  };

  const handleTestAlarmInstant = async () => {
    try {
      Alert.alert(
        'テストアラーム送信',
        '5秒後にテストアラームが発火します。アプリを開いたままでもお知らせバナーとサウンドが動作するか検証できます。端末の音量設定をご確認ください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '実行',
            onPress: async () => {
              const { status } = await Notifications.requestPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('エラー', '通知権限が許可されていません。');
                return;
              }

              const identifier = await Notifications.scheduleNotificationAsync({
                content: {
                  title: '⏰ 【テスト】起床の時間です！☀️',
                  body: 'アラームの通知音とバナーの動作検証テストです。よく眠れましたか？',
                  sound: 'alarm.mp3',
                  priority: Notifications.AndroidNotificationPriority.MAX,
                },
                trigger: {
                  type: 'timeInterval',
                  seconds: 5,
                  repeats: false,
                } as any,
              });
              console.log('[Alarm Test] Scheduled instant test alarm ID:', identifier);
            }
          }
        ]
      );
    } catch (error) {
      console.error('[Alarm Test] Failed to schedule test alarm:', error);
      Alert.alert('エラー', 'テストアラームの設定に失敗しました。');
    }
  };

  const handleInstantSnooze = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('エラー', '通知権限が許可されていません。');
        return;
      }

      const targetTime = new Date(Date.now() + snoozeDuration * 60 * 1000).toISOString();

      // Schedule the end-of-snooze notification (as before)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ スヌーズ終了！',
          body: `${snoozeDuration}分のスヌーズが終了しました。起きましょう！`,
          sound: 'alarm.mp3',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: 'timeInterval',
          seconds: snoozeDuration * 60,
          repeats: false,
        } as any,
      });

      // Immediate recurring alarm while snoozing (fires every minute)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ スヌーズ中',
          body: 'スヌーズ待機中です。起きる準備はできていますか？',
          sound: 'alarm.mp3',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: 'timeInterval',
          seconds: 60, // every minute
          repeats: true,
        } as any,
      });

      startSnoozing(targetTime);
      Alert.alert('スヌーズ開始', `${snoozeDuration}分後にスヌーズ通知が届きます。`);
    } catch (error) {
      console.error('[Snooze] Failed to start instant snooze:', error);
      Alert.alert('エラー', 'スヌーズの設定に失敗しました。');
    }
  };

  const handleToggleAlarm = async (value: boolean) => {
    if (value) {
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          '通知権限エラー',
          'アラーム機能を利用するには通知の許可が必要です。端末の設定画面からSleepLogの通知を許可してください。'
        );
        setAlarmEnabled(false);
        return;
      }

      // Permissions granted, schedule alarm
      const success = await scheduleDailyAlarm(alarmHour, alarmMinute);
      if (success) {
        setAlarmEnabled(true);
      } else {
        setAlarmEnabled(false);
      }
    } else {
      await cancelDailyAlarm();
      setAlarmEnabled(false);
    }
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    // For Android, close picker immediately
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      const hour = selectedDate.getHours();
      const minute = selectedDate.getMinutes();
      setAlarmTime(hour, minute);

      // If alarm is already enabled, reschedule with the new time
      if (alarmEnabled) {
        await scheduleDailyAlarm(hour, minute);
      }
    }
  };

  const handleSnoozeTimeChange = (event: any, selectedDate?: Date) => {
    // For Android, close picker immediately
    if (Platform.OS === 'android') {
      setShowCustomSnooze(false);
    }

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      const hour = selectedDate.getHours();
      const minute = selectedDate.getMinutes();
      const duration = hour * 60 + minute;

      if (duration > 0 && duration <= 120) {
        setSnoozeDuration(duration);
      } else if (duration > 120) {
        Alert.alert('エラー', 'スヌーズ時間は最大2時間（120分）まで設定可能です。');
      } else {
        Alert.alert('エラー', '1分以上の時間を設定してください。');
      }
    }
  };

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

      // Cancel snooze notifications if any
      cancelSnoozeNotifications();
      
      // Show Success Alert
      const hours = Math.floor(durationSeconds / 3600);
      const minutes = Math.floor((durationSeconds % 3600) / 60);
      
      Alert.alert(
        'おはようございます！',
        `睡眠データを記録しました。\n睡眠時間: ${hours}時間 ${minutes}分\n今日も一日頑張りましょう！`,
        [{ text: 'OK', onPress: () => { setMemo(''); setMood(0); } }]
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

              {/* Alarm Config Card */}
              <View style={styles.alarmCard}>
                <View style={styles.alarmHeader}>
                  <View style={styles.alarmTitleRow}>
                    <AlarmClock size={20} color="#f8fafc" style={styles.alarmIcon} />
                    <Text style={styles.alarmTitle}>起床アラーム</Text>
                  </View>
                  <CustomSwitch
                    value={alarmEnabled}
                    onValueChange={handleToggleAlarm}
                  />
                </View>

                <View style={styles.alarmBody}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.timeDisplayPressable,
                      pressed && styles.timeDisplayPressablePressed
                    ]}
                    onPress={() => setShowPicker(!showPicker)}
                  >
                    <Text style={[styles.timeDisplayText, alarmEnabled ? styles.timeDisplayTextActive : styles.timeDisplayTextInactive]}>
                      {alarmHour.toString().padStart(2, '0')}:{alarmMinute.toString().padStart(2, '0')}
                    </Text>
                    <Edit size={14} color="#64748b" style={styles.editIconText} />
                  </Pressable>

                  {alarmEnabled && timeRemaining ? (
                    <View style={styles.remainingBadge}>
                      <Text style={styles.remainingText}>{timeRemaining}</Text>
                    </View>
                  ) : (
                    <Text style={styles.alarmStatusLabel}>
                      {alarmEnabled ? '設定中' : 'アラーム無効'}
                    </Text>
                  )}
                </View>

                {/* Snooze Duration Selector */}
                <View style={styles.snoozeSelectorContainer}>
                  {[{ label: '5分', minutes: 5 }, { label: '10分', minutes: 10 }, { label: '15分', minutes: 15 }].map((item) => (
                    <TouchableOpacity
                      key={item.minutes}
                      style={[styles.snoozeOptionButton, snoozeDuration === item.minutes && styles.snoozeOptionButtonActive]}
                      onPress={() => setSnoozeDuration(item.minutes)}
                    >
                      <Text style={styles.snoozeOptionText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.snoozeOptionButton, snoozeDuration > 0 && ![5, 10, 15].includes(snoozeDuration) && styles.snoozeOptionButtonActive]}
                    onPress={() => setShowCustomSnooze(true)}
                  >
                    <Text style={styles.snoozeOptionText}>
                      {snoozeDuration > 0 && ![5, 10, 15].includes(snoozeDuration)
                        ? `カスタム (${snoozeDuration}分)`
                        : 'カスタム'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom snooze picker display */}
                {showCustomSnooze && (
                  Platform.OS === 'ios' ? (
                    <Modal
                      transparent={true}
                      visible={showCustomSnooze}
                      animationType="slide"
                      onRequestClose={() => setShowCustomSnooze(false)}
                    >
                      <View style={styles.modalOverlay}>
                        <Pressable style={styles.modalDismissArea} onPress={() => setShowCustomSnooze(false)} />
                        <View style={styles.modalContent}>
                          <View style={styles.pickerHeader}>
                            <Text style={styles.pickerHeaderTitle}>スヌーズ間隔を選択</Text>
                            <Pressable
                              style={({ pressed }) => [
                                styles.pickerCloseButton,
                                pressed && { opacity: 0.7 }
                              ]}
                              onPress={() => setShowCustomSnooze(false)}
                            >
                              <Text style={styles.pickerCloseButtonText}>完了</Text>
                            </Pressable>
                          </View>
                          <DateTimePicker
                            value={(() => {
                              const d = new Date();
                              d.setHours(Math.floor(snoozeDuration / 60), snoozeDuration % 60, 0, 0);
                              return d;
                            })()}
                            mode="time"
                            is24Hour={true}
                            display="spinner"
                            onChange={handleSnoozeTimeChange}
                            textColor="#f8fafc"
                          />
                        </View>
                      </View>
                    </Modal>
                  ) : (
                    <DateTimePicker
                      value={(() => {
                        const d = new Date();
                        d.setHours(Math.floor(snoozeDuration / 60), snoozeDuration % 60, 0, 0);
                        return d;
                      })()}
                      mode="time"
                      is24Hour={true}
                      display="default"
                      onChange={handleSnoozeTimeChange}
                    />
                  )
                )}

                {/* Time Picker Display */}
                {showPicker && (
                  Platform.OS === 'ios' ? (
                    <Modal
                      transparent={true}
                      visible={showPicker}
                      animationType="slide"
                      onRequestClose={() => setShowPicker(false)}
                    >
                      <View style={styles.modalOverlay}>
                        <Pressable style={styles.modalDismissArea} onPress={() => setShowPicker(false)} />
                        <View style={styles.modalContent}>
                          <View style={styles.pickerHeader}>
                            <Text style={styles.pickerHeaderTitle}>アラーム時刻を選択</Text>
                            <Pressable
                              style={({ pressed }) => [
                                styles.pickerCloseButton,
                                pressed && { opacity: 0.7 }
                              ]}
                              onPress={() => setShowPicker(false)}
                            >
                              <Text style={styles.pickerCloseButtonText}>完了</Text>
                            </Pressable>
                          </View>
                          <DateTimePicker
                            value={(() => {
                              const d = new Date();
                              d.setHours(alarmHour, alarmMinute, 0, 0);
                              return d;
                            })()}
                            mode="time"
                            is24Hour={true}
                            display="spinner"
                            onChange={handleTimeChange}
                            textColor="#f8fafc"
                          />
                        </View>
                      </View>
                    </Modal>
                  ) : (
                    <DateTimePicker
                      value={(() => {
                        const d = new Date();
                        d.setHours(alarmHour, alarmMinute, 0, 0);
                        return d;
                      })()}
                      mode="time"
                      is24Hour={true}
                      display="default"
                      onChange={handleTimeChange}
                    />
                  )
                )}

                {/* Development UI Buttons */}
                {__DEV__ && (
                  <>
                    <TouchableOpacity style={styles.devTestButton} onPress={handleTestAlarmInstant}>
                      <Text style={styles.devTestButtonText}>🛠️ 開発用: 即時アラームテスト (5秒後)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.devTestButton} onPress={handleInstantSnooze}>
                      <Text style={styles.devTestButtonText}>🛠️ 開発用: 即座スヌーズ起動</Text>
                    </TouchableOpacity>
                  </>
                )}

              </View>
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

                {/* Alarm Status Indicator */}
                {alarmEnabled ? (
                  <View style={styles.trackingAlarmBadge}>
                    <Text style={styles.trackingAlarmText}>
                      ⏰ アラーム設定: {alarmHour.toString().padStart(2, '0')}:{alarmMinute.toString().padStart(2, '0')} (有効)
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.trackingAlarmBadge, styles.trackingAlarmBadgeDisabled]}>
                    <Text style={styles.trackingAlarmTextDisabled}>⏰ アラーム設定: 無効</Text>
                  </View>
                )}
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
                  <Text style={styles.label}>目覚めの気分 (任意)</Text>
                </View>
                <View style={styles.moodButtonRow}>
                  <Pressable
                    onPress={() => setMood(mood === 2 ? null : 2)}
                    style={({ pressed }) => [
                      styles.moodButton,
                      mood === 2 ? styles.moodButtonActiveBad : styles.moodButtonInactive,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                  >
                    <Frown size={24} color={mood === 2 ? '#ef4444' : '#64748b'} />
                    <Text style={[styles.moodButtonText, mood === 2 && styles.moodButtonTextActive]}>悪い</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMood(mood === 1 ? null : 1)}
                    style={({ pressed }) => [
                      styles.moodButton,
                      mood === 1 ? styles.moodButtonActiveNormal : styles.moodButtonInactive,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                  >
                    <Meh size={24} color={mood === 1 ? '#facc15' : '#64748b'} />
                    <Text style={[styles.moodButtonText, mood === 1 && styles.moodButtonTextActive]}>普通</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMood(mood === 0 ? null : 0)}
                    style={({ pressed }) => [
                      styles.moodButton,
                      mood === 0 ? styles.moodButtonActiveGood : styles.moodButtonInactive,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                  >
                    <Smile size={24} color={mood === 0 ? '#a3e635' : '#64748b'} />
                    <Text style={[styles.moodButtonText, mood === 0 && styles.moodButtonTextActive]}>良い</Text>
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
                <Text style={styles.buttonWakeUpText}><Sunrise size={24} color="#ffffff" /> 起床する (wakeUp)</Text>
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a', // Slate 900
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#334155', // Slate 700
  },
  segmentButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
  },
  segmentButtonActiveOn: {
    backgroundColor: '#6366f1', // Indigo 500
  },
  segmentButtonActiveOff: {
    backgroundColor: '#475569', // Slate 600
  },
  segmentButtonInactive: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b', // Slate 500
  },
  segmentTextActive: {
    color: '#ffffff',
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
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', // Digital look
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
  buttonWakeUpText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alarmCard: {
    width: '100%',
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: 24,
    padding: 20,
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#334155', // Slate 700
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alarmTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alarmIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  alarmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  alarmBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  alarmBodyDisabled: {
    opacity: 0.6,
  },
  timeDisplayPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a', // Slate 900
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeDisplayPressablePressed: {
    backgroundColor: '#1e1b4b', // Indigo 950
    borderColor: '#4f46e5',
  },
  timeDisplayText: {
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontWeight: 'bold',
  },
  timeDisplayTextActive: {
    color: '#6366f1', // Indigo 500
  },
  timeDisplayTextInactive: {
    color: '#94a3b8', // Slate 400
  },
  editIconText: {
    fontSize: 14,
    marginLeft: 8,
    color: '#64748b',
  },
  remainingBadge: {
    backgroundColor: '#312e81', // Indigo 900
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  remainingText: {
    color: '#a5b4fc', // Indigo 300
    fontSize: 13,
    fontWeight: '700',
  },
  alarmStatusLabel: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 8,
  },
  pickerHeaderTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerCloseButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerCloseButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  trackingAlarmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#312e81',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4f46e5',
    marginTop: 12,
  },
  trackingAlarmBadgeDisabled: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  trackingAlarmText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '700',
  },
  trackingAlarmTextDisabled: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  devTestButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devTestButtonText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Snooze UI Styles
  snoozeSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 12,
  },
  snoozeOptionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  snoozeOptionButtonActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  snoozeOptionText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  snoozeActiveContainer: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 24,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  snoozeRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#6366f1',
    opacity: 0.15,
    marginBottom: 20,
  },
  snoozeCountdownText: {
    fontSize: 18,
    color: '#a5b4fc',
    marginBottom: 12,
  },
  snoozeActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  snoozeActionButton: {
    flex: 1,
    backgroundColor: '#4f46e5',
    marginHorizontal: 6,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  snoozeActionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
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
  moodButtonActiveNormal: {
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderColor: '#facc15',
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
});
