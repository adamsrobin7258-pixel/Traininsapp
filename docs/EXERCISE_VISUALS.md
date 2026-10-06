# 3D-Übungsdarstellung (Prototyp, Version 0.26.0)

Eine gemeinsame, stilisierte Kalethra-Figur zeigt, welche Muskelgruppen eine Übung beansprucht,
und spielt die Bewegung als ruhige Schleife ab. Prototyp für zwei Übungen; die Architektur ist
auf die ganze Bibliothek ausgelegt.

## Technik

- **three.js 0.186** (WebGL, MIT-Lizenz). Geprüft und verworfen:
  - eigener WebGL-Code: kleiner, aber viel eigener Render-Code, schwer wartbar
  - `@google/model-viewer`: baut selbst auf three.js auf, größer, weniger Kontrolle über Licht,
    Farben und Animation pro Muskelgruppe
  - Babylon.js: deutlich größer
  - react-three-fiber: zusätzlicher Reconciler ohne Nutzen bei einer einzelnen Szene
- **Eigener Chunk** (`figureRenderer-*.js`, 543 KB, 135 KB gzip): wird erst geladen, wenn eine
  Figur sichtbar wird. App-Start und Haupt-Chunk bleiben praktisch unverändert (+9 KB für die
  React-Bausteine).
- **Offline**, keine Remote-Assets, kein CDN, keine Cloud. Läuft im Capacitor-WebView auf Android
  und iOS (WebGL ist dort Standard).
- **Ohne WebGL** (oder wenn der Chunk nicht lädt) erscheint keine Figur; die Details bleiben
  vollständig, die Muskeln stehen als Text daneben.

## Asset und Lizenz

| Teil                      | Quelle                                                                      | Lizenz                | Attribution                             | Kommerziell | Bearbeitung |
| ------------------------- | --------------------------------------------------------------------------- | --------------------- | --------------------------------------- | ----------- | ----------- |
| Figur, Geräte, Bewegungen | eigen: im Code erzeugt (`modules/training/figure/figureModel.ts`, `rig.ts`) | Eigentum des Projekts | keine                                   | ja          | ja          |
| three.js                  | npm `three` 0.186.1                                                         | MIT                   | Lizenztext beibehalten (liegt im Paket) | ja          | ja          |

**Kein externes 3D-Modell.** Für ein Menschmodell mit getrennten Muskelgruppen, Rig und
Animationen gab es keine Quelle mit eindeutig kommerziell nutzbarer Lizenz, die ohne
Modellier-Arbeit brauchbar wäre. Die Figur wird deshalb aus weichen Grundformen gebaut
(Lathe-Torso, Kapseln, Ellipsoide). Optisch: hochwertig-reduziert, matt, Gliederpuppen-Anmutung –
kein modellierter Premium-Charakter.

## Gestaltung

- Neutral-athletische Proportionen (ca. 1,75 m), geschlechtsneutral, Kopf ohne Gesicht/Haare.
- Eng anliegendes Shirt mit kurzen Ärmeln, kurze Hose, Schuhe – ohne Logos oder Muster.
- Matte Materialien (`MeshStandardMaterial`, Rauheit 0,88), weiches Licht, Kontaktschatten statt
  Echtzeit-Schatten.
- Muskelgruppen als dezentes Relief in der Farbe ihrer Oberfläche (Shirt, Haut, Hose).
  **Primär** = Kalethra-Akzent (`--color-accent`), **sekundär** = halb zwischen Oberfläche und
  Akzent, alles andere neutral. Hell und dunkel aus den Theme-Tokens, folgt dem Theme-Wechsel.

## Daten (Source of Truth)

- Muskeln kommen ausschließlich aus `primaryMuscles` / `secondaryMuscles` der Übung
  (`core/training/muscleMap.ts`: `muscleHighlight`). Keine zweite Muskelliste.
  `fullBody` steht für alle 13 Regionen. Ist eine Gruppe primär und sekundär, gilt primär.
- `EXERCISE_VISUALS` ordnet nur **Übungs-ID → Bewegung + zuerst gezeigte Seite** zu:
  - `sys.bench-press` → `benchPress`, Vorderseite
  - `sys.lat-pulldown` → `latPulldown`, Rückseite
- Keine Datenbankänderung.

### Auswahl der Prototyp-Übungen

Bankdrücken und Latzug decken die Prüffragen mit zwei Übungen ab: Vorderseite (Brust) gegen
Rückseite (Latissimus), Drücken gegen Ziehen, Liegen gegen Sitzen, Langhantel gegen Kabelzug.
Beide sind sehr häufig und haben eindeutige Primär-/Sekundärmuskeln im Katalog.

## Bewegung und Rig (`modules/training/figure/rig.ts`)

- Ein Skelett für alle Übungen: Schultern, Ellbogen, Hüften, Knie; Hände und Füße folgen
  Zielpunkten, Ellbogen und Knie per **Zwei-Knochen-IK** mit Richtungshinweis. Knochenlängen
  bleiben immer gleich (getestet).
- Eine Bewegung = Haltung (liegend/sitzend/stehend), Gerät, Dauer und eine Funktion
  `Phase 0…1 → Zielpunkte`. Wiederholung: weicher Kosinus mit kurzem Halten oben/unten,
  4,4 s je Wiederholung, nahtlose Schleife (`frame(0) = frame(1)`, getestet).
- Neue Übung = neue Bewegungsdefinition (meist 10–20 Zeilen) + Eintrag in `EXERCISE_VISUALS`.

## Oberfläche

- **Übungsdetails:** kleine, stehende Figur (108 × 128 px) neben den Fakten. Leistung, Bestwert
  und e1RM bleiben unverändert darunter. Keine Animation in der kleinen Ansicht.
- **Große Ansicht:** ersetzt das Detail-Sheet (kein zweites Sheet darüber, keine neue Route);
  Schließen oder System-Zurück führt zurück zu den Details. Figur in der Mitte, Ziehen dreht sie,
  „Rückseite/Vorderseite zeigen“, Play/Pause, Legende Primär/Sekundär als Text.
- **Trainings-Zusammenfassung:** „Beanspruchte Muskeln“ – Vereinigung der Muskeln aller
  Übungen mit mindestens einem abgeschlossenen Satz (`doneExercises`,
  `aggregateMuscleHighlight`): primär, wenn in einer Übung primär, sonst sekundär. Keine
  Gewichtung, kein Score. Figur vorne und hinten nebeneinander; antippen öffnet die große
  Ansicht (ohne Bewegung).

## Bewegung reduzieren / Barrierefreiheit

- `prefers-reduced-motion`: keine automatische Schleife, Drehen ohne Übergang; Abspielen bleibt
  auf Wunsch möglich.
- Die Figur ist nie die einzige Informationsquelle: Muskeln stehen als Text daneben, die große
  Ansicht hat eine Beschreibung (`role="img"`) und eine Legende.

## Performance

- Gerendert wird nur bei Bedarf: Die kleine Figur einmal, die große nur, solange die Bewegung
  läuft oder die Figur sich dreht.
- Immer höchstens ein WebGL-Kontext (die große Ansicht ersetzt die kleine); beim Schließen werden
  Geometrien, Materialien und Kontext freigegeben (`forceContextLoss`).
- Pixelverhältnis höchstens 2, keine Echtzeit-Schatten, etwa 60 Meshes.

## Für eine modellierte Figur (Asset-Vertrag)

Ein späteres Artist-Modell (glTF/GLB, lokal im Bundle) ersetzt nur `figureModel.ts`, wenn es:

1. je Muskelgruppe ein eigenes Mesh mit Namen `muscle:<gruppe>` hat (13 Gruppen aus
   `FIGURE_MUSCLES`, z. B. `muscle:chest`, `muscle:lats`); Teile dürfen mehrfach vorkommen;
2. ein Skelett mit Schulter-, Ellbogen-, Hüft- und Kniegelenken hat (oder eigene Clips je Übung
   mitbringt, benannt nach der Bewegung, z. B. `benchPress`);
3. matte Materialien ohne eingebrannte Farben auf den Muskel-Meshes verwendet (die Farbe setzt
   die App);
4. unter etwa 1–2 MB (Draco/Meshopt komprimiert) bleibt.

## Skalierung auf die Bibliothek

- Bewegungen gruppieren statt einzeln bauen: viele Übungen teilen ein Muster
  (`movementPattern`: horizontalPush, verticalPull, squat, hinge …) und ein Gerät.
- Geräte als kleine, wiederverwendbare Bausteine (Bank, Kabelturm, Stange, Kurzhanteln …).
- Übungen ohne Bewegung können sofort die stehende Figur mit Highlighting zeigen – nur die
  Muskeldaten sind nötig.
- Gerätetest auf dem Xiaomi 15 Ultra (Bildrate, Speicher, Akku) vor dem Ausrollen.
