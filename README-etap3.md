# Etap 3: powiadomienia push + cron (z poprawkami etapu 2)

## Co jest w paczce
**Poprawki etapu 2**
- `Tasks.tsx`: koniec z dublowaniem zadań offline (formularz zamyka się od razu), powtarzanie miesięczne nie dryfuje (31 sty → 28 lut → 31 mar), poprawny `role` filtrów.
- Zakupy: w trybie edycji (nie „sklepu”) każda pozycja ma wybór kategorii i „×”. Zmiana zapamiętuje się dla tej nazwy produktu (`settings/shopping.corrections`). Poprawione reguły (`sok pomarańczowy` → Napoje, `sos pomidorowy` i `pomidory w puszce` → Produkty suche itd.), logika w `src/categories.ts`.
- Stare zgadnięte kategorie z etapu 2 (`settings/shopping.known`) są ignorowane, więc nic nie trzeba czyścić.
- `data.ts`: błędy snapshotu trafiają do konsoli zamiast być nieobsłużone.

**Etap 3**
- `pwa/sw.ts`: własny service worker (precache + push + klik w powiadomienie otwiera właściwą zakładkę). Zastępuje `generateSW`.
- `src/push.ts` + sekcja „Powiadomienia” w *Więcej*: włącz/wyłącz na telefonie, przełączniki „zakupy” i „zadania”.
- `scripts/` + `.github/workflows/`: cron co 10 min (`reminders.yml`) i tygodniowy `keepalive.yml`.
- `firestore.rules`: nowa kolekcja `devices/{email}` (tokeny FCM, każdy tylko swój dokument).

**Co przypomina cron:** nowe pozycje na liście zakupów (dostają wszyscy poza dodającym), zadanie przypisane Ci przez kogoś innego, zadania z terminem na dziś lub po terminie (raz na termin). Cisza nocna 22:00–7:00 (czas warszawski). Raz dziennie o 7:xx kasuje zrobione zadania starsze niż 30 dni.

## Instalacja (PowerShell, `C:\TEST\domek`)
1. **Rozpakuj paczkę na projekt** (nadpisze `src/App.tsx`, `Settings.tsx`, `Shopping.tsx`, `Tasks.tsx`, `data.ts`, `firebase.ts`, `vite.config.ts`, `firestore.rules`, `.env.example`). Jeśli któryś z nich zmieniałeś ręcznie, porównaj najpierw.
   ```
   Expand-Archive ..\domek-etap3.zip -DestinationPath . -Force
   ```
2. **Zależności** (SW korzysta z workboxa):
   ```
   npm install
   npm i -D workbox-core workbox-precaching workbox-routing
   ```
3. **Klucz VAPID**: Firebase Console → Ustawienia projektu → Cloud Messaging → *Web Push certificates* → *Generate key pair*. Skopiuj klucz publiczny do `.env`:
   ```
   VITE_FIREBASE_VAPID_KEY=...
   ```
   Na tej samej karcie „Firebase Cloud Messaging API (V1)” powinno być *Enabled* (w nowych projektach jest).
4. **`.gitignore`**: dopisz linię (pobrany klucz konta usługi nazywa się `…-firebase-adminsdk-….json`, a istniejący wzorzec `serviceAccount*.json` go nie złapie):
   ```
   *firebase-adminsdk*.json
   ```
5. **Wdróż reguły i hosting**:
   ```
   firebase deploy --only firestore:rules
   ```
   potem build i hosting tak jak dotąd. Telefony odświeżą się same (autoUpdate); jeśli nie, zamknij i otwórz apkę dwa razy.
6. **Sekret dla crona**: Firebase Console → Ustawienia projektu → Konta usługi → *Generate new private key*. W repo na GitHubie: Settings → Secrets and variables → Actions → *New repository secret* o nazwie `FIREBASE_SERVICE_ACCOUNT`, wartość = **cała zawartość** pobranego JSON-a. Potem **usuń pobrany plik**. Nigdy nie commituj go do repo.
7. **Wypchnij repo** (z `.github/` i `scripts/`, razem z `scripts/package-lock.json`). Zakładka *Actions* → *Przypomnienia* powinna zacząć działać sama. Zrób to **zanim** włączysz powiadomienia na telefonach, bo pierwszy przebieg oznaczy dotychczasowe pozycje jako „już zgłoszone” i nie zasypie Cię starociami.

## Test
1. Na telefonie: *Więcej → Powiadomienia → Włącz na tym telefonie* i zgoda w oknie Androida.
2. **Zamknij apkę / zablokuj ekran** (przy otwartej apce celowo nie pokazujemy powiadomienia, bo listy odświeżają się na żywo).
3. GitHub → Actions → *Przypomnienia* → *Run workflow* → `mode: test`. Po kilku sekundach przyjdzie „Test powiadomień działa.”
4. Test prawdziwy: z drugiego konta dodaj produkt albo przypisz Ci zadanie, poczekaj do ~15 min.

## Dobrze wiedzieć
- GitHub uruchamia zaplanowane workflowy z opóźnieniem (zwykle 5–20 min), więc przypomnienia nie będą co do minuty.
- Zużycie Spark: cron czyta tylko nowe pozycje i aktywne zadania, w ciszy nocnej nic. Przy kilkudziesięciu aktywnych zadaniach to kilka tysięcy odczytów dziennie, limit to 50 tys.
- `keepalive.yml` co tydzień włącza oba workflowy ponownie (API GitHuba), żeby repo bez commitów nie wyłączyło crona po 60 dniach. Po ok. dwóch miesiącach bez commitów sprawdź w *Actions*, czy cron nadal chodzi.
- Tokeny: martwe są usuwane przez cron automatycznie, telefon odnawia swój token przy starcie apki.
- Wyłączenie powiadomień na telefonie usuwa jego token z `devices/{email}`.
