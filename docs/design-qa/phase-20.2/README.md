# QA Phase 20.2 – alle Bereiche (vorher 0.32.0 / nachher 0.33.0)

Je Bild links 0.32.0, rechts 0.33.0. Produktions-Build in headless Chromium (Playwright, mobile
Emulation, `reducedMotion: reduce`, frische Datenbank, Daten über die App eingegeben: Ziele, ein
Plan „Push Pull“, ein Training mit einem Satz, ein Lebensmittel, 500 ml Wasser, ein Gewicht) –
**kein Gerätetest**. 390 px hell und dunkel für alle Hauptseiten, 320 px hell und dunkel für die
wichtigsten.

| Name               | Inhalt                                               |
| ------------------ | ---------------------------------------------------- |
| `training-plan`    | Training mit nächstem Training aus dem Plan          |
| `training-history` | Training nach einem abgeschlossenen Training         |
| `focus`            | Aktives Training, Fokusansicht                       |
| `focus-rest`       | Fokusansicht nach einem Satz, Pausenleiste           |
| `workout-list`     | Aktives Training, „Alle Übungen“                     |
| `sheet-summary`    | Trainingsabschluss                                   |
| `workout-detail`   | Abgeschlossenes Training                             |
| `plan`             | Trainingsplan mit zwei Tagen                         |
| `exercises`        | Übungsbibliothek                                     |
| `activities-empty` | Aktivitäten ohne Einträge                            |
| `nutrition-day`    | Ernährung mit Eintrag und Wasser                     |
| `sheet-meal`       | Mahlzeit geöffnet                                    |
| `sheet-add`        | Lebensmittel hinzufügen                              |
| `sheet-quantity`   | Menge eintragen                                      |
| `health-empty`     | Gesundheit ohne Gewicht (kein leerer „Verlauf“ mehr) |
| `health-data`      | Gesundheit mit Gewicht                               |
| `settings-filled`  | Einstellungen                                        |
| `profile`, `goals` | Profil, Ziele                                        |
| `content`, `app`   | Meine Inhalte, App                                   |

In Ganzseiten-Aufnahmen erscheint die fest positionierte Tab-Leiste mitten im Bild – ein Effekt
der Aufnahme. Alle 160 Einzelaufnahmen (40 Screens × 4 Varianten) wurden durchgesehen; hier liegt
eine Auswahl.
