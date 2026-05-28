import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { SleepLog } from '../db/client';
import { formatDurationJapanese } from '../utils/date';
import { CheckCircle, AlertTriangle, Lightbulb, Smile, Meh, Frown } from 'lucide-react-native';

interface StatsScreenProps {
  logs: SleepLog[];
}

interface DailyStat {
  dateLabel: string; // "5/20"
  dayLabel: string;  // "水"
  hours: number;     // 7.5
  seconds: number;   // 27000
  isoDateString: string; // "YYYY-MM-DD"
  mood: number | null; // 0=良い, 1=普通, 2=悪い, null=未記録
}

export default function StatsScreen({ logs }: StatsScreenProps) {
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // 1. Generate the last 7 days (from 6 days ago to today)
  const getRecent7Days = (): DailyStat[] => {
    const stats: DailyStat[] = [];
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const isoDateString = `${year}-${month}-${day}`; // local date key
      
      const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`;
      const dayLabel = weekdays[date.getDay()];
      
      stats.push({
        dateLabel,
        dayLabel,
        hours: 0,
        seconds: 0,
        isoDateString,
        mood: null,
      });
    }
    return stats;
  };

  const dailyStats = getRecent7Days();

  // 2. Map SQLite logs to the corresponding 7 calendar days
  logs.forEach((log) => {
    const logDate = new Date(log.bedtime);
    const logYear = logDate.getFullYear();
    const logMonth = (logDate.getMonth() + 1).toString().padStart(2, '0');
    const logDay = logDate.getDate().toString().padStart(2, '0');
    const logLocalStr = `${logYear}-${logMonth}-${logDay}`;
    
    const matchedDay = dailyStats.find((d) => d.isoDateString === logLocalStr);
    if (matchedDay) {
      matchedDay.seconds += log.duration;
      matchedDay.hours = matchedDay.seconds / 3600;
      // Use the latest mood recorded for the day (logs are sorted DESC, so first match wins)
      if (matchedDay.mood === null && log.mood !== null && log.mood !== undefined) {
        matchedDay.mood = log.mood;
      }
    }
  });

  // 3. Compute Stats: Average sleep duration (only for days with recordings to be accurate)
  const recordedDays = dailyStats.filter((d) => d.seconds > 0);
  const totalSeconds = recordedDays.reduce((acc, curr) => acc + curr.seconds, 0);
  const averageSeconds = recordedDays.length > 0 ? Math.floor(totalSeconds / recordedDays.length) : 0;
  
  // Overall max hours to scale the bars dynamically (minimum 8 hours to keep the scale nice)
  const maxHours = Math.max(8, ...dailyStats.map((d) => d.hours));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>睡眠統計</Text>
          <Text style={styles.subtitle}>
            直近7日間の睡眠リズムを分析・可視化します
          </Text>
        </View>

        {/* Highlights Card */}
        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>平均睡眠時間 (記録のある日のみ)</Text>
          <Text style={styles.highlightValue}>
            {averageSeconds > 0 ? formatDurationJapanese(averageSeconds) : 'データなし'}
          </Text>
          <View style={styles.highlightSubRow}>
            <Text style={styles.highlightSubText}>
              直近7日間の総記録数: {recordedDays.length}回
            </Text>
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

        {/* Bar Chart Container */}
        <View style={styles.chartCard}>
          <Text style={styles.chartCardTitle}>睡眠時間と気分の推移 (直近7日間)</Text>
          <Text style={styles.chartHelpText}>
            ※棒グラフをタップすると各日の睡眠時間と気分が詳細表示されます。
          </Text>

          {/* Interactive Tooltip Display */}
          <View style={styles.tooltipHeightSpacer}>
            {selectedBarIndex !== null && (
              <View style={styles.tooltipContainer}>
                <Text style={styles.tooltipTitle}>
                  {dailyStats[selectedBarIndex].dateLabel} ({dailyStats[selectedBarIndex].dayLabel})
                </Text>
                <View style={styles.tooltipRow}>
                  <Text style={styles.tooltipValue}>
                    {dailyStats[selectedBarIndex].seconds > 0
                      ? formatDurationJapanese(dailyStats[selectedBarIndex].seconds)
                      : '睡眠記録なし'}
                  </Text>
                  {dailyStats[selectedBarIndex].mood !== null && (
                    <View style={styles.tooltipMoodBadge}>
                      {dailyStats[selectedBarIndex].mood === 0 && <Smile size={14} color="#a3e635" />}
                      {dailyStats[selectedBarIndex].mood === 1 && <Meh size={14} color="#facc15" />}
                      {dailyStats[selectedBarIndex].mood === 2 && <Frown size={14} color="#ef4444" />}
                      <Text style={[
                        styles.tooltipMoodText,
                        dailyStats[selectedBarIndex].mood === 0 && { color: '#a3e635' },
                        dailyStats[selectedBarIndex].mood === 1 && { color: '#facc15' },
                        dailyStats[selectedBarIndex].mood === 2 && { color: '#ef4444' },
                      ]}>
                        {dailyStats[selectedBarIndex].mood === 0 ? '良い' : dailyStats[selectedBarIndex].mood === 1 ? '普通' : '悪い'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Chart Canvas */}
          <View style={styles.chartCanvas}>
            {/* Grid background lines */}
            <View style={styles.gridLinesContainer}>
              <View style={[styles.gridLine, { bottom: '25%' }]} />
              <View style={[styles.gridLine, { bottom: '50%' }]} />
              <View style={[styles.gridLine, { bottom: '75%' }]} />
              <View style={[styles.gridLine, { bottom: '100%' }]} />
            </View>

            {/* Bars */}
            <View style={styles.barsRow}>
              {dailyStats.map((stat, idx) => {
                const barHeightPct = `${Math.min(100, (stat.hours / maxHours) * 100)}%` as any;
                const isSelected = selectedBarIndex === idx;
                
                return (
                  <Pressable
                    key={stat.isoDateString}
                    style={({ pressed }) => [
                      styles.barColumn,
                      pressed && { transform: [{ scale: 0.95 }] }
                    ]}
                    onPress={() => setSelectedBarIndex(isSelected ? null : idx)}
                  >
                    {/* Mood icon above bar */}
                    <View style={styles.moodIconContainer}>
                      {stat.mood === 0 && <Smile size={16} color="#a3e635" />}
                      {stat.mood === 1 && <Meh size={16} color="#facc15" />}
                      {stat.mood === 2 && <Frown size={16} color="#ef4444" />}
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: barHeightPct },
                          isSelected && styles.barFillSelected,
                          stat.seconds === 0 && styles.barFillEmpty,
                        ]}
                      />
                    </View>
                    
                    {/* Y-axis Label */}
                    <Text style={[styles.dayLabel, isSelected && styles.labelSelected]}>
                      {stat.dayLabel}
                    </Text>
                    <Text style={styles.dateLabel}>{stat.dateLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Chart Legend */}
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
          {/* Mood Legend */}
          <View style={styles.moodLegendRow}>
            <View style={styles.legendItem}>
              <Smile size={12} color="#a3e635" />
              <Text style={[styles.legendText, { marginLeft: 4 }]}>良い</Text>
            </View>
            <View style={styles.legendItem}>
              <Meh size={12} color="#facc15" />
              <Text style={[styles.legendText, { marginLeft: 4 }]}>普通</Text>
            </View>
            <View style={styles.legendItem}>
              <Frown size={12} color="#ef4444" />
              <Text style={[styles.legendText, { marginLeft: 4 }]}>悪い</Text>
            </View>
          </View>
        </View>

        {/* Informational Tips Card */}
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
    backgroundColor: '#0f172a', // Slate 900
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
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
  highlightCard: {
    backgroundColor: '#1e293b', // Slate 800
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
    color: '#38bdf8', // Sky 400
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
    color: '#10b981', // Emerald 500
  },
  healthyIndicatorBad: {
    color: '#f59e0b', // Amber 500
  },
  chartCard: {
    backgroundColor: '#1e293b', // Slate 800
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
  tooltipHeightSpacer: {
    height: 64,
    justifyContent: 'center',
    marginBottom: 12,
  },
  tooltipContainer: {
    backgroundColor: '#0f172a', // Slate 900
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
    justifyContent: 'space-between',
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
    backgroundColor: '#6366f1', // Indigo 500
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  barFillSelected: {
    backgroundColor: '#38bdf8', // Sky 400 (glowing highlight)
    shadowColor: '#38bdf8',
    shadowOpacity: 0.8,
  },
  barFillEmpty: {
    height: 6, // Show a tiny indicator for empty days
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
    marginHorizontal: 12,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: '#1e1b4b', // Deep indigo 950
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
});
