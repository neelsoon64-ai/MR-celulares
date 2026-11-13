import { defineConfig, loadEnv } from "vite";

const requiredFirebaseEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = requiredFirebaseEnv.filter(key => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Falta configurar Firebase: ${missing.join(", ")}`);
  }

  return { base: "./" };
});
