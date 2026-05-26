# Testing

Cuatro capas, de más rápida a más cara de mantener:

| Capa | Comando | Qué cubre | Infra extra |
|---|---|---|---|
| Unit (lógica pura) | `npm test` | Algoritmos, standings, helpers de players (`normalizeName`, `findPlayerByName`) | — |
| Component (DOM) | `npm test` | `PlayerCombobox` con `@testing-library/react` + jsdom | — |
| Integration (form mockeado) | `npm test` | `pozo-form` submit-flow con mocks de Firestore | — |
| Firestore rules | `npm run test:rules` | Security rules de `/pozos`, `/players`, `/settings` + default-deny | Java + firebase-tools |
| E2E (Playwright) | `npm run test:e2e` | Login → crear pozo → ver detalle, persistencia del roster entre pozos | Java + firebase-tools + browsers de Playwright |

## Capas 1-3: `npm test`

Corre todo lo que no necesita emulators ni browsers. **90 tests** en ~3s.

```bash
npm test          # one-shot
npm run test:watch  # watch mode
```

Estructura:

```
src/
├── lib/pozo/algorithms.test.ts        Unit — algoritmos de emparejamiento
├── lib/pozo/standings.test.ts          Unit — H2H, tabla, sorts
├── lib/players.test.ts                 Unit — normalize / find
└── components/pozo/
    ├── player-combobox.test.tsx        Component (jsdom)
    └── pozo-form.test.tsx              Integration (jsdom + mocks)
```

Vitest está configurado para usar Node por default (rápido). Los archivos
DOM piden jsdom con `// @vitest-environment jsdom` al inicio.

## Capa 4: Firestore rules — `npm run test:rules`

**Prerequisitos** (una vez):

```bash
# 1. Instalá Java 11+ (necesario para el firestore emulator):
brew install --cask temurin

# 2. Bajá el binary del emulator:
firebase setup:emulators:firestore
```

**Correrlos**:

```bash
npm run test:rules
```

El script usa `firebase emulators:exec` — arranca el firestore emulator,
corre los tests con `vitest`, y apaga el emulator. No tenés que dejar nada
corriendo en otra terminal.

Los tests viven en [`tests/rules/firestore.rules.test.ts`](tests/rules/firestore.rules.test.ts)
y cubren las 4 colecciones declaradas en [`firestore.rules`](firestore.rules):

- `/pozos/{id}` — create/read/update/delete por owner, admin override,
  bloqueo de cambio de ownerId.
- `/players/{id}` — owner CRUD, `linkedUid` puede leer su propio doc,
  default-deny para todos los demás, admin override.
- `/settings/{id}` — lectura pública (signup flow), escritura solo admin.
- Default-deny en cualquier colección no declarada.

## Capa 5: E2E con Playwright — `npm run test:e2e`

**Prerequisitos** (una vez):

```bash
# 1. Mismos que rules tests (Java + firestore emulator).
brew install --cask temurin
firebase setup:emulators:firestore

# 2. Auth emulator binary:
firebase setup:emulators:auth

# 3. Chromium para Playwright:
npx playwright install chromium
```

**Correrlo**:

```bash
npm run test:e2e         # headless, output en terminal
npm run test:e2e:ui      # con la UI interactiva de Playwright
```

El script arranca **auth + firestore emulators**, levanta **Vite** apuntado
a esos emulators (via `VITE_USE_FIREBASE_EMULATORS=1`), seedea un usuario
de fixture (`e2e@padel.test` / `padel-e2e-123`) via REST del Auth emulator,
y corre [`e2e/pozo-flow.spec.ts`](e2e/pozo-flow.spec.ts).

Los specs cubren:

1. **Pozo creation flow** — login → /pozos → /pozos/nuevo → llenar 8 slots
   creando players nuevos via el combobox → submit → land en detalle del
   pozo con "8 jugadores".
2. **Roster persistence** — segundo pozo en la misma sesión muestra los
   players del primero como sugerencias del autocomplete (sin "Crear" porque
   matchean).

El emulator state es efímero (in-memory) y se limpia al apagar — cada
corrida arranca fresca.

## CI

Los tests de capa 1-3 corren en cualquier máquina con Node. Para que
**rules + E2E** corran en CI necesitás:

```yaml
# .github/workflows/test.yml (ejemplo)
- uses: actions/setup-java@v4
  with: { java-version: "17", distribution: "temurin" }
- uses: actions/setup-node@v4
  with: { node-version: "24" }
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm test
- run: npm run test:rules
- run: npm run test:e2e
```

Total tiempo esperado: ~3s (test) + ~30s (rules) + ~90s (E2E con cold-start
de los emulators) ≈ **2 min** end-to-end.
