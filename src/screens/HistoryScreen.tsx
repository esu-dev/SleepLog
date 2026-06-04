import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
  Alert,
  SafeAreaView,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { deleteSleepLog, deleteAllSleepLogs, updateSleepLog, SleepLog } from '../db/client';
import { formatLocalDateWithDay, formatLocalTime, formatDurationJapanese } from '../utils/date';
import { Smile, Meh, Frown, Edit, Trash2, Moon, Sun, Clock, AlertTriangle, Bed } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface HistoryScreenProps {
  logs: SleepLog[];
  onRefresh: () => void;
}

export default function HistoryScreen({ logs, onRefresh }: HistoryScreenProps) {

  // Handle single item deletion
  const handleDelete = (id: number) => {
    Alert.alert(
      '記録の削除',
      'この睡眠記録を削除してもよろしいですか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            try {
              deleteSleepLog(id);
              onRefresh();
            } catch (error) {
              Alert.alert('エラー', '削除に失敗しました。');
            }
          },
        },
      ]
    );
  };

  // Handle database reset
  const handleResetDatabase = () => {
    Alert.alert(
      'データベースの全削除',
      'すべての睡眠記録を削除してもよろしいですか？この操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '完全に削除する',
          style: 'destructive',
          onPress: () => {
            try {
              deleteAllSleepLogs();
              onRefresh();
              Alert.alert('削除完了', 'すべての睡眠記録を削除しました。');
            } catch (error) {
              Alert.alert('エラー', '初期化に失敗しました。');
            }
          },
        },
      ]
    );
  };

  // Editing state
  const [editingLog, setEditingLog] = React.useState<SleepLog | null>(null);
  const [editBedtime, setEditBedtime] = React.useState<Date>(new Date());
  const [editWakeTime, setEditWakeTime] = React.useState<Date>(new Date());
  const [editMood, setEditMood] = React.useState<number | null>(null);
  const [editMemo, setEditMemo] = React.useState<string>('');

  // Date/Time picker visibilities
  const [showBedDate, setShowBedDate] = React.useState(false);
  const [showBedTime, setShowBedTime] = React.useState(false);
  const [showWakeDate, setShowWakeDate] = React.useState(false);
  const [showWakeTime, setShowWakeTime] = React.useState(false);

  const handleStartEdit = (log: SleepLog) => {
    setEditingLog(log);
    setEditBedtime(new Date(log.bedtime));
    setEditWakeTime(new Date(log.wake_time));
    setEditMood(log.mood);
    setEditMemo(log.memo || '');

    setShowBedDate(false);
    setShowBedTime(false);
    setShowWakeDate(false);
    setShowWakeTime(false);
  };

  const handleSaveEdit = () => {
    if (!editingLog) return;

    const bed = new Date(editBedtime);
    const wake = new Date(editWakeTime);

    // 1. Validation: wake_time must be after bedtime
    if (wake.getTime() <= bed.getTime()) {
      Alert.alert('入力エラー', '起床時刻は就寝時刻より後の時間である必要があります。');
      return;
    }

    // 2. Validation: duration must not exceed 24 hours
    const diffMs = wake.getTime() - bed.getTime();
    const maxDurationMs = 24 * 60 * 60 * 1000;
    if (diffMs > maxDurationMs) {
      Alert.alert('入力エラー', '睡眠時間は24時間以内である必要があります。');
      return;
    }

    // 3. Validation: memo must be max 100 chars
    if (editMemo.length > 100) {
      Alert.alert('入力エラー', 'メモは100文字以内で入力してください。');
      return;
    }

    try {
      const durationSeconds = Math.floor(diffMs / 1000);
      const bedtimeIso = bed.toISOString();
      const wakeTimeIso = wake.toISOString();
      const memoText = editMemo.trim() || null;

      // Update Database
      updateSleepLog(editingLog.id, bedtimeIso, wakeTimeIso, durationSeconds, memoText, editMood);

      Alert.alert('保存完了', '睡眠データを更新しました。', [
        {
          text: 'OK',
          onPress: () => {
            setEditingLog(null);
            onRefresh();
          },
        },
      ]);
    } catch (error) {
      console.error('[History] Failed to update sleep log:', error);
      Alert.alert('エラー', 'データの更新に失敗しました。');
    }
  };

  // Render list footer button
  const renderFooter = () => {
    return (
      <View style={styles.footerContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.resetButton,
            pressed && { transform: [{ scale: 0.97 }] }
          ]}
          onPress={handleResetDatabase}
        >
          <AlertTriangle size={16} color="#ef4444" style={styles.actionIcon} />
          <Text style={styles.resetButtonText}>データベース全削除</Text>
        </Pressable>
      </View>
    );
  };

  // Render a single sleep log card
  const renderLogCard = ({ item }: { item: SleepLog }) => {
    const formattedDate = formatLocalDateWithDay(item.bedtime);
    const timeRange = `${formatLocalTime(item.bedtime)} 〜 ${formatLocalTime(item.wake_time)}`;
    const formattedDuration = formatDurationJapanese(item.duration);

    return (
      <View style={styles.logCard}>
        {/* Top line: Date and Duration pill */}
        <View style={styles.logHeader}>
          <Text style={styles.logDate}>{formattedDate}</Text>
          <View style={styles.headerRightContainer}>
            {item.mood !== null && item.mood !== undefined && (
              <View style={[
                styles.moodBadge,
                item.mood === 0 && styles.moodBadgeGood,
                item.mood === 1 && styles.moodBadgeNormal,
                item.mood === 2 && styles.moodBadgeBad
              ]}>
                {item.mood === 0 && <Smile size={16} color="#a3e635" />}
                {item.mood === 1 && <Meh size={16} color="#facc15" />}
                {item.mood === 2 && <Frown size={16} color="#ef4444" />}
              </View>
            )}
            <View style={styles.durationPill}>
              <Text style={styles.durationText}>{formattedDuration}</Text>
            </View>
          </View>
        </View>

        {/* Second line: Time Range & Bed/Moon icon */}
        <View style={styles.timeRow}>
          <View style={styles.timeLabelContainer}>
            <Clock size={14} color="#64748b" style={styles.actionIcon} />
            <Text style={styles.timeLabel}>睡眠時間</Text>
          </View>
          <Text style={styles.timeVal}>{timeRange}</Text>
        </View>

        {/* Third line: Memo if exists */}
        {item.memo ? (
          <View style={styles.memoContainer}>
            <Text style={styles.memoLabel}>MEMO</Text>
            <Text style={styles.memoText}>{item.memo}</Text>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.editButton,
              pressed && { transform: [{ scale: 0.95 }] }
            ]}
            onPress={() => handleStartEdit(item)}
          >
            <Edit size={14} color="#a5b4fc" style={styles.actionIcon} />
            <Text style={styles.editButtonText}>編集</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.deleteButton,
              pressed && { transform: [{ scale: 0.95 }] }
            ]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 size={14} color="#f87171" style={styles.actionIcon} />
            <Text style={styles.deleteButtonText}>削除</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>睡眠履歴</Text>
        <Text style={styles.subtitle}>
          これまでの睡眠記録を一覧で確認・整理できます
        </Text>
      </View>

      {logs.length === 0 ? (
        /* Beautiful Empty State */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Bed size={40} color="#64748b" />
          </View>
          <Text style={styles.emptyTitle}>データがありません</Text>
          <Text style={styles.emptyText}>
            今夜から記録を始めましょう！{'\n'}または手動追加タブから過去の睡眠を登録できます。
          </Text>

          {/* Dev DB Reset Button in Empty State */}
          <Pressable
            style={({ pressed }) => [
              styles.resetButtonEmptyState,
              pressed && { transform: [{ scale: 0.95 }] }
            ]}
            onPress={handleResetDatabase}
          >
            <AlertTriangle size={14} color="#f87171" style={styles.actionIcon} />
            <Text style={styles.resetButtonText}>DB初期化 (テスト用)</Text>
          </Pressable>
        </View>
      ) : (
        /* Shopify High-Performance FlashList */
        <View style={styles.listContainer}>
          <FlashList
            data={logs}
            renderItem={renderLogCard}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {/* Edit Sleep Log Modal */}
      <Modal
        visible={editingLog !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingLog(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalDismissArea} onPress={() => setEditingLog(null)} />
          <View style={styles.modalContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerHeaderTitle}>記録を編集</Text>
              <Pressable
                style={({ pressed }) => [styles.pickerCloseButton, pressed && { opacity: 0.7 }]}
                onPress={() => setEditingLog(null)}
              >
                <Text style={styles.pickerCloseButtonText}>キャンセル</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalFormScroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Bedtime Selection */}
              <View style={styles.modalFormGroup}>
                <View style={styles.modalLabelContainer}>
                  <Moon size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                  <Text style={styles.modalLabel}>就寝日時</Text>
                </View>
                <View style={styles.modalPickerRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalPickerButton,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                    onPress={() => setShowBedDate(true)}
                  >
                    <Text style={styles.modalPickerButtonText}>
                      {editBedtime.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalPickerButton,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                    onPress={() => setShowBedTime(true)}
                  >
                    <Text style={styles.modalPickerButtonText}>
                      {editBedtime.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Wake-up Time Selection */}
              <View style={styles.modalFormGroup}>
                <View style={styles.modalLabelContainer}>
                  <Sun size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                  <Text style={styles.modalLabel}>起床日時</Text>
                </View>
                <View style={styles.modalPickerRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalPickerButton,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                    onPress={() => setShowWakeDate(true)}
                  >
                    <Text style={styles.modalPickerButtonText}>
                      {editWakeTime.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalPickerButton,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                    onPress={() => setShowWakeTime(true)}
                  >
                    <Text style={styles.modalPickerButtonText}>
                      {editWakeTime.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Mood Selection */}
              <View style={styles.modalFormGroup}>
                <View style={styles.modalLabelContainer}>
                  <Smile size={18} color="#cbd5e1" style={{ marginRight: 6 }} />
                  <Text style={styles.modalLabel}>目覚めの気分 (任意)</Text>
                </View>
                <View style={styles.modalMoodRow}>
                  <Pressable
                    onPress={() => setEditMood(editMood === 0 ? null : 0)}
                    style={({ pressed }) => [
                      styles.modalMoodButton,
                      editMood === 0 ? styles.modalMoodActiveGood : styles.modalMoodInactive,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                  >
                    <Smile size={24} color={editMood === 0 ? '#a3e635' : '#64748b'} />
                    <Text style={[styles.modalMoodButtonText, editMood === 0 && styles.modalMoodTextActive]}>良い</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditMood(editMood === 1 ? null : 1)}
                    style={({ pressed }) => [
                      styles.modalMoodButton,
                      editMood === 1 ? styles.modalMoodActiveNormal : styles.modalMoodInactive,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                  >
                    <Meh size={24} color={editMood === 1 ? '#facc15' : '#64748b'} />
                    <Text style={[styles.modalMoodButtonText, editMood === 1 && styles.modalMoodTextActive]}>普通</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditMood(editMood === 2 ? null : 2)}
                    style={({ pressed }) => [
                      styles.modalMoodButton,
                      editMood === 2 ? styles.modalMoodActiveBad : styles.modalMoodInactive,
                      pressed && { transform: [{ scale: 0.97 }] }
                    ]}
                  >
                    <Frown size={24} color={editMood === 2 ? '#ef4444' : '#64748b'} />
                    <Text style={[styles.modalMoodButtonText, editMood === 2 && styles.modalMoodTextActive]}>悪い</Text>
                  </Pressable>
                </View>
              </View>

              {/* Memo Input */}
              <View style={styles.modalFormGroup}>
                <Text style={styles.modalLabel}>メモ</Text>
                <TextInput
                  style={styles.modalMemoInput}
                  placeholder="例: よく眠れた、少し夜更かしした等"
                  placeholderTextColor="#64748b"
                  value={editMemo}
                  onChangeText={setEditMemo}
                  maxLength={100}
                  multiline
                  blurOnSubmit
                  returnKeyType="done"
                />
                <View style={styles.modalMemoFooter}>
                  <Text style={styles.modalCharCount}>{editMemo.length} / 100</Text>
                </View>
              </View>

              {/* Submit Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.modalSaveButton,
                  pressed && { transform: [{ scale: 0.95 }] }
                ]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalSaveButtonText}>変更を保存する</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* iOS用のDateTimePicker Modalを編集Modalの中に配置する */}
        {Platform.OS === 'ios' && showBedDate && (
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
                  value={editBedtime}
                  mode="date"
                  display="spinner"
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(editBedtime);
                      current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                      setEditBedtime(current);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}
        {Platform.OS === 'ios' && showBedTime && (
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
                  value={editBedtime}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(editBedtime);
                      current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                      setEditBedtime(current);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}
        {Platform.OS === 'ios' && showWakeDate && (
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
                  value={editWakeTime}
                  mode="date"
                  display="spinner"
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(editWakeTime);
                      current.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                      setEditWakeTime(current);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}
        {Platform.OS === 'ios' && showWakeTime && (
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
                  value={editWakeTime}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  textColor="#f8fafc"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      const current = new Date(editWakeTime);
                      current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                      setEditWakeTime(current);
                    }
                  }}
                />
              </View>
            </View>
          </Modal>
        )}
      </Modal>

      {/* ===== DateTimePicker: Rendered outside Modal at SafeAreaView root level to prevent z-index issues on Android ===== */}
      {Platform.OS !== 'ios' && showBedDate && (
        <DateTimePicker
          value={editBedtime}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowBedDate(false);
            if (selectedDate) {
              const current = new Date(editBedtime);
              current.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate()
              );
              setEditBedtime(current);
            }
          }}
        />
      )}
      {Platform.OS !== 'ios' && showBedTime && (
        <DateTimePicker
          value={editBedtime}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            setShowBedTime(false);
            if (selectedDate) {
              const current = new Date(editBedtime);
              current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
              setEditBedtime(current);
            }
          }}
        />
      )}
      {Platform.OS !== 'ios' && showWakeDate && (
        <DateTimePicker
          value={editWakeTime}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowWakeDate(false);
            if (selectedDate) {
              const current = new Date(editWakeTime);
              current.setFullYear(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate()
              );
              setEditWakeTime(current);
            }
          }}
        />
      )}
      {Platform.OS !== 'ios' && showWakeTime && (
        <DateTimePicker
          value={editWakeTime}
          mode="time"
          display="default"
          onChange={(event, selectedDate) => {
            setShowWakeTime(false);
            if (selectedDate) {
              const current = new Date(editWakeTime);
              current.setHours(selectedDate.getHours(), selectedDate.getMinutes());
              setEditWakeTime(current);
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  listContainer: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logCard: {
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155', // Slate 700
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodBadge: {
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodBadgeGood: {
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderColor: 'rgba(163, 230, 53, 0.3)',
  },
  moodBadgeNormal: {
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  moodBadgeBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  durationPill: {
    backgroundColor: '#312e81', // Indigo 900
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4f46e5', // Indigo 600
  },
  durationText: {
    color: '#a5b4fc', // Indigo 300
    fontSize: 13,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  timeVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  memoContainer: {
    backgroundColor: '#0f172a', // Slate 900 inside card
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // Indigo accent line
  },
  memoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4f46e5',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  memoText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: '#4f46e5',
  },
  editButtonText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
  },
  actionIcon: {
    marginRight: 6,
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
    maxHeight: '90%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  pickerHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  pickerCloseButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  pickerCloseButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  modalFormScroll: {
    paddingBottom: 24,
  },
  modalFormGroup: {
    marginBottom: 20,
  },
  modalLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  modalPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalPickerButton: {
    flex: 0.48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPickerButtonText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
  },
  modalMoodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  modalMoodButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  modalMoodInactive: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    opacity: 0.6,
  },
  modalMoodActiveGood: {
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderColor: '#a3e635',
  },
  modalMoodActiveNormal: {
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderColor: '#facc15',
  },
  modalMoodActiveBad: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
  },
  modalMoodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 6,
  },
  modalMoodTextActive: {
    color: '#f8fafc',
    fontWeight: '800',
  },
  modalMemoInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    color: '#f1f5f9',
    fontSize: 15,
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalMemoFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6,
  },
  modalCharCount: {
    fontSize: 12,
    color: '#64748b',
  },
  modalSaveButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  /* Empty State Styles */
  emptyContainer: {
    flex: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e2e8f0',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  footerContainer: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
    width: '100%',
  },
  resetButton: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  resetButtonEmptyState: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderColor: '#7f1d1d',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  resetButtonText: {
    color: '#f87171',
    fontSize: 13,
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
