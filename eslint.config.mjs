import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".firebase", "scripts/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // v7 moved the flat-config presets under `configs.flat`; the top-level
  // `recommended-latest` is now the legacy (eslintrc) shape and crashes
  // ESLint 9's flat loader.
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // The subscribe-hooks idiom here (reset + hydrate state inside the
      // effect that opens the Firestore listener) trips this on every hook.
      // Refactoring all of them onto useSyncExternalStore isn't worth the
      // churn for this app's size.
      "react-hooks/set-state-in-effect": "off",
      // Date.now() inside useMemo computes date-range cutoffs on purpose:
      // they should refresh when the filter changes, not tick per render.
      "react-hooks/purity": "off",
    },
  },
  {
    // Files whose job is to co-export non-components: cva variant helpers
    // (ui kit), hook + provider pairs (contexts), and the lazy route
    // loader table. Fast-refresh boundaries don't apply to them.
    files: ["src/components/ui/**", "src/contexts/**", "src/router.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
)
