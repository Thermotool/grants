# Utlysningar

Daglig sammanställning av relevanta utlysningar (Energimyndigheten, Vinnova, EU, valfritt Formas/Forte/VR via GDP Hub).
Ämnesfiltret är inbyggt i `scripts/keywords.mjs` – redigera listan där för att ändra vad som tas med.

## Sätta upp
1. Skapa ett **publikt** repo på GitHub (t.ex. `grants`) och ladda upp ALLA filer i repots rot (inkl. mappen `.github`).
2. Settings → Pages → Deploy from branch → `main` / `/ (root)`.
3. Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save.
4. Actions → "Update grants" → Run workflow. Efter ~1 min finns `data/calls.json` fylld.
5. Öppna `https://<användare>.github.io/grants/` på mobilen → Lägg till på hemskärmen.

## Formas / Forte / Vetenskapsrådet (valfritt)
Skapa konto på gdphub.se, prenumerera på API:erna, och lägg i Settings → Secrets and variables → Actions:
- `GDP_API_KEY` – din nyckel
- `GDP_ENDPOINTS` – t.ex. `[{"name":"Formas","url":"https://…"},{"name":"Forte","url":"https://…"}]`
