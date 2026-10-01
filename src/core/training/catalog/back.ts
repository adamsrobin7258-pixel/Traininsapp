import { ex } from './define';

export const BACK = [
  ex({
    id: 'sys.pull-up',
    nameDe: 'Klimmzüge',
    nameEn: 'Pull-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps', 'back'],
    aliases: ['Klimmzug', 'Pullup', 'Klimmzüge Obergriff'],
    descriptionDe:
      'Im Obergriff etwas breiter als schulterbreit hängen und den Körper hochziehen, bis das Kinn über der Stange ist.',
    descriptionEn:
      'Hang with an overhand grip slightly wider than shoulder width and pull up until the chin clears the bar.',
  }),
  ex({
    id: 'sys.chin-up',
    nameDe: 'Klimmzüge im Untergriff',
    nameEn: 'Chin-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps', 'back'],
    aliases: ['Chinup', 'Untergriff Klimmzug'],
    descriptionDe:
      'Im Untergriff schulterbreit hängen und den Körper hochziehen, bis das Kinn über der Stange ist.',
    descriptionEn:
      'Hang with an underhand grip at shoulder width and pull up until the chin clears the bar.',
  }),
  ex({
    id: 'sys.neutral-grip-pull-up',
    nameDe: 'Klimmzüge im Neutralgriff',
    nameEn: 'Neutral-Grip Pull-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps', 'back'],
    aliases: ['Hammergriff Klimmzug'],
    descriptionDe:
      'An parallelen Griffen mit zueinander zeigenden Handflächen hängen und den Körper hochziehen.',
    descriptionEn: 'Hang from parallel handles with palms facing each other and pull the body up.',
  }),
  ex({
    id: 'sys.lat-pulldown',
    nameDe: 'Latzug',
    nameEn: 'Lat Pulldown',
    equipment: 'cable',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps', 'back'],
    aliases: ['Latziehen', 'Lat Pull', 'Latzug breit'],
    descriptionDe:
      'Stange im Obergriff greifen und mit aufrechtem Oberkörper zur oberen Brust ziehen, dann kontrolliert nach oben lassen.',
    descriptionEn:
      'Grip the bar overhand and pull it to the upper chest with an upright torso, then let it rise under control.',
  }),
  ex({
    id: 'sys.close-grip-lat-pulldown',
    nameDe: 'Latzug eng im Neutralgriff',
    nameEn: 'Close-Grip Lat Pulldown',
    equipment: 'cable',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps', 'back'],
    aliases: ['Latzug eng', 'V-Griff Latzug'],
    descriptionDe: 'Mit engem Parallelgriff den Griff zur Brust ziehen und langsam zurückführen.',
    descriptionEn: 'Using a close parallel grip, pull the handle to the chest and return slowly.',
  }),
  ex({
    id: 'sys.reverse-grip-lat-pulldown',
    nameDe: 'Latzug im Untergriff',
    nameEn: 'Reverse-Grip Lat Pulldown',
    equipment: 'cable',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps', 'back'],
    aliases: ['Underhand Pulldown'],
    descriptionDe: 'Stange schulterbreit im Untergriff zur oberen Brust ziehen.',
    descriptionEn: 'Pull the bar to the upper chest with a shoulder-width underhand grip.',
  }),
  ex({
    id: 'sys.single-arm-cable-pulldown',
    nameDe: 'Einarmiger Latzug am Kabel',
    nameEn: 'Single-Arm Cable Pulldown',
    equipment: 'cable',
    movementPattern: 'verticalPull',
    primary: ['lats'],
    secondary: ['biceps'],
    descriptionDe:
      'Einen Griff am oberen Kabel fassen und den Ellenbogen seitlich nach unten zur Hüfte ziehen.',
    descriptionEn:
      'Hold a single handle on the high pulley and pull the elbow down and in towards the hip.',
  }),
  ex({
    id: 'sys.straight-arm-pulldown',
    nameDe: 'Latziehen mit gestreckten Armen',
    nameEn: 'Straight-Arm Pulldown',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['lats'],
    aliases: ['Straight Arm Pulldown', 'Überzüge am Kabel'],
    descriptionDe:
      'Am oberen Kabel die Stange mit fast gestreckten Armen im Bogen bis zu den Oberschenkeln ziehen.',
    descriptionEn:
      'At the high pulley, pull the bar down in an arc to the thighs with nearly straight arms.',
  }),
  ex({
    id: 'sys.barbell-row',
    nameDe: 'Langhantelrudern',
    nameEn: 'Barbell Row',
    equipment: 'barbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    aliases: ['Vorgebeugtes Rudern', 'Bent-over Row', 'LH Rudern'],
    descriptionDe:
      'Mit geradem Rücken nach vorn beugen und die Stange zum unteren Bauch ziehen, dann kontrolliert absenken.',
    descriptionEn:
      'Hinge forward with a flat back and pull the bar to the lower stomach, then lower it under control.',
  }),
  ex({
    id: 'sys.pendlay-row',
    nameDe: 'Pendlay-Rudern',
    nameEn: 'Pendlay Row',
    equipment: 'barbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    descriptionDe:
      'Oberkörper fast waagerecht. Stange aus dem Stand am Boden explosiv zum Bauch ziehen und jede Wiederholung am Boden ablegen.',
    descriptionEn:
      'Torso nearly horizontal. Pull the bar from a dead stop on the floor to the stomach and set it down each rep.',
  }),
  ex({
    id: 'sys.dumbbell-row',
    nameDe: 'Einarmiges Kurzhantelrudern',
    nameEn: 'One-Arm Dumbbell Row',
    equipment: 'dumbbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    aliases: ['KH Rudern', 'DB Row', 'Kurzhantelrudern'],
    descriptionDe:
      'Mit Hand und Knie auf der Bank abstützen und die Kurzhantel mit dem Ellenbogen nah am Körper zur Hüfte ziehen.',
    descriptionEn:
      'Support one hand and knee on a bench and row the dumbbell to the hip with the elbow close to the body.',
  }),
  ex({
    id: 'sys.chest-supported-dumbbell-row',
    nameDe: 'Kurzhantelrudern auf der Schrägbank',
    nameEn: 'Chest-Supported Dumbbell Row',
    equipment: 'dumbbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps', 'shoulders'],
    descriptionDe:
      'Bäuchlings auf der Schrägbank liegen und beide Kurzhanteln zur Seite des Brustkorbs ziehen.',
    descriptionEn:
      'Lie chest down on an incline bench and row both dumbbells to the sides of the ribs.',
  }),
  ex({
    id: 'sys.seal-row',
    nameDe: 'Seal Row',
    nameEn: 'Seal Row',
    equipment: 'barbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    aliases: ['Bankrudern bäuchlings'],
    descriptionDe:
      'Bäuchlings auf einer erhöhten Flachbank liegen und die Stange von unten an die Bank ziehen.',
    descriptionEn:
      'Lie face down on a raised flat bench and pull the bar up to the underside of the bench.',
  }),
  ex({
    id: 'sys.seated-cable-row',
    nameDe: 'Sitzendes Kabelrudern',
    nameEn: 'Seated Cable Row',
    equipment: 'cable',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    aliases: ['Rudern am Kabel', 'Kabelrudern', 'Cable Row'],
    descriptionDe:
      'Aufrecht sitzen, Griff zum Bauch ziehen und die Schulterblätter zusammenführen, dann langsam nach vorn lassen.',
    descriptionEn:
      'Sit upright, pull the handle to the stomach while squeezing the shoulder blades, then let it forward slowly.',
  }),
  ex({
    id: 'sys.wide-grip-cable-row',
    nameDe: 'Kabelrudern mit breitem Griff',
    nameEn: 'Wide-Grip Seated Cable Row',
    equipment: 'cable',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['shoulders', 'biceps'],
    descriptionDe:
      'Mit breiter Stange im Obergriff zum unteren Brustkorb ziehen, Ellenbogen leicht seitlich.',
    descriptionEn: 'Pull a wide bar with an overhand grip to the lower ribs, elbows slightly out.',
  }),
  ex({
    id: 'sys.single-arm-cable-row',
    nameDe: 'Einarmiges Kabelrudern',
    nameEn: 'Single-Arm Cable Row',
    equipment: 'cable',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps', 'core'],
    descriptionDe:
      'Einen Griff am Kabel auf Brusthöhe greifen und zur Hüfte ziehen, ohne den Rumpf zu drehen.',
    descriptionEn:
      'Hold one handle at chest height and pull it to the hip without twisting the torso.',
  }),
  ex({
    id: 'sys.machine-row',
    nameDe: 'Rudern an der Maschine',
    nameEn: 'Machine Row',
    equipment: 'machine',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    aliases: ['Rudermaschine', 'Seated Row Machine'],
    descriptionDe:
      'Brust am Polster, Griffe nach hinten ziehen und die Schulterblätter zusammenführen.',
    descriptionEn: 'Chest against the pad, pull the handles back and squeeze the shoulder blades.',
  }),
  ex({
    id: 'sys.t-bar-row',
    nameDe: 'T-Bar-Rudern',
    nameEn: 'T-Bar Row',
    equipment: 'barbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    aliases: ['T Bar Rudern', 'Landmine Row'],
    descriptionDe:
      'Über der einseitig fixierten Stange vorgebeugt stehen und den Griff zur Brust ziehen.',
    descriptionEn: 'Stand bent over the anchored bar and pull the handle towards the chest.',
  }),
  ex({
    id: 'sys.meadows-row',
    nameDe: 'Meadows-Rudern',
    nameEn: 'Meadows Row',
    equipment: 'barbell',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    descriptionDe:
      'Seitlich neben der einseitig fixierten Stange stehen und das Stangenende einarmig zur Hüfte ziehen.',
    descriptionEn:
      'Stand beside the anchored bar and row the end of the bar to the hip with one arm.',
  }),
  ex({
    id: 'sys.smith-row',
    nameDe: 'Rudern an der Multipresse',
    nameEn: 'Smith Machine Row',
    equipment: 'smithMachine',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['lats', 'biceps'],
    descriptionDe:
      'Vorgebeugt die geführte Stange zum unteren Bauch ziehen und kontrolliert absenken.',
    descriptionEn:
      'Bent over, pull the guided bar to the lower stomach and lower it under control.',
  }),
  ex({
    id: 'sys.inverted-row',
    nameDe: 'Rudern im Körpergewicht',
    nameEn: 'Inverted Row',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['biceps', 'core'],
    aliases: ['Australian Pull-up', 'Umgekehrtes Rudern'],
    descriptionDe:
      'Unter einer hüfthohen Stange hängen, Körper gestreckt, und die Brust zur Stange ziehen.',
    descriptionEn:
      'Hang under a hip-height bar with a straight body and pull the chest to the bar.',
  }),
  ex({
    id: 'sys.suspension-row',
    nameDe: 'Rudern am Schlingentrainer',
    nameEn: 'Suspension Row',
    exerciseType: 'bodyweight',
    equipment: 'suspension',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['biceps', 'core'],
    aliases: ['TRX Row', 'TRX Rudern'],
    descriptionDe:
      'Griffe halten, Körper gestreckt nach hinten lehnen und die Brust zu den Händen ziehen.',
    descriptionEn:
      'Hold the handles, lean back with a straight body and pull the chest to the hands.',
  }),
  ex({
    id: 'sys.band-row',
    nameDe: 'Rudern mit Widerstandsband',
    nameEn: 'Band Row',
    exerciseType: 'bodyweight',
    equipment: 'band',
    movementPattern: 'horizontalPull',
    primary: ['back'],
    secondary: ['biceps'],
    descriptionDe: 'Band auf Brusthöhe befestigen und die Enden zum Bauch ziehen.',
    descriptionEn: 'Anchor the band at chest height and pull the ends to the stomach.',
  }),
  ex({
    id: 'sys.dumbbell-pullover',
    nameDe: 'Kurzhantel-Pullover',
    nameEn: 'Dumbbell Pullover',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['lats'],
    secondary: ['chest', 'triceps'],
    aliases: ['Überzüge', 'Pullover'],
    descriptionDe:
      'Quer oder längs auf der Bank liegen und die Kurzhantel mit leicht gebeugten Armen hinter den Kopf und zurück über die Brust führen.',
    descriptionEn:
      'Lying on a bench, move the dumbbell behind the head with slightly bent arms and back over the chest.',
  }),
  ex({
    id: 'sys.back-extension',
    nameDe: 'Rückenstrecker',
    nameEn: 'Back Extension',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'hinge',
    primary: ['back'],
    secondary: ['glutes', 'hamstrings'],
    aliases: ['Hyperextension', 'Rückenstrecken'],
    descriptionDe:
      'Am Hyperextension-Gerät aus der Hüfte nach vorn beugen und den Oberkörper bis in die Linie mit den Beinen anheben.',
    descriptionEn:
      'On a hyperextension bench, bend forward at the hips and raise the torso until in line with the legs.',
  }),
  ex({
    id: 'sys.superman',
    nameDe: 'Superman',
    nameEn: 'Superman',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['back'],
    secondary: ['glutes'],
    descriptionDe:
      'Bäuchlings liegen und Arme und Beine gleichzeitig leicht vom Boden abheben, kurz halten.',
    descriptionEn:
      'Lie face down and lift the arms and legs slightly off the floor together, hold briefly.',
  }),
  ex({
    id: 'sys.rack-pull',
    nameDe: 'Rack Pull',
    nameEn: 'Rack Pull',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['back'],
    secondary: ['glutes', 'hamstrings', 'forearms'],
    aliases: ['Teilkreuzheben'],
    descriptionDe:
      'Kreuzheben aus dem Rack mit der Stange etwa auf Kniehöhe; mit geradem Rücken aufrichten.',
    descriptionEn:
      'A deadlift from the rack with the bar at about knee height; stand up with a flat back.',
  }),
  ex({
    id: 'sys.barbell-shrug',
    nameDe: 'Langhantel-Shrugs',
    nameEn: 'Barbell Shrug',
    equipment: 'barbell',
    movementPattern: 'isolation',
    primary: ['back'],
    secondary: ['forearms'],
    aliases: ['Schulterheben', 'Shrugs'],
    descriptionDe:
      'Stange vor dem Körper halten und die Schultern gerade nach oben ziehen, kurz halten.',
    descriptionEn:
      'Hold the bar in front of the body and lift the shoulders straight up, hold briefly.',
  }),
  ex({
    id: 'sys.dumbbell-shrug',
    nameDe: 'Kurzhantel-Shrugs',
    nameEn: 'Dumbbell Shrug',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['back'],
    secondary: ['forearms'],
    aliases: ['KH Schulterheben'],
    descriptionDe: 'Kurzhanteln seitlich halten und die Schultern gerade nach oben ziehen.',
    descriptionEn: 'Hold the dumbbells at the sides and lift the shoulders straight up.',
  }),
];
