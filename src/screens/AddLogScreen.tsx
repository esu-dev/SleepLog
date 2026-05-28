import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { sleepSchema, SleepLogInput } from '../schemas/sleepSchema';
import { Moon, Sun, Smile, Meh, Frown } from 'lucide-react-native';
import { insertSleepLog } from '../db/client';

// Initial default form values: Bedtime = 8 hours ago, Wake time = Now
const getDefaults = () => {
  const wake = new Date();
  const bed = new Date();
  bed.setHours(bed.getHours() - 8); // Default 8 hours of sleep
  return {
    bedtime: bed,
    wake_time: wake,
    memo: '',
  };
};

interface FormValues {
  bedtime: Date;
  wake_time: Date;
  memo: string;
}

export default function AddLogScreen() {
  const [showBedDate, setShowBedDate] = useState(false);
  const [showBedTime, setShowBedTime] = useState(false);
  const [showWakeDate, setShowWakeDate] = useState(false);
  const [showWakeTime, setShowWakeTime] = useState(false);
  const [mood, setMood] = useState<number | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(sleepSchema) as any,
    defaultValues: getDefaults(),
  });

  const watchBedtime = watch('bedtime');
  const watchWakeTime = watch('wake_time');
  const watchMemo = watch('memo') || '';

  // Submit Handler
  const onSubmit = (data: any) => {
    try {
      const bedtimeIso = new Date(data.bedtime).toISOString();
      const wakeTimeIso = new Date(data.wake_time).toISOString();
      const memoText = data.memo?.trim() || null;

      const diffMs = new Date(wakeTimeIso).getTime() - new Date(bedtimeIso).getTime();
      const durationSeconds = Math.max(0, Math.floor(diffMs / 1000));

      // Execute DB Insert
      insertSleepLog(bedtimeIso, wakeTimeIso, durationSeconds, memoText, mood);

      Alert.alert('記録完了', '睡眠データを手動保存しました。', [
        {
          text: 'OK',
          onPress: () => {
            reset(getDefaults());
          },
        },
      ]);
    } catch (error: any) {
      console.error('[AddLog] Failed to save manual sleep log:', error);
      Alert.alert('エラー', 'データの保存に失敗しました。');
    }
  };

  // Date/Time Format Helpers
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
            <Text style={styles.title}>手動睡眠記録</Text>
            <Text style={styles.subtitle}>
              記録を押し忘れた過去の睡眠データを追加します
            </Text>

            {/* Bedtime Section */}
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}><Moon size={20} color="#cbd5e1" style={{marginRight:4}}/><Text style={styles.label}>就寝日時</Text></View>
              <View style={styles.pickerRow}>
                {/* Date Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && { transform: [{ scale: 0.97 }] }
                  ]}
                  onPress={() => setShowBedDate(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {formatDate(watchBedtime)}
                  </Text>
                </Pressable>

                {/* Time Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && { transform: [{ scale: 0.97 }] }
                  ]}
                  onPress={() => setShowBedTime(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {formatTime(watchBedtime)}
                  </Text>
                </Pressable>
              </View>

              {errors.bedtime && (
                <Text style={styles.errorText}>
                  {String(errors.bedtime.message)}
                </Text>
              )}
            </View>

            {/* Wake Time Section */}
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}><Sun size={20} color="#cbd5e1" style={{marginRight:4}}/><Text style={styles.label}>起床日時</Text></View>
              <View style={styles.pickerRow}>
                {/* Date Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && { transform: [{ scale: 0.97 }] }
                  ]}
                  onPress={() => setShowWakeDate(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {formatDate(watchWakeTime)}
                  </Text>
                </Pressable>

                {/* Time Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && { transform: [{ scale: 0.97 }] }
                  ]}
                  onPress={() => setShowWakeTime(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {formatTime(watchWakeTime)}
                  </Text>
                </Pressable>
              </View>

              {errors.wake_time && (
                <Text style={styles.errorText}>
                  {String(errors.wake_time.message)}
                </Text>
              )}
            </View>

            {/* Mood Section */}
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

            {/* Memo Section */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>メモ</Text>
              <Controller
                control={control}
                name="memo"
                render={({ field: { onChange, value, onBlur } }) => (
                  <TextInput
                    style={styles.memoInput}
                    placeholder="例: よく眠れた、少し夜更かしした等"
                    placeholderTextColor="#64748b"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    maxLength={100}
                    multiline
                    blurOnSubmit
                    returnKeyType="done"
                  />
                )}
              />
              <View style={styles.memoFooter}>
                {errors.memo ? (
                  <Text style={styles.errorText}>{String(errors.memo.message)}</Text>
                ) : (
                  <View />
                )}
                <Text style={styles.charCount}>{watchMemo.length} / 100</Text>
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.buttonSubmit,
                isSubmitting && styles.buttonDisabled,
                pressed && !isSubmitting && { transform: [{ scale: 0.95 }] }
              ]}
              disabled={isSubmitting}
              onPress={handleSubmit(onSubmit)}
            >
              <Text style={styles.buttonSubmitText}>
                {isSubmitting ? '保存中...' : '記録を保存する'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

      {/* ===== DateTimePicker: iOS uses Modal wrapper with dark theme + 完了 button, Android uses native dialog ===== */}
      {showBedDate && (
        Platform.OS === 'ios' ? (
          <Modal transparent visible={showBedDate} animationType="slide" onRequestClose={() => setShowBedDate(false)}>
            <View style={styles.dtpOverlay}>
              <Pressable style={styles.dtpDismissArea} onPress={() => setShowBedDate(false)} />
              <View style={styles.dtpContent}>
                <View style={styles.dtpHeader}>
                  <Text style={styles.dtpHeaderTitle}>就寝日を選択</Text>
                  <Pressable style={({ pressed }) => [styles.dtpDoneButton, pressed && { opacity: 0.7 }]} onPress={() => setShowBedDate(false)}>
                    <Text style={styles.dtpDoneButtonText}>完了</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={watchBedtime}
                  mode="date"
                  display="spinner"
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(watchBedtime);
                      current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                      setValue('bedtime', current, { shouldValidate: true });
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={watchBedtime}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowBedDate(false);
              if (selectedDate) {
                const current = new Date(watchBedtime);
                current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                setValue('bedtime', current, { shouldValidate: true });
              }
            }}
          />
        )
      )}
      {showBedTime && (
        Platform.OS === 'ios' ? (
          <Modal transparent visible={showBedTime} animationType="slide" onRequestClose={() => setShowBedTime(false)}>
            <View style={styles.dtpOverlay}>
              <Pressable style={styles.dtpDismissArea} onPress={() => setShowBedTime(false)} />
              <View style={styles.dtpContent}>
                <View style={styles.dtpHeader}>
                  <Text style={styles.dtpHeaderTitle}>就寝時刻を選択</Text>
                  <Pressable style={({ pressed }) => [styles.dtpDoneButton, pressed && { opacity: 0.7 }]} onPress={() => setShowBedTime(false)}>
                    <Text style={styles.dtpDoneButtonText}>完了</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={watchBedtime}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(watchBedtime);
                      current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                      setValue('bedtime', current, { shouldValidate: true });
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={watchBedtime}
            mode="time"
            display="default"
            onChange={(event, selectedDate) => {
              setShowBedTime(false);
              if (selectedDate) {
                const current = new Date(watchBedtime);
                current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                setValue('bedtime', current, { shouldValidate: true });
              }
            }}
          />
        )
      )}
      {showWakeDate && (
        Platform.OS === 'ios' ? (
          <Modal transparent visible={showWakeDate} animationType="slide" onRequestClose={() => setShowWakeDate(false)}>
            <View style={styles.dtpOverlay}>
              <Pressable style={styles.dtpDismissArea} onPress={() => setShowWakeDate(false)} />
              <View style={styles.dtpContent}>
                <View style={styles.dtpHeader}>
                  <Text style={styles.dtpHeaderTitle}>起床日を選択</Text>
                  <Pressable style={({ pressed }) => [styles.dtpDoneButton, pressed && { opacity: 0.7 }]} onPress={() => setShowWakeDate(false)}>
                    <Text style={styles.dtpDoneButtonText}>完了</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={watchWakeTime}
                  mode="date"
                  display="spinner"
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(watchWakeTime);
                      current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                      setValue('wake_time', current, { shouldValidate: true });
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={watchWakeTime}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowWakeDate(false);
              if (selectedDate) {
                const current = new Date(watchWakeTime);
                current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                setValue('wake_time', current, { shouldValidate: true });
              }
            }}
          />
        )
      )}
      {showWakeTime && (
        Platform.OS === 'ios' ? (
          <Modal transparent visible={showWakeTime} animationType="slide" onRequestClose={() => setShowWakeTime(false)}>
            <View style={styles.dtpOverlay}>
              <Pressable style={styles.dtpDismissArea} onPress={() => setShowWakeTime(false)} />
              <View style={styles.dtpContent}>
                <View style={styles.dtpHeader}>
                  <Text style={styles.dtpHeaderTitle}>起床時刻を選択</Text>
                  <Pressable style={({ pressed }) => [styles.dtpDoneButton, pressed && { opacity: 0.7 }]} onPress={() => setShowWakeTime(false)}>
                    <Text style={styles.dtpDoneButtonText}>完了</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={watchWakeTime}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(watchWakeTime);
                      current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                      setValue('wake_time', current, { shouldValidate: true });
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={watchWakeTime}
            mode="time"
            display="default"
            onChange={(event, selectedDate) => {
              setShowWakeTime(false);
              if (selectedDate) {
                const current = new Date(watchWakeTime);
                current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                setValue('wake_time', current, { shouldValidate: true });
              }
            }}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  flex: {
    flex: 1,
  },
  scrollContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 20,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 10,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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

  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerButton: {
    flex: 0.48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1e293b', // Slate 800
    borderWidth: 1,
    borderColor: '#334155', // Slate 700
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerButtonText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  memoInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#f1f5f9',
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
  },
  memoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: '#64748b',
  },
  errorText: {
    color: '#ef4444', // Red 500
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  buttonSubmit: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#6366f1', // Indigo 500
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  buttonSubmitText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  dtpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dtpDismissArea: {
    flex: 1,
  },
  dtpContent: {
    backgroundColor: '#1e293b', // Slate 800
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dtpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  dtpHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  dtpDoneButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  dtpDoneButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366f1', // Indigo 500
  },
});
