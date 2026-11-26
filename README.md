# Domek – etap 1 (szkielet)

Logowanie Google, bramka członków, reguły Firestore, PWA, nawigacja, zarządzanie domownikami.

## 1. Firebase (plan Spark, bez karty)
1. https://console.firebase.google.com → **Dodaj projekt** (Analytics wyłącz).
2. **Build → Authentication → Get started → Google** → włącz, wybierz mail wsparcia.
3. **Build → Firestore Database → Create database** (tryb produkcyjny, region `eur3` lub `europe-central2`).
4. **Ustawienia projektu → Twoje aplikacje → Web (</>)** → zarejestruj aplikację i skopiuj konfigurację.
5. **Build → Hosting → Get started** (możesz pominąć kroki CLI).

## 2. Lokalnie
```bash
npm install
cp .env.example .env      # wklej wartości z kroku 1.4
npm run dev
```

## 3. Reguły i pierwszy członek
```bash
npm i -g firebase-tools
firebase login
firebase use --add        # wybierz swój projekt
firebase deploy --only firestore:rules
```
W konsoli Firestore utwórz ręcznie **pierwszy dokument**:
- kolekcja `members`, ID dokumentu = **Twój adres Gmail małymi literami**
- pola: `name` (string, np. "Tomek"), `color` (string, np. `#0f766e`)

Bez tego nikt (też Ty) nie wejdzie do apki, bo reguły wpuszczają tylko adresy z `members`.
Kolejne osoby dodajesz już w apce: zakładka **Więcej → Dodaj domownika**.

## 4. Deploy
```bash
npm run deploy
```
Adres: `https://<projekt>.web.app`. Na telefonie otwórz w Chrome → menu → **Zainstaluj aplikację**.

## Prywatność (publiczne repo)
`.env` jest w `.gitignore`. Konfiguracja webowa Firebase nie jest sekretem, ale i tak jej nie commitujemy.
W repo nie ma maili ani kluczy; lista domowników jest tylko w Firestore.
Klucz service account (etap 3, push) trafi wyłącznie do GitHub Secrets.

## Roadmapa
2 Zakupy + zadania · 3 Push + cron · 4 Kalendarz Google + „Dziś” · 5 Terminy, spiżarnia, notatki · 6 Przepisy i plan posiłków · 7 Eksport JSON
