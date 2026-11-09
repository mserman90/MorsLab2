# MorsLab PWA

Modern, responsive React/TypeScript web adaptation of [mserman90/MorsLab](https://github.com/mserman90/MorsLab), based on upstream commit `e5cbeefb02dbcc4c3e75ad33f943c5cd799cadb2`.

The original repository is cloned, unchanged, in `.reference/MorsLab`. The new web entry point is `src/App.tsx`. Original Morse tables, alphabet profiles and normalization informed the TypeScript implementation. The desktop application has not been replaced inside the reference clone.

- **Detaylı Akademik Açıklama ve Kullanım Kılavuzu (TR):** [`docs/KULLANIM-KILAVUZU.md`](docs/KULLANIM-KILAVUZU.md) (ayrıca uygulama içinde **Kullanım kılavuzu** / `/#guide` sayfasında çevrimdışı olarak erişilebilir).

## Run

```sh
npm install
npm run dev
```

## Production

```sh
npx tsc --noEmit
npm run build
npm run preview
```

Publish the entire `dist/` directory, including `sw.js`, the web manifest, icons and locally hosted font. PWA installation and service workers require HTTPS, except on localhost. The production build is self-contained; core tools do not depend on an external server or font CDN.

For hosting under a subdirectory, build with `npm run build -- --base=./` and publish every generated file together.

## Included

- Omnidirectional 4-modality conversion across **Plain Text**, **Morse Text**, **Speech Voice**, and **CW Audio** (all 12 conversion directions).
- Bidirectional text/Morse conversion with Turkish/German normalization, Latin/Cyrillic/Arabic alphabet profiles, custom word separators (`/`, `|`, `#`, `*`), and prosigns (`<AR>`, `<SK>`, `<BT>`, `<AS>`, `<KN>`, `SOS`).
- Real PCM CW audio, pause/resume, seek, repeat, adjustable WPM, tone, volume, Farnsworth timing, and direct text-to-speech (`Sesli oku`) right in the converter and audio lab.
- Valid mono 16-bit PCM WAV downloads and Goertzel narrowband DSP + adaptive hysteresis decoding from CW audio files and live microphone input.
- Retained WAV download links, a direct open/save fallback, and native file sharing on supported mobile browsers. Blob links stay valid while displayed; cleanup allows a grace period for delayed browser download confirmations.
- Multilingual browser speech recognition (ASR) and text-to-speech (TTS) across `tr-TR`, `en-US`, `de-DE`, `ru-RU`, and `ar-SA`, plus dedicated **Morstan Konuşmaya** mode.
- Interactive alphabet, ten-question listening practice, tactile **CW Practice Keyer (Maniple)**, local results, translation history and local drafts.
- Station log with ADIF 3.1.4 import/export, UTC timestamps and Maidenhead locator validation.
- Responsive navigation, accessible native dialogs, keyboard playback shortcut, reduced-motion support and light/dark/system appearance.
- Installable PWA, versioned offline app-shell cache, local font, maskable icons and persistent local data.

## Limits

Speech recognition uses the browser's provider and may require internet; it is not represented as an offline AI model. Text-to-speech depends on available system voices. CW decoding is intended for clean, single-tone recordings, not noisy radio channels or general speech. Audio generation and decoding are limited to three minutes. USB/serial radio keying and native desktop speech-model runtimes are not included in this web adaptation.

Some sandboxed previews block downloads regardless of the app's file generation. After creating a WAV, use the displayed direct link or open the app in a new tab. On supported mobile browsers, `Paylas / Kaydet` opens the system file-sharing sheet. Browser security restrictions cannot be disabled by the app.

Data is stored in localStorage, scoped to the browser and origin. The history keeps the latest 100 unique translations. Clearing browser site data removes these records. Use the history JSON export and station ADIF export to retain your data.

## Verify

```sh
npx playwright install --with-deps chromium
npx playwright test
```

The test suite covers alphabet mapping, Turkish normalization, Morse timing, PCM decoding, valid WAV generation, ADIF round-tripping, conversion, playback, persistence, audio upload, practice, themes, mobile navigation, automated WCAG AA accessibility checks and actual offline reloading.

The development server intentionally does not register the service worker. Test offline functionality against the production preview. Increment `CACHE_NAME` in `public/sw.js` when shipping a new app-shell version.

## Attribution

Upstream MorsLab: Mustafa Mert Akceylan and Murat Erman. Upstream Apache-2.0 license and NOTICE are preserved in the clone and in `public/licenses/`. The React UI, browser audio engine, PWA packaging and tests are a new web adaptation. Manrope is self-hosted under the SIL Open Font License, included in `public/licenses/Manrope-OFL.txt`.