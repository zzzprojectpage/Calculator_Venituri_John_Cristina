# Împreună · John & Cristina

Bugetul comun al lui **John** și **Cristina**. Aceeași aplicație și aceeași structură ca
[Împreună · Marius & Diana](https://zzzprojectpage.github.io/Calculator_Venituri/):
Dashboard + Grafic, taburile John / Cristina / Facturi, transferul „Până intră salariul Cristinei”,
egalizarea finală și pașii lunii. Calculele sunt identice 1:1. John ține locul lui Marius, Cristina pe al Dianei.

🔗 https://zzzprojectpage.github.io/Calculator_Venituri_John_Cristina/

## Ce diferă față de Marius & Diana

- **Planificat = 5.000 lei** pentru fiecare salariu, implicit.
- **Planificatul se propagă**: o lună nouă pornește de la sumele planificate în luna anterioară,
  iar când salvezi o valoare nouă (de exemplu 6.000 lei), aceasta apare și în lunile următoare.
- **Sume în lei întregi**: se introduc și se salvează în lei, fără zecimale. Dacă totalul are un
  leu impar, acel leu îi revine Cristinei (la Marius & Diana, banul impar îi revine Dianei).
- **Date separate**: tabelele și funcțiile `jc_*` din același proiect Supabase. Datele Marius & Diana
  (`budget_*`) nu sunt atinse. Codul privat, bifele de facturi și modul local au chei proprii în browser.
- Tabul **Facturi** deschide paginile generale ale furnizorilor (DIGI, Hidroelectrica, e-bloc).

## Structura

| Fișier | Rol |
| --- | --- |
| `index.html`, `assets/` | aplicația compilată (aceeași ca Marius & Diana) |
| `config.js` | Project URL + cheia publică Supabase |
| `sw.js`, `manifest.webmanifest`, `icon*` | instalare pe telefon (PWA) |
| `GHID.html` | ghidul de instalare și folosire |
| `supabase/setup.sql` | tabelele `jc_*` și funcțiile `jc_read` / `jc_save` / `jc_months_list` |
| `supabase/reset-code.sql` | schimbarea codului privat |

## Securitate

- Datele sunt accesibile doar cu **codul privat de 64 de caractere**, verificat pe server prin hash SHA-256.
  Accesul direct la tabele este revocat și RLS este activ.
- Codul privat NU este în acest repository. Se află în `Credentials.txt`, pe Desktop.
- `config.js` conține doar valori publice.
