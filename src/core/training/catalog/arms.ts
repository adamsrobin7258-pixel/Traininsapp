import { ex } from './define';

export const BICEPS = [
  ex({
    id: 'sys.barbell-curl',
    nameDe: 'Langhantel-Bizepscurls',
    nameEn: 'Barbell Curl',
    equipment: 'barbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    secondary: ['forearms'],
    aliases: ['LH Curls', 'Langhantelcurls', 'Barbell Biceps Curl'],
    descriptionDe:
      'Im Stand die Stange im Untergriff halten. Ellbogen am Körper lassen und die Stange zur Brust beugen.',
    descriptionEn:
      'Standing, hold the bar with an underhand grip. Keep the elbows at your sides and curl the bar towards the chest.',
  }),
  ex({
    id: 'sys.ez-bar-curl',
    nameDe: 'SZ-Bizepscurls',
    nameEn: 'EZ-Bar Curl',
    equipment: 'ezBar',
    movementPattern: 'isolation',
    primary: ['biceps'],
    secondary: ['forearms'],
    aliases: ['SZ Curls', 'SZ-Stangen-Curls', 'EZ Curl'],
    descriptionDe:
      'SZ-Stange an den schrägen Griffflächen fassen. Ellbogen ruhig halten und die Stange nach oben beugen.',
    descriptionEn:
      'Grip the EZ bar on the angled sections. Keep the elbows still and curl the bar up.',
  }),
  ex({
    id: 'sys.biceps-curl',
    nameDe: 'Kurzhantel-Bizepscurls',
    nameEn: 'Dumbbell Biceps Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    secondary: ['forearms'],
    aliases: ['Bizepscurls', 'Biceps Curl', 'KH Curls', 'Dumbbell Curl', 'Bizeps Curls'],
    descriptionDe:
      'Kurzhanteln seitlich halten, Handflächen nach vorne. Abwechselnd oder gleichzeitig zur Schulter beugen und langsam senken.',
    descriptionEn:
      'Hold the dumbbells at your sides, palms forward. Curl them to the shoulders, alternating or together, and lower slowly.',
  }),
  ex({
    id: 'sys.hammer-curl',
    nameDe: 'Hammer Curls',
    nameEn: 'Hammer Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    secondary: ['forearms'],
    aliases: ['Hammercurls', 'Neutralgriff Curls'],
    descriptionDe:
      'Kurzhanteln mit Daumen nach oben (Neutralgriff) halten und zur Schulter beugen, ohne das Handgelenk zu drehen.',
    descriptionEn:
      'Hold the dumbbells with thumbs up (neutral grip) and curl them to the shoulders without rotating the wrists.',
  }),
  ex({
    id: 'sys.cable-hammer-curl',
    nameDe: 'Hammer Curls am Kabel',
    nameEn: 'Cable Rope Hammer Curl',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['biceps'],
    secondary: ['forearms'],
    aliases: ['Seil Hammer Curls'],
    descriptionDe:
      'Seil am tiefen Kabelzug im Neutralgriff fassen. Ellbogen am Körper lassen und das Seil nach oben beugen.',
    descriptionEn:
      'Grip a rope on a low cable with a neutral grip. Keep the elbows at your sides and curl the rope up.',
  }),
  ex({
    id: 'sys.incline-dumbbell-curl',
    nameDe: 'Schrägbank-Curls',
    nameEn: 'Incline Dumbbell Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Incline Curls', 'Schrägbank Bizepscurls'],
    descriptionDe:
      'Auf einer Schrägbank zurücklehnen, Arme hängen gestreckt nach unten. Kurzhanteln nach oben beugen, Oberarme bleiben ruhig.',
    descriptionEn:
      'Lean back on an incline bench with the arms hanging straight. Curl the dumbbells up while the upper arms stay still.',
  }),
  ex({
    id: 'sys.concentration-curl',
    nameDe: 'Konzentrationscurls',
    nameEn: 'Concentration Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Konzentrations-Curls'],
    descriptionDe:
      'Sitzend den Ellbogen an der Innenseite des Oberschenkels abstützen und die Kurzhantel einarmig nach oben beugen.',
    descriptionEn:
      'Sitting, brace the elbow against the inner thigh and curl the dumbbell up with one arm.',
  }),
  ex({
    id: 'sys.preacher-curl',
    nameDe: 'SZ-Scott-Curls',
    nameEn: 'EZ-Bar Preacher Curl',
    equipment: 'ezBar',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Scottcurls', 'Preacher Curl', 'Larry Scott Curls'],
    descriptionDe:
      'Oberarme flach auf das Polster der Scottbank legen. SZ-Stange nach oben beugen und fast bis zur Streckung absenken.',
    descriptionEn:
      'Rest the upper arms flat on the preacher pad. Curl the EZ bar up and lower it to nearly full extension.',
  }),
  ex({
    id: 'sys.dumbbell-preacher-curl',
    nameDe: 'Kurzhantel-Scott-Curls',
    nameEn: 'Dumbbell Preacher Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['KH Scottcurls'],
    descriptionDe:
      'Einarmig mit dem Oberarm auf dem Polster der Scottbank. Kurzhantel nach oben beugen und kontrolliert absenken.',
    descriptionEn:
      'One arm at a time with the upper arm on the preacher pad. Curl the dumbbell up and lower it under control.',
  }),
  ex({
    id: 'sys.machine-preacher-curl',
    nameDe: 'Bizepscurls an der Maschine',
    nameEn: 'Machine Biceps Curl',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Bizepsmaschine', 'Machine Preacher Curl'],
    descriptionDe:
      'Sitz so einstellen, dass die Ellbogen auf Höhe der Drehachse liegen. Griffe nach oben beugen.',
    descriptionEn: 'Adjust the seat so the elbows line up with the pivot. Curl the handles up.',
  }),
  ex({
    id: 'sys.cable-curl',
    nameDe: 'Bizepscurls am Kabel',
    nameEn: 'Cable Curl',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Kabelcurls', 'Cable Biceps Curl'],
    descriptionDe:
      'Gerade Stange am tiefen Kabelzug im Untergriff fassen. Ellbogen am Körper lassen und nach oben beugen.',
    descriptionEn:
      'Take a straight bar on a low cable with an underhand grip. Keep the elbows at your sides and curl up.',
  }),
  ex({
    id: 'sys.bayesian-cable-curl',
    nameDe: 'Bayesian Curls am Kabel',
    nameEn: 'Bayesian Cable Curl',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Kabelcurls hinter dem Körper', 'Behind-the-Body Cable Curl'],
    descriptionDe:
      'Mit dem Rücken zum Kabelzug stehen, Arm hinter dem Körper gestreckt. Griff nach vorne oben beugen, Oberarm bleibt hinten.',
    descriptionEn:
      'Stand with your back to the cable, arm stretched behind you. Curl the handle forward and up while the upper arm stays back.',
  }),
  ex({
    id: 'sys.spider-curl',
    nameDe: 'Spider Curls',
    nameEn: 'Spider Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    descriptionDe:
      'Bäuchlings auf einer Schrägbank liegen, Arme hängen senkrecht nach unten. Kurzhanteln nach oben beugen.',
    descriptionEn:
      'Lie chest-down on an incline bench with the arms hanging straight down. Curl the dumbbells up.',
  }),
  ex({
    id: 'sys.drag-curl',
    nameDe: 'Drag Curls',
    nameEn: 'Drag Curl',
    equipment: 'barbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    descriptionDe:
      'Stange eng am Körper entlang nach oben ziehen, dabei die Ellbogen nach hinten führen.',
    descriptionEn: 'Drag the bar up close along your body while moving the elbows back.',
  }),
  ex({
    id: 'sys.band-curl',
    nameDe: 'Bizepscurls mit Widerstandsband',
    nameEn: 'Band Biceps Curl',
    equipment: 'band',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['Band Curls'],
    descriptionDe:
      'Auf die Mitte des Bandes stellen, Enden im Untergriff halten und zu den Schultern beugen.',
    descriptionEn:
      'Stand on the middle of the band, hold the ends with an underhand grip and curl them to the shoulders.',
  }),
  ex({
    id: 'sys.zottman-curl',
    nameDe: 'Zottman Curls',
    nameEn: 'Zottman Curl',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['biceps'],
    secondary: ['forearms'],
    descriptionDe:
      'Kurzhanteln im Untergriff nach oben beugen, oben in den Obergriff drehen und langsam absenken.',
    descriptionEn:
      'Curl the dumbbells up with an underhand grip, rotate to an overhand grip at the top and lower slowly.',
  }),
  ex({
    id: 'sys.suspension-biceps-curl',
    nameDe: 'Bizepscurls am Schlingentrainer',
    nameEn: 'Suspension Biceps Curl',
    exerciseType: 'bodyweight',
    equipment: 'suspension',
    movementPattern: 'isolation',
    primary: ['biceps'],
    aliases: ['TRX Curls'],
    descriptionDe:
      'Griffe im Untergriff halten und nach hinten lehnen. Körper durch Beugen der Arme zu den Händen ziehen.',
    descriptionEn:
      'Hold the handles with an underhand grip and lean back. Pull your body towards the hands by bending the arms.',
  }),
];

export const TRICEPS = [
  ex({
    id: 'sys.triceps-pushdown',
    nameDe: 'Trizepsdrücken am Kabel',
    nameEn: 'Cable Triceps Pushdown',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Trizepsdrücken', 'Triceps Pushdown', 'Pushdown', 'Trizeps Kabel'],
    descriptionDe:
      'Gerade Stange am hohen Kabelzug. Ellbogen am Körper fixieren und die Stange nach unten strecken.',
    descriptionEn:
      'Straight bar on a high cable. Pin the elbows to your sides and extend the bar downward.',
  }),
  ex({
    id: 'sys.rope-pushdown',
    nameDe: 'Trizepsdrücken mit Seil',
    nameEn: 'Rope Triceps Pushdown',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Seil Pushdown', 'Rope Pushdown'],
    descriptionDe:
      'Seil am hohen Kabelzug nach unten drücken und die Enden unten leicht auseinanderziehen.',
    descriptionEn:
      'Press the rope down on a high cable and pull the ends slightly apart at the bottom.',
  }),
  ex({
    id: 'sys.reverse-grip-pushdown',
    nameDe: 'Trizepsdrücken im Untergriff',
    nameEn: 'Reverse-Grip Triceps Pushdown',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Reverse Pushdown'],
    descriptionDe:
      'Stange am hohen Kabelzug im Untergriff fassen und mit fixierten Ellbogen nach unten strecken.',
    descriptionEn:
      'Grip the bar on a high cable underhand and extend it down with the elbows fixed.',
  }),
  ex({
    id: 'sys.overhead-cable-extension',
    nameDe: 'Überkopf-Trizepsstrecken am Kabel',
    nameEn: 'Overhead Cable Triceps Extension',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Overhead Extension Kabel', 'Kabel Überkopfstrecken'],
    descriptionDe:
      'Mit dem Rücken zum Kabelzug, Seil hinter dem Kopf. Arme nach vorne oben strecken, Oberarme bleiben neben dem Kopf.',
    descriptionEn:
      'Face away from the cable with the rope behind your head. Extend the arms forward and up while the upper arms stay beside the head.',
  }),
  ex({
    id: 'sys.overhead-dumbbell-extension',
    nameDe: 'Überkopf-Trizepsstrecken mit Kurzhantel',
    nameEn: 'Overhead Dumbbell Triceps Extension',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Trizeps Überkopf', 'Dumbbell Overhead Extension'],
    descriptionDe:
      'Eine Kurzhantel mit beiden Händen über dem Kopf halten, hinter den Kopf senken und wieder nach oben strecken.',
    descriptionEn:
      'Hold one dumbbell overhead with both hands, lower it behind your head and extend back up.',
  }),
  ex({
    id: 'sys.seated-ez-overhead-extension',
    nameDe: 'SZ-Trizepsstrecken über Kopf sitzend',
    nameEn: 'Seated EZ-Bar Overhead Extension',
    equipment: 'ezBar',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['French Press sitzend', 'Seated French Press'],
    descriptionDe:
      'Sitzend die SZ-Stange über dem Kopf halten. Hinter den Kopf absenken, Ellbogen zeigen nach vorne, und wieder strecken.',
    descriptionEn:
      'Seated, hold the EZ bar overhead. Lower it behind your head with elbows pointing forward and extend again.',
  }),
  ex({
    id: 'sys.skull-crusher',
    nameDe: 'SZ-Stirndrücken',
    nameEn: 'EZ-Bar Skull Crusher',
    equipment: 'ezBar',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Stirndrücken', 'French Press liegend', 'Skull Crusher', 'Lying Triceps Extension'],
    descriptionDe:
      'Auf der Flachbank liegend die SZ-Stange über der Brust halten. Zur Stirn absenken, Oberarme bleiben ruhig, und wieder strecken.',
    descriptionEn:
      'Lying on a flat bench, hold the EZ bar above the chest. Lower it towards the forehead with still upper arms and extend again.',
  }),
  ex({
    id: 'sys.dumbbell-lying-extension',
    nameDe: 'Kurzhantel-Trizepsstrecken liegend',
    nameEn: 'Dumbbell Lying Triceps Extension',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['KH Stirndrücken'],
    descriptionDe:
      'Auf der Flachbank liegend Kurzhanteln im Neutralgriff seitlich neben den Kopf senken und wieder strecken.',
    descriptionEn:
      'Lying on a flat bench, lower the dumbbells with a neutral grip beside your head and extend again.',
  }),
  ex({
    id: 'sys.close-grip-bench-press',
    nameDe: 'Enges Bankdrücken',
    nameEn: 'Close-Grip Bench Press',
    equipment: 'barbell',
    movementPattern: 'horizontalPush',
    primary: ['triceps'],
    secondary: ['chest', 'shoulders'],
    aliases: ['Bankdrücken eng', 'CGBP'],
    descriptionDe: 'Bankdrücken mit etwa schulterbreitem Griff. Ellbogen nah am Körper führen.',
    descriptionEn:
      'Bench press with about a shoulder-width grip. Keep the elbows close to the body.',
  }),
  ex({
    id: 'sys.bench-dip',
    nameDe: 'Bank-Dips',
    nameEn: 'Bench Dip',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPush',
    primary: ['triceps'],
    secondary: ['chest', 'shoulders'],
    aliases: ['Trizeps-Dips an der Bank', 'Bench Dips'],
    descriptionDe:
      'Hände hinter dem Körper auf eine Bank stützen. Durch Beugen der Ellbogen absenken und wieder hochdrücken.',
    descriptionEn:
      'Support yourself with the hands on a bench behind you. Lower by bending the elbows and press back up.',
  }),
  ex({
    id: 'sys.diamond-push-up',
    nameDe: 'Diamant-Liegestütze',
    nameEn: 'Diamond Push-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'horizontalPush',
    primary: ['triceps'],
    secondary: ['chest'],
    aliases: ['Enge Liegestütze', 'Close-Grip Push-up'],
    descriptionDe:
      'Liegestütze mit eng zusammenliegenden Händen unter der Brust, Daumen und Zeigefinger bilden eine Raute.',
    descriptionEn:
      'Push-ups with the hands close together under the chest, thumbs and index fingers forming a diamond.',
  }),
  ex({
    id: 'sys.dumbbell-kickback',
    nameDe: 'Trizeps-Kickbacks mit Kurzhantel',
    nameEn: 'Dumbbell Triceps Kickback',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Kickbacks', 'Trizeps Kickback'],
    descriptionDe:
      'Vorgebeugt den Oberarm parallel zum Körper halten und die Kurzhantel nach hinten strecken.',
    descriptionEn:
      'Bent over, hold the upper arm parallel to the body and extend the dumbbell backward.',
  }),
  ex({
    id: 'sys.cable-kickback',
    nameDe: 'Trizeps-Kickbacks am Kabel',
    nameEn: 'Cable Triceps Kickback',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Kabel Kickbacks'],
    descriptionDe:
      'Vorgebeugt am tiefen Kabelzug, Oberarm am Körper. Unterarm nach hinten strecken.',
    descriptionEn:
      'Bent over at a low cable with the upper arm at your side. Extend the forearm backward.',
  }),
  ex({
    id: 'sys.machine-triceps-extension',
    nameDe: 'Trizepsstrecken an der Maschine',
    nameEn: 'Machine Triceps Extension',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Trizepsmaschine'],
    descriptionDe:
      'Oberarme auf das Polster legen, Ellbogen auf Höhe der Drehachse. Griffe nach unten strecken.',
    descriptionEn:
      'Rest the upper arms on the pad with elbows at the pivot. Extend the handles downward.',
  }),
  ex({
    id: 'sys.machine-dip',
    nameDe: 'Dips an der Maschine',
    nameEn: 'Machine Dip',
    equipment: 'machine',
    movementPattern: 'verticalPush',
    primary: ['triceps'],
    secondary: ['chest'],
    aliases: ['Dipmaschine', 'Seated Dip'],
    descriptionDe:
      'Sitzend die Griffe neben dem Körper nach unten drücken, bis die Arme gestreckt sind.',
    descriptionEn: 'Seated, press the handles beside your body down until the arms are straight.',
  }),
  ex({
    id: 'sys.suspension-triceps-extension',
    nameDe: 'Trizepsstrecken am Schlingentrainer',
    nameEn: 'Suspension Triceps Extension',
    exerciseType: 'bodyweight',
    equipment: 'suspension',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['TRX Trizeps'],
    descriptionDe:
      'Mit dem Gesicht vom Ankerpunkt weg nach vorne lehnen, Griffe vor der Stirn. Arme nach vorne strecken.',
    descriptionEn:
      'Facing away from the anchor, lean forward with the handles in front of the forehead. Extend the arms forward.',
  }),
  ex({
    id: 'sys.band-pushdown',
    nameDe: 'Trizepsdrücken mit Widerstandsband',
    nameEn: 'Band Triceps Pushdown',
    equipment: 'band',
    movementPattern: 'isolation',
    primary: ['triceps'],
    aliases: ['Band Pushdown'],
    descriptionDe:
      'Band oben befestigen. Ellbogen am Körper halten und die Enden nach unten strecken.',
    descriptionEn:
      'Anchor the band high. Keep the elbows at your sides and extend the ends downward.',
  }),
];

export const FOREARMS = [
  ex({
    id: 'sys.wrist-curl',
    nameDe: 'Handgelenkcurls',
    nameEn: 'Wrist Curl',
    equipment: 'barbell',
    movementPattern: 'isolation',
    primary: ['forearms'],
    aliases: ['Unterarmcurls', 'Handgelenkbeugen'],
    descriptionDe:
      'Unterarme auf den Oberschenkeln oder einer Bank ablegen, Handflächen nach oben. Stange nur aus dem Handgelenk nach oben beugen.',
    descriptionEn:
      'Rest the forearms on your thighs or a bench, palms up. Curl the bar up using only the wrists.',
  }),
  ex({
    id: 'sys.reverse-wrist-curl',
    nameDe: 'Reverse Handgelenkcurls',
    nameEn: 'Reverse Wrist Curl',
    equipment: 'barbell',
    movementPattern: 'isolation',
    primary: ['forearms'],
    aliases: ['Handgelenkstrecken'],
    descriptionDe:
      'Unterarme ablegen, Handflächen nach unten. Stange aus dem Handgelenk nach oben strecken.',
    descriptionEn: 'Rest the forearms, palms down. Extend the bar up using only the wrists.',
  }),
  ex({
    id: 'sys.reverse-curl',
    nameDe: 'SZ-Reverse-Curls',
    nameEn: 'EZ-Bar Reverse Curl',
    equipment: 'ezBar',
    movementPattern: 'isolation',
    primary: ['forearms'],
    secondary: ['biceps'],
    aliases: ['Reverse Curls', 'Obergriff Curls'],
    descriptionDe: 'SZ-Stange im Obergriff halten und mit ruhigen Ellbogen nach oben beugen.',
    descriptionEn: 'Hold the EZ bar with an overhand grip and curl it up with still elbows.',
  }),
  ex({
    id: 'sys.plate-pinch',
    nameDe: 'Scheiben-Pinch-Halten',
    nameEn: 'Plate Pinch Hold',
    exerciseType: 'timed',
    equipment: 'other',
    movementPattern: 'carry',
    primary: ['forearms'],
    aliases: ['Plate Pinch'],
    descriptionDe:
      'Zwei Hantelscheiben mit den glatten Seiten nach außen zwischen Daumen und Fingern halten.',
    descriptionEn: 'Hold two weight plates smooth sides out, pinched between thumb and fingers.',
  }),
  ex({
    id: 'sys.dead-hang',
    nameDe: 'Passives Hängen',
    nameEn: 'Dead Hang',
    exerciseType: 'timed',
    equipment: 'bodyweight',
    movementPattern: 'other',
    primary: ['forearms'],
    secondary: ['lats'],
    aliases: ['Dead Hang', 'Hängen an der Stange'],
    descriptionDe: 'An der Klimmzugstange mit gestreckten Armen hängen und den Griff halten.',
    descriptionEn: 'Hang from a pull-up bar with straight arms and hold the grip.',
  }),
  ex({
    id: 'sys.wrist-roller',
    nameDe: 'Wrist Roller',
    nameEn: 'Wrist Roller',
    equipment: 'other',
    movementPattern: 'isolation',
    primary: ['forearms'],
    aliases: ['Unterarmroller'],
    descriptionDe:
      'Gewicht an einer Schnur durch Drehen des Stabs mit gestreckten Armen aufrollen und langsam abrollen.',
    descriptionEn:
      'With straight arms, roll a weight on a cord up by turning the handle and unroll it slowly.',
  }),
  ex({
    id: 'sys.barbell-hold',
    nameDe: 'Langhantel-Halten',
    nameEn: 'Barbell Hold',
    exerciseType: 'timed',
    equipment: 'barbell',
    movementPattern: 'carry',
    primary: ['forearms'],
    secondary: ['back'],
    aliases: ['Static Hold', 'Griffkraft Halten'],
    descriptionDe: 'Schwere Langhantel im Stand aus dem Rack halten, Schultern zurück, Rumpf fest.',
    descriptionEn:
      'Hold a heavy barbell standing after unracking it, shoulders back and torso braced.',
  }),
];
