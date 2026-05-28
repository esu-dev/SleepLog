import { Audio } from 'expo-av';

let soundInstance: Audio.Sound | null = null;
let isPlaying = false;

/**
 * アラーム音（長い音楽）の再生を開始します。
 * ローカルの `assets/alarm.mp3` を優先し、存在しない場合はオンラインのストリーミング音源へフォールバックします。
 */
export const playAlarmSound = async () => {
  if (isPlaying) {
    console.log('[AlarmPlayer] Sound is already playing.');
    return;
  }
  
  try {
    console.log('[AlarmPlayer] Initializing audio mode...');
    // サイレントモード時でもスピーカーから再生されるようにオーディオモードを設定
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    });

    console.log('[AlarmPlayer] Loading audio asset...');
    let source;
    try {
      // ローカルアセットを試行
      source = require('../../assets/alarm.mp3');
      console.log('[AlarmPlayer] Using local asset: assets/alarm.mp3');
    } catch (e) {
      // ローカルアセットが見つからない場合はネットワーク上のパブリック音源にストリーミングフォールバック
      console.warn('[AlarmPlayer] Local asset not found, falling back to remote URL...');
      source = { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' };
    }

    const { sound } = await Audio.Sound.createAsync(
      source,
      { shouldPlay: true, isLooping: true, volume: 1.0 }
    );
    
    soundInstance = sound;
    isPlaying = true;
    console.log('[AlarmPlayer] Sound successfully started playing.');
  } catch (error) {
    console.error('[AlarmPlayer] Failed to play sound:', error);
  }
};

/**
 * 再生中のアラーム音を停止し、アセットをアンロードしてリソースを解放します。
 */
export const stopAlarmSound = async () => {
  if (!soundInstance) {
    console.log('[AlarmPlayer] No active sound instance to stop.');
    isPlaying = false;
    return;
  }
  
  try {
    console.log('[AlarmPlayer] Stopping sound...');
    await soundInstance.stopAsync();
    await soundInstance.unloadAsync();
    soundInstance = null;
    isPlaying = false;
    console.log('[AlarmPlayer] Sound successfully stopped.');
  } catch (error) {
    console.error('[AlarmPlayer] Failed to stop sound:', error);
    // 万が一のゾンビインスタンス対策
    soundInstance = null;
    isPlaying = false;
  }
};

/**
 * 現在アラーム音が再生中かどうかを返します。
 */
export const isAlarmSoundPlaying = () => isPlaying;
