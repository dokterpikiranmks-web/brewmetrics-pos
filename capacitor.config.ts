import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.brewmetricspos.app',
  appName: 'QAF POS',
  webDir: 'public',
  server: {
    url: 'https://brewmetrics-pos-git-apk-testing-dokterpikiranmks.vercel.app',
    cleartext: true
  }
};

export default config;
