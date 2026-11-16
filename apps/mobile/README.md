# mobile

The Repwise app for Android and iPhone: React Native with Expo (SDK 58), TypeScript and Expo Router. v1 is tested on Android.

```bash
npm install
npm start            # then press "a" for an Android emulator, or scan the QR code with Expo Go
npm run check        # lint, format check, type check and tests (same as CI)
```

| Path                | Holds                                             |
| ------------------- | ------------------------------------------------- |
| `app/`              | Screens; the file path is the route (Expo Router) |
| `src/features/`     | Feature code used by screens                      |
| `src/lib/`          | Small shared helpers, such as unit conversion     |
| `assets/catalogue/` | Bundled equipment and exercise data               |

Weights are stored in kilograms; pounds are a display option (`src/lib/units.ts`).
