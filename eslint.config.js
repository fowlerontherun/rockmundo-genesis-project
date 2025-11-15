import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { 
    ignores: [
      "dist", 
      "src/hooks/useGameData.tsx",
      "src/components/achievements/**",
      "src/components/bands/BandRosterTab.tsx",
      "src/components/events/TicketTierManager.tsx",
      "src/components/music-video/**",
      "src/hooks/usePlayerEquipment.ts",
      "src/hooks/useRecordingData.tsx",
      "src/lib/**",
      "src/pages/**"
    ] 
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true, allowExportNames: ["useGameData"] },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
