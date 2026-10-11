# Markenfiguren

Konzept für die Markenfiguren von Kalethra (Phase F1, nur Dokumentation). Stand: Version
0.33.0, Standardbranch-Commit `c4bac31`. Dieses Dokument legt fest, **was** gezeigt wird und
**wann nicht**; Bilder, Code und Tests entstehen erst in den Phasen F2–F4
([ROADMAP.md](ROADMAP.md#markenfiguren-f1f4--in-planung)). Die allgemeinen Regeln stehen im
Designsystem unter [Markenelemente](DESIGN_SYSTEM.md#markenelemente).

Begriffe:

- **Markenfigur** – eine kleine, freigestellte Büste als Erkennungszeichen der Marke. Sie
  erklärt nichts und zeigt keine Daten.
- **Trainingsfigur** – der 3D-Körper in Training und Übungen (`public/figure/`). Er zeigt
  Bewegung und Muskelgruppen. Für ihn gelten weiterhin
  [assets/figure/docs/README.md](../assets/figure/docs/README.md) und der Asset-Vertrag.

Beide sind getrennte Dinge mit getrennten Regeln; nichts in diesem Dokument ändert die
Trainingsfigur.

## 1. Zweck

Die Markenfigur gibt der App ein wiedererkennbares, ruhiges Bildmotiv: klassische griechische
Steinskulptur als Sinnbild für Körper, Maß und Beständigkeit – passend zum Leitbild „modern ·
ruhig · hochwertig · menschlich · unkompliziert“.

Sie ist **Dekoration mit festem Zweck (Markenwiedererkennung)** und deshalb eine bewusst
begrenzte Ausnahme von der Regel „keine dekorativen Bilder ohne Inhalt“
([Bilder und Illustrationen](DESIGN_SYSTEM.md#bilder-und-illustrationen)). Die Ausnahme gilt
nur an den freigegebenen Orten (Abschnitt 4) und nur in der hier beschriebenen Form.

Nicht Zweck der Markenfigur:

- Fortschritt, Score, Gewicht, Körperform oder Trainingsleistung darstellen oder bewerten
- den Nutzer abbilden, ein Körperideal vorgeben oder zum Vergleich einladen
- Bedienung: Sie ist kein Knopf, kein Link und kein Einstieg in eine Funktion

## 2. Verbindliche Darstellung

**Motiv:** zwei kleine freigestellte Büsten, eine weiblich, eine männlich, im Stil klassischer
griechischer Steinskulpturen. Kopf, Hals, Schultern und oberer Brustkorb; Schnitt gerade unter
der Brust bzw. dem Brustansatz.

**Material und Licht:**

- feiner, matter Naturkalkstein in warmem Elfenbein; keine Politur, kein Glanzlicht, keine
  Marmoradern als Effekt, keine Bemalung
- beide Büsten aus demselben Material, mit identischem Licht, gleicher Kamerahöhe, gleicher
  Brennweite und gleichem Maßstab gerendert
- weiches, gerichtetes Licht von links oben vorne, ruhiger Schattenverlauf, keine harten
  Schlagschatten auf den Hintergrund; kein Hintergrund (transparent freigestellt)

**Anatomie und Haltung:**

- anatomisch glaubwürdig, gesunde, trainierte Alltagsproportionen
- **keine** Bodybuilder-Proportionen, keine übertriebenen Muskeln, keine extrem schmale Taille
- **nicht sexualisiert**: neutrale, aufrechte Haltung, ruhiger Blick, keine betonten
  Körperzonen; die weibliche Büste mit klassischem Gewandansatz oder so geschnitten, dass sie in
  ihrer Wirkung der männlichen gleichwertig ist
- **nicht künstlich**: kein Comic-, Spiel- oder Plastiklook, keine glatten Puppengesichter,
  keine sichtbaren Polygonkanten, keine KI-typischen Artefakte

**Gleichwertigkeit:** männlich und weiblich sind gleich groß dargestellt, gleich detailliert,
gleich ausgeleuchtet und gleich hochwertig. Keine Figur steht vorne, keine ist kleiner, blasser
oder angeschnitten. Reihenfolge im Paar: fest und für alle Nutzer gleich (vorläufig: weiblich
links, männlich rechts, Blick jeweils leicht zur Mitte); sie bedeutet keine Rangfolge.

**Hell und dunkel:** die Büsten müssen auf `--color-bg` in beiden Modi funktionieren – ohne
weißen Kasten, ohne Lichthof. Ob eine Variante für beide Modi reicht oder zwei Varianten
(`-light`/`-dark`) nötig sind, wird in F2 an echten Bildern entschieden.

## 3. Header-Verhalten

Erster und vorerst einziger Ort: der Kopfbereich der Seite **Fortschritt**
(`ProgressScreen` → `Screen`).

**Platzierung:** das Paar sitzt rechts neben dem Titel „Fortschritt“, in der Titelzeile,
rechtsbündig am Seitenrand (Gutter), vertikal zur Titelzeile zentriert.

**Feste Grenzen (verbindlich):**

1. Der Kopfbereich wird durch die Markenfigur **nicht höher**. Die Höhe des Paars ist höchstens
   die Höhe der Titelzeile (Zeilenhöhe des Titels).
2. Die Markenfigur **bricht nie in eine eigene Zeile um** und schiebt den Titel nicht in eine
   zweite Zeile.
3. Die Lage von Zeitraumschalter (`SegmentedControl`), Zeitraumzeile (`range`) und
   Score-Karte bleibt **pixelgleich** zur Seite ohne Markenfigur.
4. Die **Score-Karte bleibt frei von Figuren**; auch keine Figur im oder am Score-Ring.
5. Die Begrüßungszeile (Eyebrow) wird nicht überdeckt und nicht gekürzt.

**Ausblenden statt Quetschen:** Ist nicht genug Platz für eine saubere Darstellung, wird das
Paar **vollständig ausgeblendet** – nicht verkleinert unter die Mindestgröße, nicht beschnitten,
nicht eine Büste allein. Gründe zum Ausblenden:

- freie Breite rechts neben dem Titel kleiner als Paarbreite plus Abstand (Abschnitt 6)
- große Systemschrift, bei der der Titel die Zeile füllt oder umbricht
- Bild nicht geladen oder fehlerhaft (dann kein Platzhalter, kein Rahmen, keine Fehlermeldung)

Die Entscheidung „zeigen/ausblenden“ hängt **nur** vom verfügbaren Platz und vom Ladezustand ab,
nie von Nutzerdaten.

**Bewegung:** keine Animation, kein Einblenden, kein Parallax. Erscheint die Figur nach dem
Laden, dann ohne Übergang (die Titelzeile darf dabei nicht springen, siehe Grenze 3).

**Zugänglichkeit:** rein dekorativ – leerer Alternativtext bzw. `aria-hidden`, nicht
fokussierbar, keine Rolle, kein Tooltip, nicht antippbar; Screenreader lesen auf der Seite
weiterhin nur „Fortschritt“ als Überschrift.

**Bisherige Platzschätzung (F0, nicht auf dem Gerät gemessen):** Breite von „Fortschritt“
(32 px fett) ca. 156 / 202 / 312 px bei 100 / 130 / 200 % Schrift; daraus freie Breite rechts
neben dem Titel bei Viewport 320 px ca. 112 / 66 / 0 px, 360 px ca. 152 / 106 / 0 px, 390 px ca.
182 / 136 / 26 px, 430 px ca. 222 / 176 / 66 px. Diese Werte sind **Schätzungen** (Schrift Inter
als Ersatz für Roboto, Systemschrift-Skalierung der Android-WebView nicht geprüft) und müssen vor
F3 auf dem Xiaomi gemessen werden.

## 4. Auswahlregeln

**Standard:** immer **beide Büsten als Paar**, für alle Nutzer gleich.

**Keine Auswahl nach** Geschlecht (`profile.sex`), Gewicht, Körperform, Score,
Trainingsleistung, Tageszeit, Zufall oder anderen Gesundheits- oder Profildaten. Die
Markenfigur liest keine Profil- oder Gesundheitsdaten.

**Getrennt von der Trainingsfigur:** Die bestehende Regel der Trainingsfigur
(`figureVariantFor(profile.sex)`, Standard männlich bei „keine Angabe“) bleibt unverändert und
gilt nicht für die Markenfigur. Umgekehrt beeinflusst die Markenfigur die Trainingsfigur nicht.

**Keine eigene Einstellung jetzt:** Es gibt keine Einstellung, keine neuen persönlichen Daten
und keine neuen Datenbankfelder. Eine spätere Einstellung „Beide / Weiblich / Männlich“ ist nur
eine **Idee für später**; sie bräuchte eine eigene Freigabe und würde dann als technische
App-Einstellung, nicht als Profildatum, geführt.

**Freigegebene Orte (abschließende Liste):**

| Ort                            | Status            |
| ------------------------------ | ----------------- |
| Fortschritt, Kopfbereich       | vorgesehen (F3)   |
| alle anderen Bildschirme/Tabs  | nicht freigegeben |
| Score-Karte, Diagramme, Sheets | ausgeschlossen    |

Jede Erweiterung dieser Liste braucht eine **eigene, ausdrückliche Freigabe**.

**Höchstens ein Markenelement je Bildschirm.** Das Paar zählt als ein Element.

**Spätere Änderung an `Screen`:** Wird `Screen` für die Markenfigur erweitert, dann nur
**optional** (z. B. ein zusätzlicher, standardmäßig leerer Platz in der Titelzeile). Ohne diese
Angabe rendert `Screen` exakt wie bisher; die übrigen Tabs ändern sich nicht.

## 5. Asset- und Renderstrategie

**Statische lokale Bilder, kein 3D auf der Fortschritt-Seite.** Die Büsten werden einmalig
offline gerendert und als fertige Rastergrafiken ausgeliefert. Auf der Fortschritt-Seite wird
kein three.js, kein GLB und kein WebGL geladen.

**Ablage (nach Designsystem):** `public/visuals/brand/` mit

- den Bilddateien (WebP, transparent; Namen z. B. `bust-pair@2x.webp`, `bust-pair@3x.webp`;
  ggf. `-light`/`-dark`)
- `ATTRIBUTION.md` mit Quelle, Urheber, Lizenz und Änderungen je Datei
- einer Manifestdatei mit Dateiname, Abmessungen, Größe in Bytes und SHA-256 je Bild

Einbindung über relative Pfade, nie aus dem Netz zur Laufzeit, offline vollständig verfügbar.

**Herkunft der Bilder:** nur eigene Renderings aus Quellen mit geklärter Lizenz (siehe
Abschnitt 7). Ausgeschlossen: Fotos realer Skulpturen oder Museumsbilder, Stock-Bilder,
KI-Bilder ungeklärter Herkunft, Nachbildung eines bestimmten realen Kunstwerks.

**Renderweg (Vorschlag, Entscheidung in F2):**

1. Ausgangsmodelle: die vorhandenen Produktionskörper (männlich und weiblich) oder ein in F2
   freigegebenes anderes Modell – in Ruhepose, Büstenausschnitt.
2. Ein reproduzierbares Renderskript unter `tools/` (Kamera, Licht, Material, Ausschnitt,
   Auflösung als Konfiguration), das nur die Bilder unter `public/visuals/brand/` schreibt.
3. Die Produktionsfiguren unter `public/figure/` und `assets/figure/` werden dabei **nur gelesen
   und nicht verändert**; ihre Prüfsummen bleiben gleich.
4. Der Figuren-Prototyp (`claude/figure-prototype-device-test`) ist **nicht** Teil dieses Wegs,
   solange er nicht gesondert freigegeben ist.

Ob die Produktionskörper für eine glaubwürdige Steinbüste (Gesicht, Haar, Schnittkante) genügen,
ist offen und wird in F2 an Probebildern entschieden – bevor Dateien eingecheckt werden.

## 6. Vorläufige Bildspezifikation

Alle Zahlen sind **vorläufige Zielwerte**. Sie sind nicht auf dem Gerät geprüft und werden in F2
(Bilder) und F3/F4 (Gerät) bestätigt oder angepasst.

| Merkmal                        | Vorläufiger Zielwert                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| Darstellungshöhe des Paars     | ca. 36 px (≈ Zeilenhöhe des Titels: 32 px × 1,15), nie höher als diese |
| Darstellungsbreite des Paars   | ca. 64 px (zwei Büsten je ca. 28 px plus ca. 8 px Abstand)             |
| Mindestabstand zum Titel       | 12 px (wie `gap` der Titelzeile)                                       |
| Mindestgröße                   | Darstellungshöhe; kleiner wird nicht skaliert, sondern ausgeblendet    |
| Pixeldichte der Dateien        | 2× und 3× (z. B. ca. 128 × 72 px und 192 × 108 px)                     |
| Renderauflösung (Arbeitsstand) | mindestens 4× der Darstellungsgröße, danach verkleinert                |
| Format                         | WebP mit Alphakanal                                                    |
| Dateigröße je Datei            | Ziel ≤ 15 KB, Obergrenze 30 KB                                         |
| Alle Markenbilder zusammen     | ≤ 100 KB                                                               |
| Farbraum                       | sRGB                                                                   |
| Hintergrund                    | transparent, keine Kante, kein Lichthof                                |

Daraus folgt nach den Schätzungen aus Abschnitt 3 (ebenfalls ungeprüft): Bei 100 % Schrift
reicht der Platz ab 320 px Breite; bei 130 % erst ab etwa 360 px knapp sicher; bei 200 % wird
das Paar in der Regel ausgeblendet. Gilt eine Größe von 36 px auf dem Gerät als zu klein, um die
Büsten als Skulpturen zu erkennen, wird die Platzierung neu entschieden – nicht die Grenzen aus
Abschnitt 3 gelockert.

## 7. Lizenz- und Attributionsstatus

**Status: offen. Die Lizenzfrage ist nicht rechtlich geprüft oder bestätigt.** Sie ist eine
**Freigabebedingung**: Ohne ausdrückliche Klärung durch den Projektinhaber werden keine
Markenbilder eingecheckt oder in die App übernommen.

Bekannter Sachstand (Dokumentlage, keine rechtliche Bewertung):

- **Männlicher Produktionskörper:** basiert auf „Proxy Human base Mesh“ von sphere_joe, laut
  Quelle lizenziert unter CC BY 4.0, für Kalethra bearbeitet
  ([assets/figure/male/source/ATTRIBUTION.md](../assets/figure/male/source/ATTRIBUTION.md)). Die
  App nennt dies unter Einstellungen → App → Datenquellen im Abschnitt „3D-Körper“.
- **Weiblicher Produktionskörper, Topologie, Hände, Füße:** MakeHuman-Assets, laut
  Lizenzdatei des Asset-Repositorys CC0 1.0.

Offene Fragen, die vor F2-Abschluss beantwortet werden müssen:

1. Sind gerenderte Bilder aus dem männlichen Körper als Bearbeitung des CC-BY-Werks zu
   behandeln, und welche Angaben sind dann für die Markenbilder nötig?
2. Reicht der bestehende Datenquellen-Eintrag „3D-Körper“, oder braucht es einen eigenen Eintrag
   für die Markenbilder? Ein bestimmter Attributionstext gilt **nicht** als ausreichend, solange
   das nicht geklärt ist.
3. Ist der Hinweis „vom Urheber nicht unterstützt oder gebilligt“ auch bei Verwendung als
   Markenmotiv angemessen und ausreichend, und ist die Verwendung eines CC-BY-Werks als
   **Markenzeichen** überhaupt gewünscht? (Alternative: Büsten ausschließlich aus CC0-Quellen
   oder eigenen Modellen.)
4. Gibt es Rechte Dritter am Stil oder an Vorbildern (z. B. wenn eine Büste einem bestimmten
   realen Werk zu nahekommt)?

Pflicht unabhängig vom Ergebnis: `public/visuals/brand/ATTRIBUTION.md` mit vollständiger
Herkunft je Datei und ein passender Eintrag unter Datenquellen in Deutsch und Englisch.

## 8. Voraussetzungen vor F2

F2 (Bilder erzeugen) beginnt erst, wenn alle Punkte erfüllt sind:

1. **Ausdrückliche Freigabe für F2** durch den Projektinhaber.
2. Dieses Konzept (F1) ist freigegeben, einschließlich der Ausnahme „Markenelemente“ im
   Designsystem.
3. Entscheidung über die **Quelle der Modelle** (Produktionskörper, CC0-Quelle oder eigenes
   Modell) unter Beachtung von Abschnitt 7.
4. Entscheidung, wie mit der **offenen Lizenzfrage** umgegangen wird (klären lassen, CC0-only
   oder bewusst getragenes Restrisiko) – schriftlich festgehalten.
5. Festgelegt, wo das Renderskript liegt und welche Werkzeuge es nutzen darf (ohne neue
   Abhängigkeiten der App).
6. Der Standardbranch ist der Ausgangspunkt; Produktionsfiguren und Prototyp bleiben unverändert.

Vor F3 (Einbindung) zusätzlich: Messung der freien Titelbreite auf dem Xiaomi bei 100 %, 130 %
und größter Systemschrift.

## 9. Testkonzept

Die Tests entstehen in F2/F3; hier ist festgelegt, **was** sie prüfen müssen.

**Assets (F2):**

- Manifesttest: jede Datei unter `public/visuals/brand/` steht im Manifest; Abmessungen, Größe
  und SHA-256 stimmen; keine unbekannten Dateien.
- Größenbudget: jede Datei und die Summe innerhalb der Werte aus Abschnitt 6.
- `ATTRIBUTION.md` vorhanden und nennt jede Bilddatei.
- Prüfsummen der Produktionsfiguren (männlich, weiblich) unverändert.

**Logik und Komponente (F3):**

- Auswahl: für `profile.sex` = `male`, `female`, `unspecified` und für beliebige Gewichts-,
  Score- und Uhrzeitwerte ist das Ergebnis immer das Paar.
- Die Komponente liest keine Profil- oder Gesundheitsdaten (keine entsprechenden Hooks).
- Zugänglichkeit: Bild dekorativ (`alt=""` bzw. `aria-hidden`), nicht fokussierbar, keine Rolle,
  kein Klick-Handler.
- `Screen` ohne die neue Angabe rendert unverändert (Vergleich mit dem bisherigen Markup);
  andere Tabs enthalten kein Markenelement.
- Score-Karte enthält kein Bild und keine Markenfigur.
- Fehlendes oder fehlerhaftes Bild: nichts sichtbar, kein Platzhalter, kein Fehlertext.

**Ende-zu-Ende (F3, Playwright):**

- Viewports 320, 360, 390 und 430 px, Schrift 100 %, 130 % und 200 %, hell und dunkel.
- Höhe des Kopfbereichs und Lage (Bounding Boxes) von Zeitraumschalter, Zeitraumzeile und
  Score-Karte identisch mit und ohne Markenfigur.
- Titel bleibt einzeilig, wo er es vorher war; die Markenfigur liegt vollständig in der
  Titelzeile und überlappt weder Titel noch Begrüßung.
- Bei zu wenig Platz ist das Paar vollständig ausgeblendet (nie eine Büste allein, nie
  beschnitten).
- Weiterhin genau ein Knopf in `main`, kein horizontales Scrollen, Touch-Ziele ≥ 44 px
  (bestehende Prüfungen in `e2e/progress.spec.ts`).
- Keine Netzwerkanfragen an fremde Hosts; kein WebGL-Kontext auf der Fortschritt-Seite.

**Gerät (F4):** Xiaomi 15 Ultra, hell/dunkel, kleinste und größte Systemschrift: Erkennbarkeit
der Büsten, Wirkung des Materials, kein Springen beim Laden, Ausblenden bei großer Schrift.
