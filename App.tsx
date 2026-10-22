import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { initializeDatabase, getAllSleepLogs, SleepLog } from './src/db/client';
import { useSleepStore } from './src/store/useSleepStore';
import HomeScreen from './src/screens/HomeScreen';
import AddLogScreen from './src/screens/AddLogScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatsScreen from './src/screens/StatsScreen';
import { Moon, FilePlus, ClipboardList, BarChart3 } from 'lucide-react-native';

type Tab = 'home' | 'add' | 'history' | 'stats';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [dbStatus, setDbStatus] = useState<'success' | 'failed'>('success');
  const [logs, setLogs] = useState<SleepLog[]>([]);

  // Get active tracking state (to disable manual log entry during active tracking)
  const { isTracking, startTime } = useSleepStore();

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
        // Disable manual log entry during active tracking
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
});
