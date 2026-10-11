# Prototyp 1C – Steinmaterial und Skulpturlicht

Branch `claude/figure-prototype-stone-1c`, Ausgang `21ced3d` (`claude/figure-prototype-apk`).
Nur Darstellung im Viewer: **GLB, Geometrie, Dreiecke und Morph-Targets unverändert**
(Prüfsumme `8b6221ada3cb74cb8978a8818926da01dde2b3f959636c00691926ffc4d6e08c` vorher und
nachher). Nicht Teil der Kalethra-App.

## Was sich ändert

Der Viewer startet im **Stand 1C**. Der Knopf **„Vergleich: Stand 1A zeigen“** schaltet auf dem
Gerät auf den bisherigen Stand um und zurück; 1A ist pixelgleich zum Viewer von Phase 1A
(geprüft vorne und hinten, Haut und Muskeln: Abweichung 0).

| Bereich              | Stand 1A                                                                                           | Stand 1C (`look.json` → `sculpture1C`)                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Licht                | App-Licht: Hemisphäre 1,15 (weiß/grau), Haupt 2,5, Füll 0,55 (bläulich), Kante 0,9                 | Hemisphäre 0,55 (#FFF5E8/#6F6353), Haupt 3,0 warm (#FFEBD4) **links oben vorne**, Füll 0,45 warm von rechts, Kante 0,5 von hinten rechts |
| Schatten             | keine                                                                                              | keine (in 1C nicht vorgesehen)                                                                                                           |
| Tonemapping          | ACES, Belichtung 1,05                                                                              | unverändert ACES, Belichtung 1,05                                                                                                        |
| Stein                | #D6C8B0, Rauheit 0,88, metallisch 0                                                                | #E7DBC5, Rauheit 0,90, metallisch 0                                                                                                      |
| Oberflächenvariation | Sinus-Ebenenwellen 22 cm / 4,5 % und **6 mm / 1,8 %** (periodisch, feiner Anteil unter Pixelgröße) | nicht periodisches Value-Noise 11 cm / 2,2 % und 3,2 cm / 1,0 %, warm/kühl 30 cm / 1,0 %                                                 |
| Muskelansicht        | 13 Gruppenfarben (50 %), Fasernormalmap 4096², Stärke 1,0                                          | **keine Gruppenfarben**, **keine Fasermap** (wird nicht geladen) – nur Form und Licht                                                    |
| Hervorhebung (Übung) | Haut: Salbeigrün; Muskeln: Gruppenfarbe kräftig, Rest gedämpft                                     | tieferer Steinton #C9AE86, primär 0,50, sekundär 0,28, Rest 0                                                                            |
| Lendentuch           | #EEE8DC (heller als der Stein)                                                                     | #D9CBB3, Rauheit 0,93 (gleiche Steinfamilie, etwas tiefer)                                                                               |
| Augen, Haare         | #D9CCB5 / Stein                                                                                    | Stein #E7DBC5                                                                                                                            |

Außerdem: Beim Neuaufbau der Figur (Übung oder Stand wechseln) wurde die Bone-Textur des
Skeletts nicht freigegeben – je Wechsel eine Textur mehr. Behoben im Prototyp
(`prototypeBody.mjs` → `dispose`); die Texturzahl bleibt jetzt konstant. Hinweis: Die
Produktions-Figur (`src/modules/training/figure/gltfBody.ts`) gibt Skelette ebenfalls nicht frei;
dort nicht geändert.

## Ergebnisse der Vorprüfung (Software-WebGL, kein Gerätenachweis)

Renderings mit identischer Kamera, Pose (Ruhe, Standbild) und Belichtung:
[`assets/figure/prototype/qa-1c/`](../../assets/figure/prototype/qa-1c/), Messwerte in
`metrics.json`.

| Messwert (Figur, Haut vorne)                                           | 1A                    | 1C                     | Ziel                           |
| ---------------------------------------------------------------------- | --------------------- | ---------------------- | ------------------------------ |
| Helligkeit 5. / 95. Perzentil                                          | 132 / 210 (Spanne 77) | 108 / 212 (Spanne 104) | Spanne ≥ 100                   |
| Farbton / Sättigung / Helligkeit (Median)                              | 38,6° / 0,145 / 0,76  | 37,1° / 0,211 / 0,78   | 35–45° / 0,18–0,28 / 0,68–0,80 |
| Rückseite Sättigung                                                    | 0,154                 | 0,219                  | ≥ 0,15                         |
| Wärme gegenüber Hintergrund (R − B)                                    | 28 (Hintergrund 9)    | 42 (Hintergrund 9)     | deutlich wärmer                |
| Übersteuerte Pixel                                                     | 0 %                   | 0 %                    | < 1 %                          |
| Feindetail-Änderung zwischen zwei um 0,4° gedrehten Bildern (Flimmern) | 0,384                 | 0,081 (−79 %)          | so klein wie möglich           |

- Dreiviertel- und Rückansicht sowie die Muskelansicht liegen in denselben Bereichen
  (Spanne 102–108, Sättigung 0,21–0,22).
- Nahansicht: Die Rillen der Fasermap sind weg; das feine Punktmuster des 1A-Steins auf dem
  Rücken (Aliasing der 6-mm-Wellen) ist weg. Die neue Körnung ist nur aus der Nähe als ruhige
  Unregelmäßigkeit zu sehen.
- Grafikspeicher (Schätzung aus der Datei): 1A ca. 117 MiB, **1C ca. 32 MiB** – die
  4096²-Fasermap (ca. 85 MiB) wird in 1C nicht dekodiert und nicht hochgeladen. Die GLB bleibt
  23,27 MiB (die Map liegt weiter in der Datei).
- Offline: unverändert, alle Quellen lokal; der Build prüft das bei blockiertem Netz.

## Bekannt, bewusst nicht geändert (eigene Freigabe nötig)

- **Hervorhebung beim Training kaum sichtbar.** Im Steinton (ohne Farbfelder) ist die
  Hervorhebung von Brust/Trizeps/Schultern beim Bankdrücken praktisch nicht zu erkennen
  (`qa-1c/04_hervorhebung_bankdruecken.png`). Entscheidung offen: so lassen, Steinton
  kräftiger, oder Hervorhebung anders lösen (z. B. Licht statt Farbe).
- **Lendentuch:** Farbe angepasst; die Form bleibt ein moderner Slip-Schnitt. Eine antike
  Drapierung braucht neue Geometrie → zurückgestellt.
- **Geometrie:** dunkle Knitterstellen an der unteren Brustfuge (Muskelansicht), Beuligkeit im
  unteren Rücken, flacher Rücken (Trapezius, Schulterblatt, Latissimus), weiche Knie, Haarkappe.
  Unter dem neuen Licht deutlicher sichtbar → eigene Phase.
- **AO, Schatten, Normalen der Korrektur-Morphs:** nicht in 1C.

## Vergleichs-APK

Workflow „Figure prototype APK (stone 1C)“ (`.github/workflows/figure-prototype-stone-1c-apk.yml`),
nur für Pushes auf diesen Branch; Kopie des 1A-APK-Workflows mit dem Vorbereitungsskript
`apk-1c/prepare-android.sh` (Kopie, nur der erlaubte Branch geändert). Die Dateien der
1A-APK-Lösung bleiben unverändert (der Workflow prüft das).

Gleiche Test-App wie bisher: Paket-ID `com.kalethra.figureprototype`, Name „Kalethra
Figur-Test“, nur Internet-Berechtigung (technisch für die Capacitor-Hülle), keine Kamera, kein
Health Connect, Modell lokal. Der Build prüft Paket-ID, Name, Berechtigungen, die GLB in der APK
(bytegleich), die Offline-Fähigkeit, dass der Viewer in 1C startet und ohne Fasermap läuft, die
unveränderte Prototyp-GLB und die Produktionsfiguren.

**Installieren:** wie in [DEVICE_TEST.md](DEVICE_TEST.md), Abschnitt A, aber das Artefakt
**`kalethra-FIGUR-TEST-stone-1c`** aus dem Lauf „Figure prototype APK (stone 1C)“. Gleiche
Paket-ID: Die neue APK **ersetzt** die bisherige Test-App (Kalethra selbst bleibt unberührt).
Den alten Stand siehst du über den Vergleichsknopf.

## Gerätetest 1C (Xiaomi 15 Ultra)

Bitte je Punkt **ok / Problem + Screenshot**:

| #   | Aktion                                        | Worauf achten                                                     |
| --- | --------------------------------------------- | ----------------------------------------------------------------- |
| 1   | App öffnen                                    | Überschrift „Prototyp 1C“, Messblock „Stand: 1C“, „Fehler: keine“ |
| 2   | Haut, vorne/hinten, drehen                    | warmes Elfenbein (nicht orange, nicht grau), matt, kein Glanz     |
| 3   | Bauch, Brust, Schultern, Arme, Rücken ansehen | Muskeln durch Licht und Schatten lesbar; nichts „aufgemalt“       |
| 4   | **Muskeln zeigen**                            | Figur bleibt Stein, keine Farbfelder, keine Rillen, kein Flimmern |
| 5   | **Vergleich: Stand 1A zeigen** (und zurück)   | Unterschied gut erkennbar; Umschalten ohne Fehler                 |
| 6   | Übung Bankdrücken / Latzug                    | Ist die Hervorhebung für dich noch nötig bzw. ausreichend?        |
| 7   | Nah heranhalten / Screenshot zoomen           | Körnung dezent, keine Flecken, keine Wellen                       |
| 8   | 1 Minute laufen lassen, Messblock ablesen     | Bildrate, langsamstes Bild, JS-Speicher – **in 1C und in 1A**     |

Leistungswerte gibt es erst mit dieser Messung; die Software-Renderings sagen darüber nichts.
