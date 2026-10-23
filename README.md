# Banii Noștri · John & Cristina

Bugetul comun al lui **John** și **Cristina** — venituri, cheltuieli împărțite egal,
transferuri între conturi și sincronizare prin Supabase. Site-ul surferii:
aplicația frațului „Împreună · Marius & Diana”, dar cu design propriu și un plan care se propagă.

🔗 https://zzzprojectpage.github.io/Calculator_Venituri_John_Cristina/

## Cum funcționează „Planificat”

- În fiecare lună, câmpul **Planificat** pornește implicit de la **5000 lei** (sau preia valoarea din ultima lună salvată).
- Când salvezi o valoare nouă (ex. **6000**), aplicația o copiază automat în **toate lunile următoare**:
  - lunile viitoare deja salvate primesc noua valoare imediat (serverul face propagarea);
  - lunile viitoare încă necreate o moștenesc automat când le deschizi pentru prima dată.
- La moștenire se păstrează doar *Planificatul*; *Încasat efectiv* rămâne gol în luna nouă.

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
