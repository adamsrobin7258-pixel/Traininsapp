# Manuelle Aktivitäten (Phase 8)

Sport und Bewegung, die der Nutzer selbst erfasst – Tennis, Joggen, Yoga, Skifahren … – mit
Dauer, optional Startzeit und Distanz und einem nachvollziehbar berechneten Energieverbrauch.
Offline, lokal in der verschlüsselten Datenbank, ohne Server.

## Drei getrennte Quellen

| Quelle            | Tabelle             | Wird erfasst durch             | Bearbeitbar        |
| ----------------- | ------------------- | ------------------------------ | ------------------ |
| Kalethra-Training | `workouts` …        | Training starten / beenden     | ja (Training)      |
| Health Connect    | `external_workouts` | Synchronisierung (Phase 6.3)   | nein (nur ansehen) |
| **Manuell**       | `manual_activities` | „Aktivität erfassen“ (Phase 8) | ja                 |

Nichts wird zwischen den Tabellen kopiert. Manuelle Aktivitäten sind keine Kalethra-Trainings:
Sie erscheinen nicht im Trainingsverlauf, in Plänen, bei „Nächstes Training“ oder im
Trainingsvolumen. Krafttraining gibt es deshalb bewusst **nicht** im Katalog – dafür ist das
Kalethra-Training mit Sätzen und Gewichten da.

## Datenmodell (Migration 12)

```sql
CREATE TABLE manual_activities (
  id               TEXT PRIMARY KEY NOT NULL,
  profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sport_id         TEXT NOT NULL,         -- stabile ID aus dem Katalog, z. B. 'tennis'
  local_date       TEXT NOT NULL,         -- lokaler Tag (YYYY-MM-DD)
  started_at       TEXT,                  -- optional, ISO-8601 UTC
  duration_s       INTEGER NOT NULL,      -- 60 … 86 400
  distance_m       REAL,                  -- nur wo die Sportart danach fragt, > 0 … 1 000 000
  intensity        TEXT,                  -- light | moderate | vigorous | NULL
  variant          TEXT,                  -- z. B. singles | doubles, sonst NULL
  weight_kg        REAL,                  -- Körpergewicht der Berechnung, NULL = keins bekannt
  met              REAL NOT NULL,         -- verwendeter MET-Wert, 1 … 25
  met_ref          TEXT NOT NULL,         -- Compendium-Eintrag, z. B. '15690 tennis, singles'
  met_basis        TEXT NOT NULL,         -- specific | general
  calc_method      TEXT NOT NULL,         -- 'met-net-v1'
  calculated_kcal  REAL,                  -- automatisch berechnet, NULL ohne Gewicht
  kcal             REAL,                  -- verwendeter Wert (automatisch oder eigener)
  kcal_overridden  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX manual_activities_profile_date ON manual_activities (profile_id, local_date);
```

- **Rein additiv;** bestehende Tabellen und Daten bleiben unverändert (Test: Migration auf eine
  Datenbank mit Daten, Neustart).
- Jede Zeile speichert alles, was die Berechnung benutzt hat (Gewicht, MET, Quelle, Methode).
  Ändert sich später der Katalog, bleibt ein gespeicherter Wert erklärbar; erst beim Bearbeiten
  wird neu berechnet.
- Datenkatalog: Kategorie `activity`, Sensibilität `health`, exportierbar, mit dem Profil
  gelöscht, `syncable: false`.
- Code: `src/core/activity` (rein, ohne UI), Oberfläche in `src/modules/training`
  (`ManualActivitySheet`, `ActivitiesScreen`).

## Erfassen

„Training → Aktivitäten → Aktivität erfassen“:

1. **Sportart wählen** – nach Kategorien gruppiert, durchsuchbar (Deutsch und Englisch, auch
   „fussball“ → Fußball). Das Suchfeld bekommt keinen Fokus: Die Tastatur öffnet sich erst beim
   Antippen.
2. **Formular** – nur die Felder, die die Sportart braucht: Datum (bis heute), Startzeit
   (optional), Dauer in Minuten (1–1440), Distanz in km (nur Gehen, Laufen, Radfahren,
   Schwimmen, Langlauf, Inline-Skating …; optional), Intensität oder Variante (Einzel/Doppel,
   Schwimmart, Golf zu Fuß/mit Cart), wo es den Wert verändert.
3. **Geschätzter Energieverbrauch** – wird beim Tippen live berechnet und erklärt („Automatisch
   berechnet anhand von Dauer, Körpergewicht (84,6 kg) und Aktivität. Mit deinem Tempo von
   9 km/h.“).
4. **Kalorien anpassen** (optional) – eigener Wert; Hinweis „Manuell angepasst · automatisch
   625 kcal“, zurück mit „Automatischen Wert verwenden“.

Bearbeiten öffnet dasselbe Formular, Löschen fragt nach („Aktivität löschen?“).
Health-Connect-Aktivitäten öffnen nur die Detailansicht – sie gehören Health Connect und werden
von dessen Synchronisierung verwaltet.

## Berechnung

```
kcal = (MET − 1) × 3,5 × Körpergewicht (kg) ÷ 200 × Dauer (min)
```

gerundet auf ganze kcal (`Math.round`), nie negativ. Methode `met-net-v1`
(`src/core/activity/calories.ts`).

**Warum netto (MET − 1) statt der Bruttoformel MET × 3,5 × kg ÷ 200 × min?** Die Bruttoformel
enthält den Ruheumsatz der Minuten (1 MET). Der steckt aber schon im Tagesziel (Ruheumsatz ×
Aktivitätsfaktor). Würde man brutto anrechnen, zählte der Ruheumsatz während der Aktivität
doppelt – bei 90 min Tennis und 80 kg ≈ 126 kcal zu viel. Netto ist außerdem:

- dieselbe Größe wie die „aktiven Kalorien“ von Health Connect, die neben manuellen Werten im
  selben Tagesbudget stehen,
- dieselbe Regel, die Kalethra schon für die eigene Trainingsschätzung nutzt.

Beispiel Tennis Einzel, 90 min, 80 kg: brutto 1008 kcal, netto **882 kcal**.

- **MET-Wert:** fest, nach Intensität, nach Variante oder – bei Gehen, Laufen, Radfahren – nach
  Tempo aus Distanz und Dauer. Tempostufen wechseln auf halbem Weg zwischen zwei
  Compendium-Geschwindigkeiten (z. B. Laufen 8,0 km/h → 8,3 MET, ab 8,9 km/h → 9,8 MET bei
  9,7 km/h). Ohne Distanz gilt der allgemeine Eintrag (z. B. „jogging, general“ 7,0) bzw. die
  gewählte Intensität.
- **Körpergewicht:** der jüngste eigene Eintrag bis zum Tag der Aktivität oder ein neuerer Wert
  aus Health Connect (höchstens 60 Tage alt); bei gleichem Datum gewinnt der eigene Eintrag.
  Ohne Gewicht wird nichts geschätzt: Kalethra zeigt „–“ und bittet um ein Gewicht oder einen
  eigenen Wert. Die Ernährungsziele lesen weiterhin nur eigene Gewichtseinträge.
- **Eigener Wert:** `calculated_kcal` bleibt gespeichert, `kcal` ist der eigene Wert,
  `kcal_overridden = 1`. Ein eigener Wert, der genau dem berechneten entspricht, gilt als
  automatisch. Beim Bearbeiten wird `calculated_kcal` immer neu berechnet; ein eigener Wert
  bleibt, bis „Automatischen Wert verwenden“ gewählt wird.
- Keine frei erfundenen Werte: Jeder MET-Wert nennt seinen Compendium-Eintrag.

### Quellen

- Ainsworth BE et al. _2011 Compendium of Physical Activities: a second update of codes and MET
  values._ Med Sci Sports Exerc 2011;43(8):1575–1581.
- Herrmann SD et al. _2024 Adult Compendium of Physical Activities._ J Sport Health Sci
  2024;13(1):6–12. pacompendium.com.
- 1 MET = 3,5 ml O₂ · kg⁻¹ · min⁻¹; ≈ 5 kcal je Liter O₂ (daher ÷ 200).

Die Codes sind die des Compendium 2011. **Prüfstand:** pacompendium.com und die
Original-PDFs waren aus der Entwicklungsumgebung nicht abrufbar. Werte und Codes stammen aus den
bekannten Compendium-Einträgen und wurden, wo möglich, über Suchergebnisse mit Zitat des
Originals abgeglichen (Laufen, Radfahren, Schwimmen, Tennis, Tischtennis, Fußball,
Ergometer/Spinning, Rückschlag-, Team- und Kampfsport, Golf, Klettern, Seilspringen). Eine
vollständige Prüfung gegen das Original steht aus (siehe Roadmap).

### Allgemeine Schätzwerte

Ohne eigenen Compendium-Eintrag (`met_basis = 'general'`, in der App „Allgemeiner Schätzwert“):

| Sportart         | Angelehnt an                                                       |
| ---------------- | ------------------------------------------------------------------ |
| Padel            | 15530 Racquetball, allgemein (7,0)                                 |
| Hyrox            | 12020 Joggen allgemein (7,0) / 02040 Zirkeltraining intensiv (8,0) |
| CrossFit         | 02030 / 02040 Zirkeltraining moderat (4,3) / intensiv (8,0)        |
| Muay Thai        | 15425 / 15430 Kampfsport langsam (5,3) / moderat (10,3)            |
| Wandern „leicht“ | 17200 Gehen 5,6 km/h, zügig (4,3)                                  |

## Health Connect hat Vorrang (Duplikate)

Hat die Uhr dieselbe Einheit schon in Health Connect gespeichert, zählt nur Health Connect.
Bewusst vorsichtig – eine manuelle Aktivität gilt nur als Duplikat, wenn **alles** zutrifft:

1. Sie hat eine **Startzeit** (ohne Startzeit kein Abgleich – sie zählt immer).
2. Der Health-Connect-Typ passt zur Sportart (`healthConnectTypes` im Katalog, z. B. Joggen ↔
   `running`, `runningTreadmill`).
3. Die Zeiträume überschneiden sich zu mindestens **50 % der kürzeren** Einheit (dieselbe Regel
   wie in Phase 6.3 für Kalethra-Trainings, `isSameSession`).
4. Die Dauern sind ähnlich: kürzere ÷ längere ≥ **0,5** (`SIMILAR_DURATION`).

Ein Duplikat bleibt gespeichert und sichtbar (Hinweis „Wahrscheinlich dieselbe Einheit wie eine
Health-Connect-Aktivität – sie wird nicht doppelt gezählt.“), zählt aber weder im Tagesbudget
noch im Fortschritt. Eine manuelle Aktivität mit Startzeit, die sich zu ≥ 50 % mit einem
abgeschlossenen Kalethra-Training überschneidet, zählt ebenfalls nicht. Die Regeln von Phase 6.3
(Health Connect ↔ Kalethra-Training) bleiben unverändert.

## Aktivitätskalorien anrechnen

Dieselbe Einstellung wie in Phase 6.3 (seit Phase 10 „Einstellungen → Ziele → Aktivitätskalorien“, Standard aus), jetzt für
beide Quellen. Seit Phase 12 versioniert: Sie gilt ab dem Tag, an dem sie umgelegt wird
([SETTINGS.md](SETTINGS.md)).

- **Aus:** „Aktivitätskalorien werden nicht zum Tagesziel addiert.“ – 2.300 kcal bleiben
  2.300 kcal; die Aktivitätskalorien erscheinen nur zur Information.
- **An:** „100 % der anrechenbaren Aktivitätskalorien werden zum Tagesziel addiert.“ –
  Basisziel 2.300 kcal + 500 kcal = 2.800 kcal. Bei einem eigenen Wert zählt der eigene Wert
  (automatisch 650 kcal, eigener Wert 700 kcal → +700 kcal).
- Anrechenbar = Health-Connect-Aktivitäten + manuelle Aktivitäten − Duplikate − Überschneidungen
  mit Kalethra-Trainings (`dayActivityCalories`). Das gespeicherte Basisziel, Protein (auch ein
  eigenes Protein-Ziel und die BMI-27,5-Regel), Fett, Kohlenhydrate und Wasser ändern sich nie.

## Fortschritt

Die Karte „Aktivitäten“ auf der Mainpage zählt beide Quellen (Anzahl, Dauer, aktive kcal,
Minuten pro Tag), Duplikate einmal. Seit Phase 12 zählt sie – wie Tagesbudget und Score – keine
Einheit, die dieselbe wie ein abgeschlossenes Kalethra-Training ist (vorher erschien eine solche
Health-Connect-Einheit dort zusätzlich). Die Ausschlussregeln stehen einmal in
`core/activity/combined.ts` (`importedExclusion`, `manualExclusion`) und werden von allen drei
Lesern genutzt. Sie erscheint, sobald Health Connect verbunden ist oder es
Aktivitäten im Zeitraum gibt.

## Pace (Phase 17.1)

Für Aktivitäten zu Fuß zeigt Kalethra die **Pace** in min/km – abgeleitet aus Distanz und
Dauer, **nie gespeichert** (`core/activity/pace.ts`, eine Funktion für beide Quellen):

- **Manuell:** Sportarten der Kategorien Gehen & Wandern und Laufen; als Hinweis unter dem
  Distanzfeld, sobald Dauer und Distanz eingegeben sind („Pace 6:40 min/km“).
- **Health Connect:** genau die Typen dieser Sportarten (`running`, `runningTreadmill`,
  `walking`, `hiking`); als Zeile im Aktivitätsdetail.
- Keine Pace für Radfahren, Schwimmen, Rudern, Spiel-, Kraft- oder Kampfsport und ohne Distanz.
- Nur plausible Werte: mindestens 100 m und 2:00–60:00 min/km; sonst entfällt die Angabe (kein
  Teilen durch 0, kein Unsinn aus Aufzeichnungsfehlern).
- Keine Pace-Statistik, keine Karte auf Fortschritt.

## Katalog

60 Sportarten, `src/core/activity/catalog.ts`. `*` = allgemeiner Schätzwert. Zahl in Klammern =
Compendium-Code.

| Sportart                     | ID                  | Kategorie   | Felder              | MET (Code)                                                                                                               | Health-Connect-Typen                                      |
| ---------------------------- | ------------------- | ----------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Spazieren                    | `walk`              | walking     | Distanz             | Tempo-Stufen 2,8/3/3,5/4,3/5/7/8,3; ohne Distanz 3 (17180)                                                               | walking                                                   |
| Zügiges Gehen                | `brisk-walk`        | walking     | Distanz             | Tempo-Stufen 2,8/3/3,5/4,3/5/7/8,3; ohne Distanz 4,3 (17200)                                                             | walking                                                   |
| Nordic Walking               | `nordic-walking`    | walking     | Distanz             | 4,8 (17165)                                                                                                              | walking                                                   |
| Wandern                      | `hike`              | walking     | Distanz, Intensität | leicht: 4,3 * (17200); moderat: 6 (17080); intensiv: 7 (17010)                                                           | hiking, walking                                           |
| Bergwandern                  | `mountain-hike`     | walking     | Distanz             | 7,3 (17035)                                                                                                              | hiking                                                    |
| Joggen                       | `jog`               | running     | Distanz             | Tempo-Stufen 6/8,3/9,8/11/11,8/12,8/14,5/16/19; ohne Distanz 7 (12020)                                                   | running, runningTreadmill                                 |
| Laufen                       | `run`               | running     | Distanz             | Tempo-Stufen 6/8,3/9,8/11/11,8/12,8/14,5/16/19; ohne Distanz 8 (12150)                                                   | running, runningTreadmill                                 |
| Schneller Lauf               | `fast-run`          | running     | Distanz             | Tempo-Stufen 6/8,3/9,8/11/11,8/12,8/14,5/16/19; ohne Distanz 11 (12090)                                                  | running, runningTreadmill                                 |
| Trailrunning                 | `trail-run`         | running     | Distanz             | 9 (12140)                                                                                                                | running                                                   |
| Radfahren                    | `cycle`             | cycling     | Distanz, Intensität | Tempo-Stufen 4/6,8/8/10/12/16,8; ohne Distanz 7,5 (01015); leicht: 4 (01010); moderat: 6,8 (01020); intensiv: 10 (01040) | cycling, bikingStationary                                 |
| Indoor Cycling / Spinning    | `indoor-cycling`    | cycling     | Intensität          | leicht: 6,8 (02012); moderat: 8,5 (02019); intensiv: 11 (02014)                                                          | bikingStationary, cycling                                 |
| Mountainbike                 | `mountain-bike`     | cycling     | Distanz, Intensität | moderat: 8,5 (01013); intensiv: 14 (01009)                                                                               | cycling                                                   |
| Schwimmen                    | `swim`              | water       | Distanz, Schwimmart | allgemein: 6 (18350); Kraul: 5,8 (18310); Brust: 5,3 (18250); Rücken: 4,8 (18230)                                        | swimming, swimmingPool, swimmingOpenWater                 |
| Brustschwimmen               | `swim-breaststroke` | water       | Distanz, Intensität | moderat: 5,3 (18250); intensiv: 10,3 (18240)                                                                             | swimming, swimmingPool, swimmingOpenWater                 |
| Freistil / Kraulen           | `swim-freestyle`    | water       | Distanz, Intensität | moderat: 5,8 (18310); intensiv: 9,8 (18300)                                                                              | swimming, swimmingPool, swimmingOpenWater                 |
| Wassergymnastik              | `water-aerobics`    | water       | –                   | 5,5 (18355)                                                                                                              | –                                                         |
| Rudern (Boot)                | `rowing-boat`       | water       | Intensität          | leicht: 3,5 (18070); moderat: 5,8 (18060); intensiv: 12 (18080)                                                          | rowing                                                    |
| Kajak / Kanu                 | `kayak`             | water       | –                   | 5 (18100)                                                                                                                | paddling, paddleSports                                    |
| Stand-up-Paddling            | `sup`               | water       | –                   | 6 (18365)                                                                                                                | paddling, paddleSports                                    |
| Surfen                       | `surf`              | water       | –                   | 3 (18220)                                                                                                                | surfing                                                   |
| Tennis                       | `tennis`            | racket      | Spielform           | Einzel: 8 (15690); Doppel: 6 (15680)                                                                                     | tennis                                                    |
| Badminton                    | `badminton`         | racket      | Intensität          | moderat: 5,5 (15030); intensiv: 7 (15020)                                                                                | badminton                                                 |
| Tischtennis                  | `table-tennis`      | racket      | –                   | 4 (15660)                                                                                                                | tableTennis                                               |
| Squash                       | `squash`            | racket      | –                   | 7,3 (15652)                                                                                                              | squash                                                    |
| Padel                        | `padel`             | racket      | –                   | 7 * (15530)                                                                                                              | padel                                                     |
| Fußball                      | `soccer`            | team        | Intensität          | moderat: 7 (15610); intensiv: 10 (15605)                                                                                 | soccer                                                    |
| Basketball                   | `basketball`        | team        | Intensität          | moderat: 6,5 (15055); intensiv: 8 (15040)                                                                                | basketball                                                |
| Volleyball                   | `volleyball`        | team        | Intensität          | leicht: 3 (15720); moderat: 4 (15710); intensiv: 6 (15711)                                                               | volleyball                                                |
| Beachvolleyball              | `beach-volleyball`  | team        | –                   | 8 (15725)                                                                                                                | volleyball                                                |
| Handball                     | `handball`          | team        | –                   | 12 (15320)                                                                                                               | handball                                                  |
| Hockey                       | `field-hockey`      | team        | –                   | 7,8 (15350)                                                                                                              | hockey                                                    |
| Eishockey                    | `ice-hockey`        | team        | –                   | 8 (15360)                                                                                                                | iceHockey, hockey                                         |
| HIIT                         | `hiit`              | fitness     | Intensität          | moderat: 4,3 (02030); intensiv: 8 (02040)                                                                                | highIntensityIntervalTraining                             |
| Hyrox                        | `hyrox`             | fitness     | Intensität          | moderat: 7 * (12020); intensiv: 8 * (02040)                                                                              | crossTraining, highIntensityIntervalTraining, mixedCardio |
| CrossFit                     | `crossfit`          | fitness     | Intensität          | moderat: 4,3 * (02030); intensiv: 8 * (02040)                                                                            | crossTraining, highIntensityIntervalTraining              |
| Zirkeltraining               | `circuit`           | fitness     | Intensität          | moderat: 4,3 (02030); intensiv: 8 (02040)                                                                                | crossTraining, exerciseClass, bootCamp                    |
| Seilspringen                 | `jump-rope`         | fitness     | Intensität          | leicht: 8,3 (15552); moderat: 11,8 (15551); intensiv: 12,3 (15550)                                                       | jumpRope                                                  |
| Crosstrainer                 | `elliptical`        | fitness     | –                   | 5 (02048)                                                                                                                | elliptical                                                |
| Stairmaster / Treppensteigen | `stairs`            | fitness     | –                   | 9 (02065)                                                                                                                | stairClimbing, stairClimbingMachine, stairs               |
| Rudergerät                   | `rowing-machine`    | fitness     | Intensität          | leicht: 4,8 (02070); moderat: 7 (02071); intensiv: 8,5 (02072)                                                           | rowingMachine, rowing                                     |
| Aerobic / Fitnesskurs        | `aerobics`          | fitness     | Intensität          | leicht: 5 (03016); moderat: 7,3 (03015)                                                                                  | exerciseClass, mixedCardio, stepTraining                  |
| Boxen                        | `boxing`            | combat      | Intensität          | moderat: 5,5 (15110); intensiv: 7,8 (15120)                                                                              | boxing                                                    |
| Kickboxen                    | `kickboxing`        | combat      | Intensität          | leicht: 5,3 (15425); moderat: 10,3 (15430)                                                                               | kickboxing, martialArts                                   |
| Muay Thai                    | `muay-thai`         | combat      | Intensität          | leicht: 5,3 * (15425); moderat: 10,3 * (15430)                                                                           | kickboxing, martialArts                                   |
| Judo / Grappling             | `judo`              | combat      | Intensität          | leicht: 5,3 (15425); moderat: 10,3 (15430)                                                                               | martialArts                                               |
| Kampfsport allgemein         | `martial-arts`      | combat      | Intensität          | leicht: 5,3 (15425); moderat: 10,3 (15430)                                                                               | martialArts, boxing, kickboxing                           |
| Skifahren                    | `ski`               | winter      | Intensität          | leicht: 4,3 (19150); moderat: 5,3 (19160); intensiv: 8 (19170)                                                           | skiing, downhillSkiing                                    |
| Langlauf                     | `cross-country-ski` | winter      | Distanz, Intensität | leicht: 6,8 (19080); moderat: 9 (19090); intensiv: 12,5 (19100)                                                          | crossCountrySkiing                                        |
| Snowboard                    | `snowboard`         | winter      | Intensität          | leicht: 4,3 (19185); moderat: 5,3 (19180)                                                                                | snowboarding                                              |
| Eislaufen                    | `ice-skate`         | winter      | Intensität          | leicht: 5,5 (19020); moderat: 7 (19030)                                                                                  | iceSkating, skating                                       |
| Schneeschuhwandern           | `snowshoe`          | winter      | Intensität          | moderat: 5,3 (19190); intensiv: 10 (19192)                                                                               | snowshoeing                                               |
| Yoga                         | `yoga`              | flexibility | Intensität          | leicht: 2,5 (02150); intensiv: 4 (02160)                                                                                 | yoga                                                      |
| Pilates                      | `pilates`           | flexibility | –                   | 3 (02105)                                                                                                                | pilates                                                   |
| Stretching                   | `stretching`        | flexibility | –                   | 2,3 (02101)                                                                                                              | stretching, flexibility, cooldown                         |
| Tai Chi / Qigong             | `tai-chi`           | flexibility | –                   | 3 (15670)                                                                                                                | taiChi                                                    |
| Tanzen                       | `dance`             | other       | Intensität          | leicht: 3 (03040); moderat: 5,5 (03030); intensiv: 7,8 (03025)                                                           | dance, dancing                                            |
| Klettern / Bouldern          | `climbing`          | other       | Intensität          | moderat: 5,8 (15537); intensiv: 7,5 (15535)                                                                              | climbing, rockClimbing                                    |
| Inline-Skating               | `inline-skate`      | other       | Distanz, Intensität | leicht: 7,5 (15591); moderat: 9,8 (15592); intensiv: 12,3 (15593)                                                        | skating                                                   |
| Golf                         | `golf`              | other       | Fortbewegung        | zu Fuß: 4,3 (15265); Cart: 3,5 (15290)                                                                                   | golf                                                      |
| Reiten                       | `horse-riding`      | other       | Intensität          | leicht: 3,8 (15400); moderat: 5,5 (15370); intensiv: 7,3 (15390)                                                         | –                                                         |
