import Constants from 'expo-constants';

/**
 * Application version string.
 * Retrieves version from Expo configuration (app.json expo.version),
 * with fallback to package version or default.
 */
export const APP_VERSION =
  Constants.expoConfig?.version ?? '1.3.1';

