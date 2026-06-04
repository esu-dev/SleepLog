import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { SleepLog } from '../db/client';
import { formatDurationJapanese } from '../utils/date';
import { CheckCircle, AlertTriangle, Lightbulb, Smile, Meh, Frown, ChevronLeft, ChevronRight, Moon, Sunrise, Star, TrendingUp, Info } from 'lucide-react-native';

interface StatsScreenProps {
  logs: SleepLog[];
}

interface DailyStat {
  dateLabel: string;        // "5/20"
  dayLabel: string;         // "水"
  hours: number;            // 7.5
  seconds: number;          // 27000
  isoDateString: string;    // "YYYY-MM-DD"
  mood: number | null;
  // Timeline fields (representative record = longest duration for the day)
  bedtimeLabel: string | null;     // "23:30"
  wakeLabel: string | null;        // "07:15"
  bedtimeNorm: number | null;      // normalized hour in [TIMELINE_START, TIMELINE_END]
  wakeNorm: number | null;
}

// ---- Timeline config ----
// Display window: 20:00 to 14:00 next day (18 hours)
const TL_START = 20;  // 20:00
const TL_END = 38;    // 14:00 next day (14 + 24)
const TL_SPAN = TL_END - TL_START; // 18 hours

const TL_TICKS = [20, 23, 26, 29, 32, 35, 38]; // every 3h: 20,23,02,05,08,11,14
const tickLabel = (h: number) => {
  const normalized = h % 24;
  return `${normalized.toString().padStart(2, '0')}:00`;
};

/** Normalize a clock hour to the timeline coordinate space */
const normalizeHour = (date: Date): number => {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  // Hours before 14:00 (14) are treated as next-day → add 24
  return h < 14 ? h + 24 : h;
};

const fmt2 = (n: number) => n.toString().padStart(2, '0');

// ============================================================
// Sleep Insight: compute recommended bedtime & wake time
// from all "良い" (mood=0) records using circular mean
// ============================================================

const MIN_GOOD_RECORDS = 3; // minimum samples needed

interface SleepInsight {
  hasSufficientData: boolean;
  goodCount: number;          // number of good-mood records used
  totalCount: number;
  recBedtime: string | null;  // "23:15"
  recWakeTime: string | null; // "07:30"
  recDuration: number | null; // avg duration in seconds
  confidence: 'high' | 'medium' | 'low'; // based on sample size
}

/**
 * Circular (vector) mean of hour values expressed in radians.
 * Prevents the "average of 23:00 and 01:00 = 12:00" problem.
 */
function circularMeanHour(hours: number[]): number {
  // Map each hour (0-24) to angle [0, 2π]
  const toRad = (h: number) => (h / 24) * 2 * Math.PI;
  let sinSum = 0;
  let cosSum = 0;
  for (const h of hours) {
    sinSum += Math.sin(toRad(h));
    cosSum += Math.cos(toRad(h));
  }
  const meanRad = Math.atan2(sinSum / hours.length, cosSum / hours.length);
  // Convert back to hours [0, 24)
  const meanH = (meanRad / (2 * Math.PI)) * 24;
  return meanH < 0 ? meanH + 24 : meanH;
}

function computeSleepInsight(logs: SleepLog[]): SleepInsight {
  const goodLogs = logs.filter((l) => l.mood === 0 && l.bedtime && l.wake_time && l.duration > 0);

  const totalCount = logs.filter((l) => l.bedtime && l.wake_time).length;
  const goodCount = goodLogs.length;

  if (goodCount < MIN_GOOD_RECORDS) {
    return { hasSufficientData: false, goodCount, totalCount, recBedtime: null, recWakeTime: null, recDuration: null, confidence: 'low' };
  }

  // Collect bedtime hours and wake hours
  const bedHours: number[] = [];
  const wakeHours: number[] = [];
  let durationSum = 0;

  for (const log of goodLogs) {
    const bed = new Date(log.bedtime);
    const wake = new Date(log.wake_time);
    bedHours.push(bed.getHours() + bed.getMinutes() / 60);
    wakeHours.push(wake.getHours() + wake.getMinutes() / 60);
    durationSum += log.duration;
  }

  const avgBedH = circularMeanHour(bedHours);
  const avgWakeH = circularMeanHour(wakeHours);
  const avgDuration = Math.round(durationSum / goodCount);

  const bedTotalMins = Math.round(avgBedH * 60);
  const bedH = Math.floor(bedTotalMins / 60) % 24;
  const bedM = bedTotalMins % 60;

  const wakeTotalMins = Math.round(avgWakeH * 60);
  const wakeH = Math.floor(wakeTotalMins / 60) % 24;
  const wakeM = wakeTotalMins % 60;

  const confidence: SleepInsight['confidence'] =
    goodCount >= 14 ? 'high' : goodCount >= 7 ? 'medium' : 'low';

  return {
    hasSufficientData: true,
    goodCount,
    totalCount,
    recBedtime: `${fmt2(bedH)}:${fmt2(bedM)}`,
    recWakeTime: `${fmt2(wakeH)}:${fmt2(wakeM)}`,
    recDuration: avgDuration,
    confidence,
  };
}

export default function StatsScreen({ logs }: StatsScreenProps) {
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Generate 7-day window ending at (today + offset*7)
  const getWeekDays = (offset: number): DailyStat[] => {
    const stats: DailyStat[] = [];
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    const anchorDate = new Date(today);
    anchorDate.setDate(today.getDate() + offset * 7);

    for (let i = 6; i >= 0; i--) {
      const date = new Date(anchorDate);
      date.setDate(anchorDate.getDate() - i);

      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const isoDateString = `${year}-${month}-${day}`;

      stats.push({
        dateLabel: `${date.getMonth() + 1}/${date.getDate()}`,
        dayLabel: weekdays[date.getDay()],
        hours: 0,
        seconds: 0,
        isoDateString,
        mood: null,
        bedtimeLabel: null,
        wakeLabel: null,
        bedtimeNorm: null,
        wakeNorm: null,
      });
    }
    return stats;
  };

  const dailyStats = getWeekDays(weekOffset);

  // Map logs → daily stats (keep representative = longest-duration log per day)
  const representativeLog: Map<string, SleepLog> = new Map();

  logs.forEach((log) => {
    const logDate = new Date(log.bedtime);
    const logLocalStr = `${logDate.getFullYear()}-${fmt2(logDate.getMonth() + 1)}-${fmt2(logDate.getDate())}`;

    const matchedDay = dailyStats.find((d) => d.isoDateString === logLocalStr);
    if (matchedDay) {
      matchedDay.seconds += log.duration;
      matchedDay.hours = matchedDay.seconds / 3600;
      if (matchedDay.mood === null && log.mood !== null && log.mood !== undefined) {
        matchedDay.mood = log.mood;
      }
      // Track representative (longest) record
      const prev = representativeLog.get(logLocalStr);
      if (!prev || log.duration > prev.duration) {
        representativeLog.set(logLocalStr, log);
      }
    }
  });

  // Populate timeline fields from representative log
  dailyStats.forEach((stat) => {
    const rep = representativeLog.get(stat.isoDateString);
    if (rep) {
      const bedDate = new Date(rep.bedtime);
      const wakeDate = new Date(rep.wake_time);

      stat.bedtimeLabel = `${fmt2(bedDate.getHours())}:${fmt2(bedDate.getMinutes())}`;
      stat.wakeLabel = `${fmt2(wakeDate.getHours())}:${fmt2(wakeDate.getMinutes())}`;

      const bedNorm = normalizeHour(bedDate);
      const wakeNorm = normalizeHour(wakeDate);

      // Only draw if within our display window
      stat.bedtimeNorm = Math.max(TL_START, Math.min(TL_END, bedNorm));
      stat.wakeNorm = Math.max(TL_START, Math.min(TL_END, wakeNorm));
    }
  });

  // Stats summary
  const recordedDays = dailyStats.filter((d) => d.seconds > 0);
  const totalSeconds = recordedDays.reduce((acc, curr) => acc + curr.seconds, 0);
  const averageSeconds = recordedDays.length > 0 ? Math.floor(totalSeconds / recordedDays.length) : 0;
  const maxHours = Math.max(8, ...dailyStats.map((d) => d.hours));

  // Week nav
  const isCurrentWeek = weekOffset === 0;
  const weekRangeLabel = `${dailyStats[0]?.dateLabel ?? ''} 〜 ${dailyStats[6]?.dateLabel ?? ''}`;

  const handlePrevWeek = () => { setWeekOffset((p) => p - 1); setSelectedBarIndex(null); };
  const handleNextWeek = () => { if (weekOffset < 0) { setWeekOffset((p) => p + 1); setSelectedBarIndex(null); } };

  // Sleep Insight (全データから計算、週次に依存しない)
  const insight = computeSleepInsight(logs);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>睡眠統計</Text>
          <Text style={styles.subtitle}>週ごとの睡眠リズムを分析・可視化します</Text>
        </View>

        {/* ===== Personal Sleep Insight Card ===== */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <Star size={16} color="#fbbf24" style={{ marginRight: 6 }} />
            <Text style={styles.insightTitle}>パーソナル睡眠アドバイス</Text>
            {insight.hasSufficientData && (
              <View style={[
                styles.confidenceBadge,
                insight.confidence === 'high' && styles.confidenceBadgeHigh,
                insight.confidence === 'medium' && styles.confidenceBadgeMedium,
                insight.confidence === 'low' && styles.confidenceBadgeLow,
              ]}>
                <Text style={styles.confidenceBadgeText}>
                  {insight.confidence === 'high' ? '高信頼度' : insight.confidence === 'medium' ? '中信頼度' : '低信頼度'}
                </Text>
              </View>
            )}
          </View>

          {insight.hasSufficientData ? (
            <>
              <Text style={styles.insightSubtitle}>
                「気分: 良い」の{insight.goodCount}件のデータから、あなたに最適な睡眠パターンを推測しました。
              </Text>

              <View style={styles.insightTimeRow}>
                {/* Bedtime */}
                <View style={styles.insightTimeCard}>
                  <View style={styles.insightTimeIconRow}>
                    <Moon size={18} color="#818cf8" />
                    <Text style={styles.insightTimeTypeLabel}>推奨就寝時刻</Text>
                  </View>
                  <Text style={styles.insightTimeValue}>{insight.recBedtime}</Text>
                </View>

                <View style={styles.insightArrow}>
                  <Text style={styles.insightArrowText}>→</Text>
                </View>

                {/* Wake time */}
                <View style={styles.insightTimeCard}>
                  <View style={styles.insightTimeIconRow}>
                    <Sunrise size={18} color="#fb923c" />
                    <Text style={styles.insightTimeTypeLabel}>推奨起床時刻</Text>
                  </View>
                  <Text style={styles.insightTimeValue}>{insight.recWakeTime}</Text>
                </View>
              </View>

              {insight.recDuration !== null && (
                <View style={styles.insightDurationRow}>
                  <TrendingUp size={13} color="#34d399" style={{ marginRight: 4 }} />
                  <Text style={styles.insightDurationText}>
                    このパターンの平均睡眠時間: {formatDurationJapanese(insight.recDuration)}
                  </Text>
                </View>
              )}

              <View style={styles.insightFooterRow}>
                <Info size={11} color="#475569" style={{ marginRight: 4 }} />
                <Text style={styles.insightFooterText}>
                  全{insight.totalCount}件中{insight.goodCount}件の「良い」データをもとに円形統計で算出。
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.insightNoData}>
              <Text style={styles.insightNoDataTitle}>データが不足しています</Text>
              <Text style={styles.insightNoDataText}>
                「気分: 良い」で記録された睡眠が{MIN_GOOD_RECORDS}件以上あると、
                あなたに最適な就寝・起床時刻を推測できます。{`\n`}
                現在: {insight.goodCount} / {MIN_GOOD_RECORDS}件
              </Text>
            </View>
          )}
        </View>

        {/* Week Navigation */}
        <View style={styles.weekNavCard}>
          <TouchableOpacity style={styles.weekNavButton} onPress={handlePrevWeek} activeOpacity={0.7}>
            <ChevronLeft size={20} color="#a5b4fc" />
          </TouchableOpacity>
          <View style={styles.weekNavCenter}>
            {isCurrentWeek ? (
              <View style={styles.currentWeekBadge}>
                <Text style={styles.currentWeekBadgeText}>今週</Text>
              </View>
            ) : (
              <Text style={styles.weekOffsetLabel}>
                {weekOffset === -1 ? '先週' : `${Math.abs(weekOffset)}週前`}
              </Text>
            )}
            <Text style={styles.weekRangeLabel}>{weekRangeLabel}</Text>
          </View>
          <TouchableOpacity
            style={[styles.weekNavButton, weekOffset >= 0 && styles.weekNavButtonDisabled]}
            onPress={handleNextWeek}
            disabled={weekOffset >= 0}
            activeOpacity={0.7}
          >
            <ChevronRight size={20} color={weekOffset >= 0 ? '#334155' : '#a5b4fc'} />
          </TouchableOpacity>
        </View>

        {/* Highlights Card */}
        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>平均睡眠時間 (記録のある日のみ)</Text>
          <Text style={styles.highlightValue}>
            {averageSeconds > 0 ? formatDurationJapanese(averageSeconds) : 'データなし'}
          </Text>
          <View style={styles.highlightSubRow}>
            <Text style={styles.highlightSubText}>期間内の総記録数: {recordedDays.length}回</Text>
            {averageSeconds > 0 && (
              <View style={styles.healthyIndicatorContainer}>
                {averageSeconds >= 6 * 3600 ? (
                  <>
                    <CheckCircle size={14} color="#10b981" style={styles.indicatorIcon} />
                    <Text style={[styles.healthyIndicator, styles.healthyIndicatorGood]}>良好な睡眠</Text>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} color="#f59e0b" style={styles.indicatorIcon} />
                    <Text style={[styles.healthyIndicator, styles.healthyIndicatorBad]}>睡眠不足気味</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Bar Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartCardTitle}>睡眠時間グラフ</Text>
          <Text style={styles.chartHelpText}>※棒グラフをタップすると各日の詳細が表示されます。</Text>

          {/* Tooltip */}
          <View style={styles.tooltipHeightSpacer}>
            {selectedBarIndex !== null && (() => {
              const sel = dailyStats[selectedBarIndex];
              return (
                <View style={styles.tooltipContainer}>
                  <Text style={styles.tooltipTitle}>
                    {sel.dateLabel} ({sel.dayLabel})
                  </Text>
                  <View style={styles.tooltipRow}>
                    <Text style={styles.tooltipValue}>
                      {sel.seconds > 0 ? formatDurationJapanese(sel.seconds) : '睡眠記録なし'}
                    </Text>
                    {sel.mood !== null && (
                      <View style={styles.tooltipMoodBadge}>
                        {sel.mood === 0 && <Smile size={14} color="#a3e635" />}
                        {sel.mood === 1 && <Meh size={14} color="#facc15" />}
                        {sel.mood === 2 && <Frown size={14} color="#ef4444" />}
                        <Text style={[
                          styles.tooltipMoodText,
                          sel.mood === 0 && { color: '#a3e635' },
                          sel.mood === 1 && { color: '#facc15' },
                          sel.mood === 2 && { color: '#ef4444' },
                        ]}>
                          {sel.mood === 0 ? '良い' : sel.mood === 1 ? '普通' : '悪い'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {/* Bedtime / Wake time row */}
                  {sel.bedtimeLabel && sel.wakeLabel && (
                    <View style={styles.tooltipTimeRow}>
                      <View style={styles.tooltipTimeItem}>
                        <Moon size={11} color="#818cf8" />
                        <Text style={styles.tooltipTimeLabel}>{sel.bedtimeLabel}</Text>
                      </View>
                      <Text style={styles.tooltipTimeSep}>→</Text>
                      <View style={styles.tooltipTimeItem}>
                        <Sunrise size={11} color="#fb923c" />
                        <Text style={styles.tooltipTimeLabel}>{sel.wakeLabel}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>

          {/* Chart Canvas */}
          <View style={styles.chartCanvas}>
            <View style={styles.gridLinesContainer}>
              <View style={[styles.gridLine, { bottom: '25%' }]} />
              <View style={[styles.gridLine, { bottom: '50%' }]} />
              <View style={[styles.gridLine, { bottom: '75%' }]} />
              <View style={[styles.gridLine, { bottom: '100%' }]} />
            </View>
            <View style={styles.barsRow}>
              {dailyStats.map((stat, idx) => {
                const barHeightPct = `${Math.min(100, (stat.hours / maxHours) * 100)}%` as any;
                const isSelected = selectedBarIndex === idx;
                return (
                  <Pressable
                    key={stat.isoDateString}
                    style={({ pressed }) => [styles.barColumn, pressed && { transform: [{ scale: 0.95 }] }]}
                    onPress={() => setSelectedBarIndex(isSelected ? null : idx)}
                  >
                    <View style={styles.moodIconContainer}>
                      {stat.mood === 0 && <Smile size={16} color="#a3e635" />}
                      {stat.mood === 1 && <Meh size={16} color="#facc15" />}
                      {stat.mood === 2 && <Frown size={16} color="#ef4444" />}
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[
                        styles.barFill,
                        { height: barHeightPct },
                        isSelected && styles.barFillSelected,
                        stat.seconds === 0 && styles.barFillEmpty,
                      ]} />
                    </View>
                    <Text style={[styles.dayLabel, isSelected && styles.labelSelected]}>{stat.dayLabel}</Text>
                    <Text style={styles.dateLabel}>{stat.dateLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Legends */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#6366f1' }]} />
              <Text style={styles.legendText}>睡眠あり</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: '#334155', borderWidth: 1, borderColor: '#475569' }]} />
              <Text style={styles.legendText}>記録なし</Text>
            </View>
          </View>
          <View style={styles.moodLegendRow}>
            <View style={styles.legendItem}>
              <Smile size={12} color="#a3e635" /><Text style={[styles.legendText, { marginLeft: 4 }]}>良い</Text>
            </View>
            <View style={styles.legendItem}>
              <Meh size={12} color="#facc15" /><Text style={[styles.legendText, { marginLeft: 4 }]}>普通</Text>
            </View>
            <View style={styles.legendItem}>
              <Frown size={12} color="#ef4444" /><Text style={[styles.legendText, { marginLeft: 4 }]}>悪い</Text>
            </View>
          </View>
        </View>

        {/* ===== Sleep Timeline Card ===== */}
        <View style={styles.chartCard}>
          <Text style={styles.chartCardTitle}>就寝・起床タイムライン</Text>
          <Text style={styles.chartHelpText}>各日の就寝〜起床の時間帯を横軸で可視化します。</Text>

          {/* Timeline header: time ticks */}
          <View style={styles.tlTickRow}>
            {TL_TICKS.map((h) => (
              <Text key={h} style={styles.tlTickLabel}>{tickLabel(h)}</Text>
            ))}
          </View>

          {/* One row per day */}
          {dailyStats.map((stat, idx) => {
            const hasSleep = stat.bedtimeNorm !== null && stat.wakeNorm !== null;
            const leftPct = hasSleep ? ((stat.bedtimeNorm! - TL_START) / TL_SPAN) * 100 : 0;
            const widthPct = hasSleep ? ((stat.wakeNorm! - stat.bedtimeNorm!) / TL_SPAN) * 100 : 0;

            return (
              <View key={stat.isoDateString} style={styles.tlRow}>
                {/* Day label */}
                <View style={styles.tlDayLabel}>
                  <Text style={styles.tlDayText}>{stat.dayLabel}</Text>
                  <Text style={styles.tlDateText}>{stat.dateLabel}</Text>
                </View>

                {/* Track */}
                <View style={styles.tlTrack}>
                  {/* Midnight marker */}
                  <View style={[styles.tlMidnightLine, { left: `${((24 - TL_START) / TL_SPAN) * 100}%` as any }]} />

                  {hasSleep ? (
                    <View
                      style={[
                        styles.tlBar,
                        {
                          left: `${leftPct}%` as any,
                          width: `${Math.max(widthPct, 2)}%` as any,
                        },
                      ]}
                    >
                      {/* Moon dot at start */}
                      <View style={styles.tlBedDot} />
                      {/* Wake dot at end */}
                      <View style={styles.tlWakeDot} />
                    </View>
                  ) : (
                    <View style={styles.tlNoData}>
                      <Text style={styles.tlNoDataText}>-</Text>
                    </View>
                  )}
                </View>

                {/* Time labels */}
                <View style={styles.tlTimeLabelCol}>
                  {hasSleep ? (
                    <>
                      <View style={styles.tlTimeLabelRow}>
                        <Moon size={9} color="#818cf8" />
                        <Text style={styles.tlBedLabel}>{stat.bedtimeLabel}</Text>
                      </View>
                      <View style={styles.tlTimeLabelRow}>
                        <Sunrise size={9} color="#fb923c" />
                        <Text style={styles.tlWakeLabel}>{stat.wakeLabel}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.tlNoDataText}>—</Text>
                  )}
                </View>
              </View>
            );
          })}

          {/* Timeline footer legend */}
          <View style={styles.tlLegendRow}>
            <View style={styles.tlLegendItem}>
              <View style={styles.tlLegendBar} />
              <Text style={styles.legendText}>睡眠時間帯</Text>
            </View>
            <View style={styles.tlLegendItem}>
              <View style={styles.tlMidnightLineLegend} />
              <Text style={styles.legendText}>深夜0時</Text>
            </View>
            <View style={styles.tlLegendItem}>
              <Moon size={11} color="#818cf8" />
              <Text style={[styles.legendText, { marginLeft: 3 }]}>就寝</Text>
            </View>
            <View style={styles.tlLegendItem}>
              <Sunrise size={11} color="#fb923c" />
              <Text style={[styles.legendText, { marginLeft: 3 }]}>起床</Text>
            </View>
          </View>
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeaderRow}>
            <Lightbulb size={16} color="#a5b4fc" style={styles.tipsIcon} />
            <Text style={styles.tipsTitle}>睡眠の豆知識</Text>
          </View>
          <Text style={styles.tipsContent}>
            成人の推奨睡眠時間は一般的に7〜8時間とされています。睡眠時間だけでなく、「就寝・起床時刻の一貫性」も睡眠の質を大きく左右します。週末もできるだけ同じ時間に眠り、起きることを心がけましょう。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
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
  // ---- Week Navigation ----
  weekNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  weekNavButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  weekNavButtonDisabled: {
    opacity: 0.3,
  },
  weekNavCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentWeekBadge: {
    backgroundColor: '#312e81',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#6366f1',
    marginBottom: 4,
  },
  currentWeekBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#a5b4fc',
    letterSpacing: 0.5,
  },
  weekOffsetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 2,
  },
  weekRangeLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  // ---- Highlights Card ----
  highlightCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  highlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  highlightValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#38bdf8',
    marginBottom: 10,
  },
  highlightSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  highlightSubText: {
    fontSize: 12,
    color: '#64748b',
  },
  healthyIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  indicatorIcon: {
    marginRight: 4,
  },
  healthyIndicator: {
    fontSize: 12,
    fontWeight: '700',
  },
  healthyIndicatorGood: {
    color: '#10b981',
  },
  healthyIndicatorBad: {
    color: '#f59e0b',
  },
  // ---- Chart Card (shared by both charts) ----
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  chartCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  chartHelpText: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 14,
  },
  // ---- Tooltip ----
  tooltipHeightSpacer: {
    height: 72,
    justifyContent: 'center',
    marginBottom: 12,
  },
  tooltipContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  tooltipTitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  tooltipMoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: '#1e293b',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tooltipMoodText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },
  tooltipTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  tooltipTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tooltipTimeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    marginLeft: 3,
  },
  tooltipTimeSep: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  // ---- Bar Chart ----
  chartCanvas: {
    height: 230,
    position: 'relative',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  moodIconContainer: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  gridLinesContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    height: '100%',
    zIndex: 2,
  },
  barColumn: {
    alignItems: 'center',
    width: '12%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    height: '75%',
    width: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#6366f1',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  barFillSelected: {
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
  },
  barFillEmpty: {
    height: 6,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 3,
    shadowOpacity: 0,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 8,
  },
  labelSelected: {
    color: '#38bdf8',
    fontWeight: '900',
  },
  dateLabel: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  moodLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  // ---- Sleep Timeline ----
  tlTickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 46,  // align with track (day label width)
    paddingRight: 58, // align with time label column
    marginBottom: 6,
  },
  tlTickLabel: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tlDayLabel: {
    width: 38,
    alignItems: 'flex-end',
    marginRight: 8,
  },
  tlDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  tlDateText: {
    fontSize: 9,
    color: '#475569',
  },
  tlTrack: {
    flex: 1,
    height: 22,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    position: 'relative',
    justifyContent: 'center',
  },
  tlMidnightLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#334155',
    zIndex: 1,
  },
  tlBar: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  tlBedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#818cf8',
    marginLeft: 2,
  },
  tlWakeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fb923c',
    marginRight: 2,
  },
  tlNoData: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlNoDataText: {
    fontSize: 10,
    color: '#334155',
  },
  tlTimeLabelCol: {
    width: 50,
    marginLeft: 6,
    justifyContent: 'center',
  },
  tlTimeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tlBedLabel: {
    fontSize: 9,
    color: '#818cf8',
    fontWeight: '700',
    marginLeft: 2,
  },
  tlWakeLabel: {
    fontSize: 9,
    color: '#fb923c',
    fontWeight: '700',
    marginLeft: 2,
  },
  tlLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
    gap: 12,
  },
  tlLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tlLegendBar: {
    width: 20,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#4f46e5',
  },
  tlMidnightLineLegend: {
    width: 2,
    height: 14,
    backgroundColor: '#334155',
    borderRadius: 1,
  },
  // ---- Tips Card ----
  tipsCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  tipsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsIcon: {
    marginRight: 6,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#a5b4fc',
  },
  tipsContent: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  // ---- Insight Card ----
  insightCard: {
    backgroundColor: '#1c1a0e',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#78350f',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fbbf24',
    flex: 1,
  },
  insightSubtitle: {
    fontSize: 12,
    color: '#a3a391',
    marginBottom: 16,
    lineHeight: 18,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  confidenceBadgeHigh: {
    backgroundColor: '#052e16',
    borderColor: '#16a34a',
  },
  confidenceBadgeMedium: {
    backgroundColor: '#1c1400',
    borderColor: '#ca8a04',
  },
  confidenceBadgeLow: {
    backgroundColor: '#1c1014',
    borderColor: '#9f1239',
  },
  confidenceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d1d5db',
  },
  insightTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 8,
  },
  insightTimeCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  insightTimeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  insightTimeTypeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  insightTimeValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f1f5f9',
    letterSpacing: 1,
  },
  insightArrow: {
    paddingHorizontal: 4,
  },
  insightArrowText: {
    fontSize: 20,
    color: '#475569',
    fontWeight: '700',
  },
  insightDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1f18',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#065f46',
    marginBottom: 10,
  },
  insightDurationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34d399',
  },
  insightFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightFooterText: {
    fontSize: 10,
    color: '#475569',
    flex: 1,
    lineHeight: 15,
  },
  insightNoData: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  insightNoDataTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350f',
    marginBottom: 8,
  },
  insightNoDataText: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    lineHeight: 19,
  },
});
