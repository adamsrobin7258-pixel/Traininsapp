# Ernährungsberechnung

Wie Kalethra aus dem Ernährungsprofil Tagesziele schätzt. Code: `src/core/nutrition/calculation/`
(ohne React-, UI- oder Plattformabhängigkeiten). Alle Zahlen stehen zentral in `parameters.ts`.
Jede Berechnung speichert `CALCULATION_VERSION`, sodass spätere Anpassungen nachvollziehbar
bleiben.

In diesem Dokument ist jeder Wert markiert:

- **[Evidenz]**: veröffentlichte Gleichung oder Referenzwert.
- **[Produkt]**: von Kalethra gewählter Parameter. Er liegt innerhalb der Evidenz, ist bewusst
  vorsichtig gewählt und lässt sich zentral ändern. Tests halten die aktuelle Wahl fest.

> Alle Ergebnisse sind **Schätzungen zur Orientierung**. Vorhersagegleichungen haben
> individuelle Fehler von etwa ±10 % und mehr. Die App behauptet nie, den tatsächlichen
> Stoffwechsel zu kennen, und zeigt diesen Hinweis bei jeder Berechnung an.

## Ablauf

1. Trendgewicht → 2. Grundumsatz → 3. Alltagsaktivität → 4. Training (optional) →
2. Erhaltungsbedarf → 6. Zielanpassung → 7. Sicherheitsgrenzen → 8. Protein → 9. Fett →
3. Kohlenhydrate. Manuelle Werte ersetzen einzelne Ergebnisse. Die davon abhängigen Werte
   (Fett und Kohlenhydrate aus Kalorien und Protein) werden um sie herum berechnet.

## 1. Trendgewicht

- Quelle ist ausschließlich das Gesundheitsmodul (`weight_entries`). Nutrition speichert kein
  eigenes Gewicht.
- **[Produkt]** Grundlage ist der **Median** der Messungen der letzten 7 Tage einschließlich
  heute. Der Median ist robust gegen einzelne Ausreißer, etwa nach einem salzigen Abendessen.
- Gibt es in diesen 7 Tagen keine Messung, wird die letzte frühere Messung verwendet und als
  „nicht aktuell“ angezeigt.
- Ohne jede Messung wird nicht gerechnet. Die App nennt dann „Gewicht“ als fehlende Angabe.
- **[Produkt]** Eine neue Zielversion entsteht automatisch nur, wenn sich das Trendgewicht um
  mindestens **0,5 kg** oder das automatische Kalorienziel um mindestens **50 kcal** ändert.
  Auslöser sind der App-Start sowie Änderungen an Gewicht, Training oder Körperdaten.

## 2. Grundumsatz (Ruheenergie)

- **[Evidenz]** Mifflin-St Jeor (1990): `RMR = 10·kg + 6,25·cm − 5·Alter + s`, mit
  `s = +5` (männlich) bzw. `−161` (weiblich). In Vergleichsstudien ist die Gleichung für
  Erwachsene ohne gemessenen Körperfettanteil eine der genauesten.
- **[Produkt]** Bei „divers / keine Angabe“ gilt `s = −78`, der Mittelwert beider Konstanten.
  So wird kein Geschlecht angenommen. Der Fehler liegt höchstens bei der halben Differenz der
  Konstanten (83 kcal).
- **[Produkt]** Grenzen der Eingaben: 18–100 Jahre (die Gleichung ist für Erwachsene
  validiert), 120–230 cm, 30–300 kg. Außerhalb wird nicht gerechnet, sondern ein Hinweis
  gezeigt.
- Das Alter wird zu jedem Berechnungstag aus dem Geburtsdatum abgeleitet.

## 3. Alltagsaktivität (ohne Sport)

Faktor auf den Grundumsatz. Gemeint ist ausdrücklich der Alltag **ohne Sport**.

| Stufe                 | Beispiele                      | Faktor **[Produkt]** |
| --------------------- | ------------------------------ | -------------------- |
| Überwiegend sitzend   | Bürojob, wenig Bewegung        | 1,2                  |
| Leicht aktiv          | sitzend, regelmäßig zu Fuß/Rad | 1,3                  |
| Moderat aktiv         | viel Stehen/Gehen              | 1,4                  |
| Sehr aktiv            | körperliche Arbeit             | 1,55                 |
| Körperlich sehr aktiv | schwere körperliche Arbeit     | 1,7                  |

**[Evidenz]** Die Werte orientieren sich an den unteren PAL-Bändern (FAO/WHO/UNU 2004). Diese
Bänder liegen bei etwa 1,2 bei überwiegend liegender oder sitzender Lebensweise und bei etwa
1,7 und mehr bei schwerer körperlicher Arbeit.

## 4. Training

- Ob Training einbezogen wird, entscheidet der Nutzer: „Training in Kalorienberechnung
  einbeziehen“. **[Produkt]** Die Voreinstellung ist **aus** (datensparsam und konservativ).
  Ist es aus, erhöht Training die Kalorien nie.
- Ist es an, nutzt Kalethra nur die abgeschlossenen Trainings der letzten **28 Tage** aus dem
  Trainingsmodul, mit Datum, Trainingsart und Dauer. Es gibt keine doppelte Eingabe und keine
  erfundenen Kalorien pro Übung.
- **[Evidenz]** Die MET-Werte stammen aus dem Compendium of Physical Activities (2024). Für
  jede Trainingsfamilie wurden niedrige bis mittlere Werte gewählt: Kraft 3,5 (resistance
  training, multiple exercises), Ausdauer und Hybrid 6,0, Beweglichkeit 2,3, Sonstiges 3,5.
- **[Produkt]** Die Formel lautet `Σ (MET − 1) × kg × Stunden ÷ 28`. Es zählt nur der Anteil
  über Ruhe („− 1“), weil Grundumsatz × Alltagsfaktor die Trainingszeit bereits als normale
  Zeit enthält.
- **[Produkt]** Eine Einheit zählt mit höchstens 180 Minuten. Der Durchschnitt pro Tag ist auf
  höchstens 800 kcal begrenzt.
- **Keine Doppelzählung:** Die Alltagsaktivität schließt Sport aus, und Sport kommt nur über
  echte Trainingsdaten hinzu.

## 5. Erhaltungsbedarf

`Erhaltungsbedarf = Grundumsatz × Alltagsfaktor + Training (falls einbezogen)`

### Aktivitätskalorien aus Health Connect und manuellen Aktivitäten (Phase 6.3 / 8)

Getrennt von der Berechnung oben und nur, wenn der Nutzer „Aktivitätskalorien anrechnen“
einschaltet (**[Produkt]** Voreinstellung **aus**):

- Das berechnete bzw. eigene Kalorienziel bleibt das **Basisziel** und wird nie überschrieben.
- Für jeden Tag kommt die Summe der aktiven Kalorien der an diesem Tag begonnenen, aus Health
  Connect importierten Aktivitäten hinzu – zu 100 %, ohne Abschlag
  (`withActivityCalories`, `GoalService.dayGoal`). Beispiel: 2.300 kcal + 500 kcal = 2.800 kcal.
- Grundlage sind die Kalorien der Aktivitäten, nicht die Tagessumme „aktive Kalorien“, weil diese
  die Alltagsbewegung enthält, die der Alltagsfaktor (Abschnitt 3) bereits abdeckt.
- **Keine Doppelzählung mit Kalethra-Trainings:** Überschneidet sich eine Aktivität zu mindestens
  50 % (bezogen auf die kürzere Einheit) mit einem abgeschlossenen Kalethra-Training, gilt sie als
  dieselbe Einheit und zählt nicht. Kalethra-Trainings fließen weiterhin nur über Abschnitt 4 ein.
- Protein, Fett, Kohlenhydrate und Wasser bleiben unverändert – auch ein individuelles
  Protein-Ziel. Ohne Kalorienziel wird nichts angerechnet.
- Ist die Einstellung aus, zeigt Kalethra die Aktivitätskalorien nur zur Information.
- **Manuelle Aktivitäten (Phase 8)** zählen genauso wie Health-Connect-Aktivitäten: mit ihrem
  verwendeten Wert (bei einem eigenen Wert dieser, z. B. automatisch 650 kcal, eigener Wert
  700 kcal → +700 kcal). Ist dieselbe Einheit auch in Health Connect, zählt nur Health Connect;
  Überschneidungen mit Kalethra-Trainings zählen nicht. Berechnung (netto, MET − 1) und Regeln:
  [ACTIVITIES.md](ACTIVITIES.md).
- Die Mainpage „Fortschritt“ vergleicht mit denselben Tageszielen (`dayGoalsBetween`): mit
  Aktivitätskalorien nur bei eingeschalteter Einstellung, Durchschnitt nur über erfasste Tage.

## 6. Zielanpassung

- **[Evidenz]** Etwa 7.700 kcal entsprechen ungefähr 1 kg Körpergewicht. Das ist eine
  vereinfachte Näherung, die tatsächliche Veränderung weicht ab.
- **Abnehmen [Produkt]:**

  | Stufe     | Defizit pro Tag | Tempo               |
  | --------- | --------------- | ------------------- |
  | langsam   | −275 kcal       | ≈ 0,25 kg pro Woche |
  | moderat   | −550 kcal       | ≈ 0,5 kg pro Woche  |
  | schneller | −825 kcal       | ≈ 0,75 kg pro Woche |

  Das liegt im Rahmen üblicher Empfehlungen von etwa 0,5–1 % des Körpergewichts pro Woche.

- **Gewicht halten:** keine Anpassung.
- **Muskelaufbau [Produkt]:**
  - moderat: +5 % des Erhaltungsbedarfs, höchstens +250 kcal
  - höher: +10 %, höchstens +500 kcal

  Die Studienlage zur optimalen Höhe eines Überschusses ist weniger eindeutig als zur
  Gewichtsabnahme. Deshalb rechnet Kalethra bewusst vorsichtig und zeigt kein festes
  Zunahmetempo als Versprechen.

- Das erwartete Tempo wird mit „ca.“ angezeigt, zusammen mit dem Hinweis, dass das tatsächliche
  Gewicht davon abweichen kann.

## 7. Sicherheitsgrenzen [Produkt]

- Ein Defizit beträgt höchstens **25 %** des Erhaltungsbedarfs.
- Das Kalorienziel liegt nie unter dem **Grundumsatz** und nie unter **1.200 kcal**. Liegt
  schon der Erhaltungsbedarf darunter, wird kein Defizit angewendet.
- Jede Begrenzung wird als Hinweis angezeigt, nie stillschweigend.
- Ein manuelles Kalorienziel unter 1.200 kcal ist erlaubt, aber mit Hinweis. Die
  Eingabegrenze liegt bei 500–10.000 kcal.
- Wunschgewicht:
  - erlaubt sind 30–300 kg
  - Hinweis bei einem BMI unter 18,5
  - Hinweis, wenn es nicht zur Zielrichtung passt
  - es ersetzt nie das gemessene Gewicht
- Die Berechnung liefert nie NaN oder Infinity. Fehlende oder unplausible Angaben werden
  benannt (Tests decken das ab).

## 8. Protein

Protein wird pro kg **Referenzgewicht** berechnet, nicht als Anteil der Kalorien.

- **[Evidenz]** Für aktive Personen und Krafttraining gelten etwa 1,4–2,0 g pro kg und Tag
  (ISSN Position Stand 2017). Im Kaloriendefizit mit Krafttraining stützen höhere Mengen bis
  etwa 2,2 g/kg den Erhalt fettfreier Masse. Die Empfehlung für die Allgemeinbevölkerung liegt
  bei 0,8 g/kg (DGE).
- **[Produkt]** g pro kg:

  | Situation                                 | Abnehmen | Halten | Muskelaufbau |
  | ----------------------------------------- | -------- | ------ | ------------ |
  | ohne Krafttraining, Alltag sitzend/leicht | 1,4      | 1,2    | 1,4          |
  | ohne Krafttraining, Alltag moderat+       | 1,6      | 1,4    | 1,6          |
  | regelmäßiges Krafttraining                | 2,0      | 1,6    | 1,8          |

  Die Obergrenze liegt bei 2,2 g/kg.

- **[Produkt]** „Regelmäßiges Krafttraining“ bedeutet mindestens 4 Krafteinheiten in 28 Tagen.
  Gelesen wird das aus den lokalen Trainingsdaten, unabhängig vom Kalorien-Schalter, weil
  dieser nur die Energie betrifft.
- **[Produkt]** Referenzgewicht ist das Trendgewicht, bei einem BMI über 27,5 jedoch das
  Gewicht bei BMI 27,5. So entstehen bei hohem Körpergewicht keine unnötig extremen Werte.
- Die Anzeige trennt beides: ohne Begrenzung „1,6 g pro kg Körpergewicht · 75,0 kg“, mit
  Begrenzung „1,6 g pro kg Referenzgewicht · 86,2 kg“ plus Hinweis auf das tatsächliche
  Trendgewicht und die BMI-Grenze. So wirkt das Referenzgewicht nicht wie das Körpergewicht.
- Bei viel Muskelmasse passt der BMI als Grundlage oft nicht; dafür gibt es das individuelle
  Protein-Ziel (siehe „Manuelle Werte“). Die automatische Regel selbst bleibt unverändert.

## 9. Fett

- **[Evidenz]** Der Referenzbereich für Erwachsene liegt bei 20–35 % der Energie (DGE/EFSA).
- **[Produkt]** Standard sind 30 %. Bleiben dann weniger als 45 % für Kohlenhydrate, gelten
  25 %. Damit bleibt der Wert im Referenzbereich und nicht unnötig niedrig.

## 10. Kohlenhydrate

- **[Evidenz]** Atwater-Faktoren: Protein 4, Kohlenhydrate 4, Fett 9 kcal/g. Der
  Referenzbereich liegt bei 45–60 % der Energie.
- Kohlenhydrate = (Kalorien − 4 × Protein − 9 × Fett) ÷ 4.
- Das Ergebnis wird geprüft:
  - unter 45 %: Hinweis
  - unter 25 % oder nichts übrig: deutlicher Hinweis (nie negative Werte)
  - über 60 %: Hinweis

## Manuelle Werte

- Kalorien, Protein, Fett und Kohlenhydrate lassen sich einzeln überschreiben („Individuell“).
  Die übrigen Werte bleiben automatisch; Fett und Kohlenhydrate richten sich nach den Kalorien
  und dem Protein, die tatsächlich gelten.
- Gespeichert wird der eigene Wert als `…_manual` der Zielversion neben dem weiter berechneten
  automatischen Wert. Ist ein Ernährungsprofil gespeichert, wird er sofort übernommen
  (`GoalService.setProfileOverride`, neue Version ab heute); vor der ersten Einrichtung mit dem
  Profil.
- Manuelle Werte werden bei Gewichts- oder Trainingsänderungen, beim App-Start und durch
  Health-Connect-Importe nie verändert (`refreshAutomatic` übernimmt sie unverändert).
- Mit „Automatisch berechnen“ wird der eigene Wert entfernt und wieder der aktuelle berechnete
  Wert verwendet; spätere Gewichtsänderungen wirken dann wieder.
- **[Produkt]** Eingabebereich für eigene Werte: Protein 30–400 g (auch 210–250 g bei viel
  Muskelmasse, aber keine extremen Werte); Kalorien 500–10.000 kcal.
- Das Wasserziel ist immer ein eigener Wert.

## Historisierung

- Jede Änderung legt eine neue Version an, gültig ab dem aktuellen Tag. Am selben Tag wird
  eine Version ersetzt. Vergangene Tage werden immer mit der Version bewertet, die damals galt.
- Gespeichert werden je Version die Profilwahl, automatische und manuelle Werte und die
  vollständige Herleitung (siehe [DATABASE.md](DATABASE.md)).
- Geburtsdatum und Gewicht werden nicht dupliziert. Die Herleitung enthält nur das verwendete
  Alter und das verwendete Trendgewicht.

## Grenzen der Genauigkeit

- Vorhersagegleichungen kennen weder Körperzusammensetzung noch Stoffwechselbesonderheiten,
  Medikamente, Schwangerschaft, Stillzeit oder Erkrankungen. Für diese Fälle ist die Berechnung
  nicht gedacht.
- Alltags- und Trainingsenergie sind grobe Schätzungen. Die Trainingsdauer enthält Pausen, und
  die Intensität ist unbekannt.
- Die Regel „7.700 kcal ≈ 1 kg“ vereinfacht stark, weil sich der Körper an Defizite anpasst.
- Das tatsächliche Gewicht über mehrere Wochen ist die beste Rückmeldung. Weicht es deutlich
  vom erwarteten Tempo ab, sollte das Ziel angepasst werden. Eine automatische Kalibrierung
  daran ist ein möglicher späterer Schritt.
