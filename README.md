# Banii Noștri · John & Cristina

Bugetul comun al lui **John** și **Cristina** — venituri, cheltuieli împărțite egal,
transferuri între conturi și sincronizare prin Supabase. Site-ul surferii:
aplicația frațului „Împreună · Marius & Diana”, dar cu design propriu și un plan care se propagă.

🔗 https://zzzprojectpage.github.io/Calculator_Venituri_John_Cristina/

## Cum funcționează banii (identic 1:1 cu „Împreună · Marius & Diana”)

- **De împărțit luna aceasta** = total venituri (estimate/confirmate) − total cheltuieli;
  se împarte egal, iar banul impar rămâne la Cristina.
- **Până intră salariul Cristinei**: după ce John și-a încasat salariul, aplicația arată
  „Astăzi: John → Cristina X lei” — din banii lui John se rezervă cheltuielile lui neplătite,
  iar restul se împarte egal, ținând cont de transferurile deja făcute.
- **Rezultatul net / Egalizarea**: fiecărui i se calculează poziția de cash
  (venituri încasate − plăți efective ± transferuri înregistrate); diferența față de
  jumătate din total se transferă de la cel cu mai mult către cel cu mai puțin.
  Transferurile nu sunt cheltuieli și nu scad totalul de împărțit.
- **Planificat = 5000** implicit, iar valoarea salvată se propagă în lunile următoare:
  lunile viitoare salvate o primesc imediat, cele necreate o moștenesc la prima deschidere.

## Structura

| Fișier | Rol |
| --- | --- |
| `index.html` | shell-ul aplicației (ecran de deblocare + lista lunară) |
| `styles.css` | tema „noapte & chihlimbar” |
| `app.js` | logica interfeței (modale, liste, calcul împărțire) |
| `sync.js` | comunicare cu Supabase (`jc_read`, `jc_save`, `jc_months_list`) + rezervă locală offline |
| `config.js` | URL + cheie publică Supabase (valorii publice) |
| `supabase/setup.sql` | tabelele `jc_*` și funcțiile RPC securizate cu cod de acces |

## Securitate

- Datele sunt accesibile doar celor cu **codul de acces de 64 caractere** (verificat pe
  server prin hash SHA-256; revocat accesul public la tabele, RLS activ).
- Codul de acces NU se află în acest repository. Se ține în `Credentials.txt` (pe desktop).
- În `config.js` se află doar URL-ul proiectului și cheia publică, la fel ca în orice site static.

## Instalare pe telefon

Deschide link-ul în browser → „Adaugă la ecranul principal”. Loghează-te cu același cod de
acces pe ambele telefoane; salvarea se face prin internet, deci dispozitivele pot fi pe rețele diferite.
