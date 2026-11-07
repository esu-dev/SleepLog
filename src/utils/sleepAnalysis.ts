import { SleepLog } from '../db/client';
import { formatLocalTime, formatDurationJapanese } from './date';

export interface SleepAnalysisResult {
  hasData: boolean;
  dateLabel: string;
  lastBedtimeStr: string;
  lastWakeTimeStr: string;
  lastDurationSeconds: number;
  lastDurationStr: string;
  lastMood: number | null;
  recommendedBedtimeStr: string;
  recommendedDurationMinutes: number;
  recommendedDurationStr: string;
  targetWakeTimeStr: string;
  statusBadge: {
    label: string;
    type: 'debt' | 'optimal' | 'excess' | 'neutral';
  };
  headline: string;
  advice: string;
  tips: string[];
}

/**
 * 2つの時刻の分換算差分を計算（時刻文字列 "HH:MM" から分を引いた時刻 "HH:MM" を算出）
 */
function subtractMinutesFromTime(hours: number, minutes: number, minsToSubtract: number): { hh: number; mm: number } {
  let totalMins = hours * 60 + minutes - minsToSubtract;
  while (totalMins < 0) {
    totalMins += 24 * 60;
  }
  const hh = Math.floor(totalMins / 60) % 24;
  const mm = totalMins % 60;
  return { hh, mm };
}

/**
 * HH:MM 形式の文字列にフォーマット
 */
function formatHHMM(hh: number, mm: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}`;
}

/**
 * 昨日の睡眠データから、今日の推奨就寝時刻と推奨睡眠時間を分析・算出します。
 */
export function analyzeNextSleep(logs: SleepLog[]): SleepAnalysisResult {
  const validLogs = logs
    .filter((l) => l.bedtime && l.wake_time && l.duration > 0)
    .sort((a, b) => new Date(b.bedtime).getTime() - new Date(a.bedtime).getTime());

  if (validLogs.length === 0) {
    return {
      hasData: false,
      dateLabel: '記録なし',
      lastBedtimeStr: '--:--',
      lastWakeTimeStr: '--:--',
      lastDurationSeconds: 0,
      lastDurationStr: '0時間0分',
      lastMood: null,
      recommendedBedtimeStr: '23:00 〜 23:30',
      recommendedDurationMinutes: 450, // 7.5 hours
      recommendedDurationStr: '7時間30分 〜 8時間00分',
      targetWakeTimeStr: '07:00頃',
      statusBadge: {
        label: 'データ蓄積中',
        type: 'neutral',
      },
      headline: 'まずは今日の睡眠を記録してみましょう',
      advice:
        '過去の睡眠記録がまだありません。成人の理想的な睡眠時間は7〜8時間です。今夜は23時頃にお布団に入り、すっきりとした朝を迎えましょう！',
      tips: [
        '寝る1〜2時間前に入浴すると入眠がスムーズになります',
        '就寝直前のスマホや強い光は控えましょう',
      ],
    };
  }

  const latest = validLogs[0];
  const lastBedDate = new Date(latest.bedtime);
  const lastWakeDate = new Date(latest.wake_time);

  const lastBedtimeStr = formatLocalTime(latest.bedtime);
  const lastWakeTimeStr = formatLocalTime(latest.wake_time);
  const lastDurationSeconds = latest.duration;
  const lastDurationMinutes = Math.floor(lastDurationSeconds / 60);
  const lastDurationStr = formatDurationJapanese(lastDurationSeconds);
  const lastMood = latest.mood;

  // 日付ラベル判定（昨日か、直近の日付か）
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    lastWakeDate.getFullYear() === yesterday.getFullYear() &&
    lastWakeDate.getMonth() === yesterday.getMonth() &&
    lastWakeDate.getDate() === yesterday.getDate();

  const isTodayMorning =
    lastWakeDate.getFullYear() === now.getFullYear() &&
    lastWakeDate.getMonth() === now.getMonth() &&
    lastWakeDate.getDate() === now.getDate();

  let dateLabel = '直近の睡眠';
  if (isTodayMorning) {
    dateLabel = '今朝起きた睡眠';
  } else if (isYesterday) {
    dateLabel = '昨日の睡眠';
  } else {
    dateLabel = `${lastWakeDate.getMonth() + 1}/${lastWakeDate.getDate()}の睡眠`;
  }

  // 起床時刻を基準に想定翌日起床時刻を設定
  let wakeH = lastWakeDate.getHours();
  let wakeM = lastWakeDate.getMinutes();

  // 極端な起床時刻（例: 午後起床など）の場合は標準的な7:00に少し寄せる
  if (wakeH < 5 || wakeH > 11) {
    wakeH = 7;
    wakeM = 0;
  }

  // 15分刻みに丸める
  wakeM = Math.round(wakeM / 15) * 15;
  if (wakeM === 60) {
    wakeH = (wakeH + 1) % 24;
    wakeM = 0;
  }
  const targetWakeTimeStr = `${formatHHMM(wakeH, wakeM)}頃`;

  // 推奨睡眠時間の算出
  // 基準値: 450分 (7.5時間)
  let recDurationMinutes = 450;
  let statusBadge: SleepAnalysisResult['statusBadge'] = {
    label: '良好なリズム',
    type: 'optimal',
  };
  let headline = '';
  let advice = '';
  const tips: string[] = [];

  const lastHours = lastDurationMinutes / 60;

  if (lastDurationMinutes < 390) {
    // 6.5時間未満: 睡眠不足（睡眠負債）
    // 不足を補うため7時間45分〜8時間15分程度を推奨
    recDurationMinutes = 480; // 8時間
    statusBadge = {
      label: '睡眠負債あり',
      type: 'debt',
    };
    headline = '昨晩の睡眠不足を補い、今夜は早めに休息を';

    if (lastMood === 0) {
      advice = `昨日は${lastDurationStr}の睡眠で、目覚めもすっきりとしない状態でした。蓄積した疲労と睡眠負債を解消するため、今夜は普段より早めに就寝し、${formatDurationJapanese(recDurationMinutes * 60)}の睡眠をしっかり確保しましょう。`;
    } else {
      advice = `昨日は${lastDurationStr}と睡眠時間が短めでした。日中に自覚がなくても睡眠負債が溜まっている可能性があります。今夜は${formatDurationJapanese(recDurationMinutes * 60)}を目安にしっかりと体を休めましょう。`;
    }

    tips.push('いつもより30分〜1時間早めに布団に入ると睡眠負債が回復しやすいです');
    tips.push('ぬるめ（38〜40℃）のお風呂にゆっくり浸かると深い睡眠が得られます');
  } else if (lastDurationMinutes > 510) {
    // 8.5時間超: 寝過ぎ
    recDurationMinutes = 435; // 7時間15分
    statusBadge = {
      label: '寝過ぎリセット',
      type: 'excess',
    };
    headline = '規則正しいリズムに戻して軽快な朝へ';

    if (lastMood === 0) {
      advice = `昨日は${lastDurationStr}と長時間眠ったものの、寝起きのだるさが残ったようです。寝過ぎは体内時計のリズムを崩す原因になります。今夜は${formatDurationJapanese(recDurationMinutes * 60)}程度に整え、メリハリのある睡眠を目指しましょう。`;
    } else {
      advice = `昨日は${lastDurationStr}とたっぷりの睡眠をとりました。十分に休息できているため、今夜は適正な${formatDurationJapanese(recDurationMinutes * 60)}前後の睡眠で活動的なリズムを維持しましょう。`;
    }

    tips.push('朝起きたらすぐにカーテンを開けて太陽の光を浴びましょう');
    tips.push('就寝前に軽いストレッチをして副交感神経を優位に整えましょう');
  } else {
    // 6.5時間〜8.5時間: 適正範囲
    if (lastMood === 1) {
      // 良い目覚め！昨日の睡眠リズムを維持
      recDurationMinutes = Math.min(480, Math.max(450, Math.round(lastDurationMinutes / 15) * 15));
      statusBadge = {
        label: 'ベストリズム維持',
        type: 'optimal',
      };
      headline = '昨日の好調な睡眠リズムを今夜もキープ！';
      advice = `昨日は${lastDurationStr}の睡眠で、目覚めの気分も良好でした！あなたにとって非常に心地よい睡眠リズムです。今夜も同じペース（${formatDurationJapanese(recDurationMinutes * 60)}）を維持することで、明日もすっきりとした目覚めが期待できます。`;
      tips.push('今の生活リズムが合っています。規則正しい就寝・起床を続けましょう');
    } else if (lastMood === 0) {
      // 時間は適正だが気分が悪い
      recDurationMinutes = 465; // 7時間45分
      statusBadge = {
        label: '質・リズム調整',
        type: 'debt',
      };
      headline = '睡眠の質を高めて目覚めのスッキリ感をアップ';
      advice = `昨日は${lastDurationStr}の時間を確保できていたものの、寝起きがいまひとつの様子でした。睡眠の深さや就寝前の環境を見直してみましょう。今夜は${formatDurationJapanese(recDurationMinutes * 60)}を目安に、リラックスして過ごしましょう。`;
      tips.push('寝る前のカフェイン・アルコール・スマホのブルーライトを避けましょう');
      tips.push('寝室の温度（20℃前後）や湿度を快適に保ちましょう');
    } else {
      // 気分未設定
      recDurationMinutes = 450; // 7.5時間
      statusBadge = {
        label: '良好なバランス',
        type: 'optimal',
      };
      headline = '今夜も安定した睡眠リズムを意識しましょう';
      advice = `昨日は${lastDurationStr}のバランスの良い睡眠でした。今夜も標準的な${formatDurationJapanese(recDurationMinutes * 60)}を目標に、無理のない時間帯に就寝しましょう。`;
      tips.push('起床時に「寝起き評価（良い・悪い）」を記録すると、より正確な分析ができます');
    }
  }

  // 推奨就寝時刻を逆算 (wakeTime - recDurationMinutes)
  const targetBed = subtractMinutesFromTime(wakeH, wakeM, recDurationMinutes);

  // 昨日の就寝時刻と比較
  const lastBedH = lastBedDate.getHours();
  const lastBedM = lastBedDate.getMinutes();

  // もし昨日の就寝が深夜遅く（例: 02:00〜04:00）、逆算就寝時刻が 22:30 などの場合、
  // 体内時計のギャップが大きすぎて眠れないためアドバイスを補足
  const diffBedMins = ((targetBed.hh * 60 + targetBed.mm) - (lastBedH * 60 + lastBedM) + 1440) % 1440;
  let recommendedBedtimeStr = `${formatHHMM(targetBed.hh, targetBed.mm)}頃`;

  if (diffBedMins > 180 && diffBedMins < 1440 - 180) {
    // 3時間以上の乖離がある場合は幅を持たせる
    const gentleBed = subtractMinutesFromTime(lastBedH, lastBedM, 60);
    recommendedBedtimeStr = `${formatHHMM(targetBed.hh, targetBed.mm)} 〜 ${formatHHMM(gentleBed.hh, gentleBed.mm)}頃`;
  }

  const recommendedDurationStr = formatDurationJapanese(recDurationMinutes * 60);

  return {
    hasData: true,
    dateLabel,
    lastBedtimeStr,
    lastWakeTimeStr,
    lastDurationSeconds,
    lastDurationStr,
    lastMood,
    recommendedBedtimeStr,
    recommendedDurationMinutes: recDurationMinutes,
    recommendedDurationStr,
    targetWakeTimeStr,
    statusBadge,
    headline,
    advice,
    tips,
  };
}
