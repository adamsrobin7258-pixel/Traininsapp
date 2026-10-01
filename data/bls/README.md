# BLS-Quelldaten

Hier liegt beim Import die offizielle Datei des Max Rubner-Instituts:

```
data/bls/source/BLS_4_0_Daten_2025_DE.xlsx
```

- Bezug: <https://blsdb.de> → Download (Bundeslebensmittelschlüssel 4.0, Lizenz CC BY 4.0)
- Der Ordner `source/` ist in `.gitignore` – die Quelldatei wird nicht eingecheckt. Prüfsumme,
  Version und Importdatum stehen in `IMPORT_REPORT.md` und in den erzeugten Daten.
- Import: `node scripts/nutrition/import-bls.ts` (Details: [docs/BLS.md](../../docs/BLS.md)).
