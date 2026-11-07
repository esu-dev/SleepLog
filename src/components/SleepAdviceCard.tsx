import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Moon, Clock, Sunrise, Smile, Frown, Sparkles, Lightbulb, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { SleepAnalysisResult } from '../utils/sleepAnalysis';

interface SleepAdviceCardProps {
  analysis: SleepAnalysisResult;
}

export default function SleepAdviceCard({ analysis }: SleepAdviceCardProps) {
  // バッジの色とアイコン
  const getBadgeStyle = () => {
    switch (analysis.statusBadge.type) {
      case 'debt':
        return {
          bg: '#451a03',
          border: '#b45309',
          text: '#fcd34d',
          icon: <AlertTriangle size={13} color="#fcd34d" style={{ marginRight: 4 }} />,
        };
      case 'excess':
        return {
          bg: '#172554',
          border: '#1d4ed8',
          text: '#93c5fd',
          icon: <Clock size={13} color="#93c5fd" style={{ marginRight: 4 }} />,
        };
      case 'optimal':
        return {
          bg: '#064e3b',
          border: '#047857',
          text: '#6ee7b7',
          icon: <CheckCircle size={13} color="#6ee7b7" style={{ marginRight: 4 }} />,
        };
      default:
        return {
          bg: '#1e293b',
          border: '#475569',
          text: '#cbd5e1',
          icon: <Sparkles size={13} color="#cbd5e1" style={{ marginRight: 4 }} />,
        };
    }
  };

  const badge = getBadgeStyle();

  return (
    <View style={styles.card}>
      {/* カードヘッダー */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Sparkles size={18} color="#a855f7" style={{ marginRight: 6 }} />
          <Text style={styles.cardTitle}>今日のおすすめ睡眠プラン</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          {badge.icon}
          <Text style={[styles.badgeText, { color: badge.text }]}>
            {analysis.statusBadge.label}
          </Text>
        </View>
      </View>

      {/* サブタイトル・ヘッドライン */}
      <Text style={styles.headlineText}>{analysis.headline}</Text>

      {/* メイン推奨ボックス（就寝時刻 & 睡眠時間） */}
      <View style={styles.recBoxesRow}>
        {/* 就寝時刻 */}
        <View style={styles.recBox}>
          <View style={styles.recBoxHeader}>
            <Moon size={15} color="#818cf8" style={{ marginRight: 5 }} />
            <Text style={styles.recBoxLabel}>おすすめ就寝時刻</Text>
          </View>
          <Text style={styles.recBoxValueHighlight}>{analysis.recommendedBedtimeStr}</Text>
          <Text style={styles.recBoxSub}>起床目安: {analysis.targetWakeTimeStr}</Text>
        </View>

        {/* 睡眠時間 */}
        <View style={styles.recBox}>
          <View style={styles.recBoxHeader}>
            <Clock size={15} color="#38bdf8" style={{ marginRight: 5 }} />
            <Text style={styles.recBoxLabel}>おすすめ睡眠時間</Text>
          </View>
          <Text style={styles.recBoxValueHighlight}>{analysis.recommendedDurationStr}</Text>
          <Text style={styles.recBoxSub}>（目安サイクル）</Text>
        </View>
      </View>

      {/* 昨日の実績データ表示 */}
      {analysis.hasData && (
        <View style={styles.yesterdayDataCard}>
          <View style={styles.yesterdayHeader}>
            <Text style={styles.yesterdayTitle}>
              📊 {analysis.dateLabel}の実績データ
            </Text>
            {analysis.lastMood !== null && (
              <View style={styles.yesterdayMoodRow}>
                {analysis.lastMood === 1 ? (
                  <>
                    <Smile size={14} color="#a3e635" style={{ marginRight: 4 }} />
                    <Text style={[styles.moodLabel, { color: '#a3e635' }]}>良い目覚め</Text>
                  </>
                ) : (
                  <>
                    <Frown size={14} color="#f87171" style={{ marginRight: 4 }} />
                    <Text style={[styles.moodLabel, { color: '#f87171' }]}>すっきりしない</Text>
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.yesterdayStatsRow}>
            <View style={styles.yesterdayStatItem}>
              <Text style={styles.statSub}>就寝時刻</Text>
              <Text style={styles.statVal}>{analysis.lastBedtimeStr}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.yesterdayStatItem}>
              <Text style={styles.statSub}>起床時刻</Text>
              <Text style={styles.statVal}>{analysis.lastWakeTimeStr}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.yesterdayStatItem}>
              <Text style={styles.statSub}>合計睡眠時間</Text>
              <Text style={[styles.statVal, { color: '#38bdf8' }]}>
                {analysis.lastDurationStr}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 分析アドバイス */}
      <View style={styles.adviceSection}>
        <Text style={styles.adviceBody}>{analysis.advice}</Text>
      </View>

      {/* アドバイスTips */}
      {analysis.tips.length > 0 && (
        <View style={styles.tipsContainer}>
          {analysis.tips.map((tip, idx) => (
            <View key={idx} style={styles.tipRow}>
              <Lightbulb size={13} color="#facc15" style={styles.tipIcon} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#1e293b', // Slate 800
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 14,
  },
  recBoxesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  recBox: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  recBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  recBoxLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  recBoxValueHighlight: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 4,
  },
  recBoxSub: {
    fontSize: 10,
    color: '#64748b',
  },
  yesterdayDataCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  yesterdayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  yesterdayTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  yesterdayMoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  yesterdayStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  yesterdayStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  statSub: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#334155',
  },
  adviceSection: {
    marginBottom: 10,
  },
  adviceBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#cbd5e1',
  },
  tipsContainer: {
    backgroundColor: '#182032',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },
});

