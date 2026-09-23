export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    url?: string;
    cleartext?: boolean;
  };
}

const config: CapacitorConfig = {
  appId: "com.doita.pos",
  appName: "DOI TA",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
