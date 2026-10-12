# Marke: Symbol, Schriftzug, App-Icon

Seit Version 0.35.0. Eigene Zeichnung aus einer Quelle (`tools/brand/geometry.mjs`), alle
Dateien daraus generiert; Ablage und Erzeugung: [assets/brand/README.md](../assets/brand/README.md).

## Symbol (Hauptlogo)

Eine abstrahierte menschliche Figur im Schritt nach vorn mit erhobenem, greifendem Arm: Körper
und hinteres Bein bilden einen aufrechten Strich, Arm und vorderes Bein setzen mit kleinem
Abstand an. Zusammen lesen sie sich als das „K“ von Kalethra – Bewegung und Entwicklung, ohne
Sportgerät, ohne Piktogramm-Strichmännchen. Geschlossene Flächen (keine Konturen), dadurch von
16 px bis 1024 px gleich; ab 16 px als Figur und „K“ erkennbar.

- Raster 48 × 48, optisch zentriert. Mindestgröße 16 px (Favicon), in der App ab ca. 24 px.
- Farben: Waldgrün `#466a4c` (`--color-accent-strong`) und warmes Elfenbein `#f3efe6`
  (`--color-bg`). In der App: `--color-brand-mark` – Waldgrün auf hellen, Elfenbein auf dunklen
  Flächen. Keine Verläufe, Schatten, Konturen oder anderen Farben.
- Schutzraum: rundum mindestens ein Viertel der Symbolhöhe.

## Schriftzug

„Kalethra“ in ruhigen, geometrischen Linienbuchstaben (Linien und Bögen, runde Enden; keine
Schrift-Datei). Ergänzend: steht neben oder unter dem Symbol, nie allein als Logo. Höhe im Logo:
36 % der Symbolhöhe. Technisch getrennt (`BrandWordmark`, `kalethra-wordmark.svg`).

## Wo es steht

| Ort                        | Form                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Fortschritt (Startseite)   | Symbol am Ende der Titelzeile, eine Titelzeile hoch, dekorativ                                                        |
| Einstellungen → App → Über | Logo (Symbol + Schriftzug), benannt „Kalethra“                                                                        |
| App-Icon Android           | adaptiv: Elfenbein-Symbol auf Waldgrün, Monochrom-Ebene (Themen-Icons ab 13)                                          |
| App-Icon iOS               | 1024 px, randlos, ohne Alphakanal (iOS rundet selbst)                                                                 |
| Startbild Android          | Android 12+: System-Splash mit Symbol auf Elfenbein (dunkel: auf `#101612`); davor/sonst `splash.png` hell und dunkel |
| Startbild iOS              | Splash-Bild hell und dunkel (Erscheinungsbild „dark“)                                                                 |
| Web                        | `favicon.svg`                                                                                                         |

**Fortschritt – Regeln** (aus dem Konzept F1 übernommen): Der Kopfbereich wird nicht höher, die
Titelzeile bricht nie um, Zeitraumschalter und Score-Karte bleiben an ihrem Platz; ist zu wenig
Platz (kleines Display, sehr große Systemschrift), wird das Symbol ganz ausgeblendet statt
verkleinert (`@container`, gemessen in rem). Kein Link, keine Animation, für Screenreader
unsichtbar; die Seite heißt weiterhin nur „Fortschritt“. Keine zusätzliche Karte. Sonst zeigt
kein Bildschirm das Symbol; Score-Karte, Diagramme und Sheets bleiben frei.

Alle Formen sind inline (SVG im Code) oder Plattformressourcen – keine Bildanfrage, keine
externen Ressourcen, offline.

## Plattformdateien

Erzeugt aus derselben Geometrie, in den Größen, die die Projekte bereits verwenden (vorher
Capacitor-Platzhalter):

- Android (`android/app/src/main/res/`): `mipmap-anydpi-v26/ic_launcher(_round).xml` (adaptiv),
  `drawable/ic_kalethra_foreground|monochrome|splash.xml`, `drawable-night/ic_kalethra_splash.xml`,
  `values(-night)/kalethra_brand.xml`, `mipmap-*/ic_launcher*.png`,
  `drawable(-port|-land)(-night)(-*dpi)/splash.png`; `values/styles.xml`: Splash-Attribute im
  Start-Theme.
- iOS (`ios/App/App/Assets.xcassets/`): `AppIcon.appiconset/AppIcon-512@2x.png`,
  `Splash.imageset/` mit Dunkelvarianten.

## Grenzen

- Kein Gerätetest: Launcher-Masken der Hersteller, Themen-Icons (Android 13+) und der
  Android-12-Splash sind nur aus den Ressourcen und der CI-APK geprüft, nicht auf dem Gerät.
- iOS nur aus den Dateien geprüft (kein macOS/Xcode im Container); die CI baut iOS nur auf
  Anforderung.
- Systemschrift-Skalierung der Android-WebView: die Ausblende-Grenze ist in rem gesetzt und im
  Browser mit 200 % geprüft; auf dem Gerät zu bestätigen.
