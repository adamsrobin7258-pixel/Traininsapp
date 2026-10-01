import { ex } from './define';

export const CORE = [
  ex({
    id: 'sys.plank',
    nameDe: 'Unterarmstütz',
    nameEn: 'Plank',
    exerciseType: 'timed',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Plank', 'Planke', 'Brett'],
    descriptionDe:
      'Auf Unterarmen und Zehen stützen, Körper bildet eine gerade Linie. Bauch und Gesäß anspannen und halten.',
    descriptionEn:
      'Support yourself on forearms and toes with the body in a straight line. Brace abs and glutes and hold.',
  }),
  ex({
    id: 'sys.side-plank',
    nameDe: 'Seitstütz',
    nameEn: 'Side Plank',
    exerciseType: 'timed',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Side Plank', 'Seitlicher Unterarmstütz'],
    descriptionDe:
      'Seitlich auf einem Unterarm stützen, Hüfte anheben und den Körper gerade halten.',
    descriptionEn:
      'Support yourself on one forearm on your side, lift the hips and keep the body straight.',
  }),
  ex({
    id: 'sys.hollow-hold',
    nameDe: 'Hollow Hold',
    nameEn: 'Hollow Body Hold',
    exerciseType: 'timed',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Hollow Body', 'Schiffchen'],
    descriptionDe:
      'Auf dem Rücken liegend Schultern und gestreckte Beine leicht anheben, unterer Rücken bleibt am Boden.',
    descriptionEn:
      'Lying on your back, lift the shoulders and straight legs slightly while the lower back stays on the floor.',
  }),
  ex({
    id: 'sys.l-sit',
    nameDe: 'L-Sitz',
    nameEn: 'L-Sit',
    exerciseType: 'timed',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['triceps'],
    aliases: ['L-Sit', 'Winkelstütz'],
    descriptionDe:
      'Auf Barren oder Boden stützen und die gestreckten Beine waagerecht nach vorne halten.',
    descriptionEn:
      'Support yourself on parallel bars or the floor and hold the straight legs level in front.',
  }),
  ex({
    id: 'sys.crunch',
    nameDe: 'Crunches',
    nameEn: 'Crunch',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Bauchpressen', 'Crunch'],
    descriptionDe:
      'Auf dem Rücken, Knie gebeugt. Schultern vom Boden einrollen und langsam absenken.',
    descriptionEn:
      'On your back with knees bent. Curl the shoulders off the floor and lower slowly.',
  }),
  ex({
    id: 'sys.cable-crunch',
    nameDe: 'Kabel-Crunches',
    nameEn: 'Cable Crunch',
    equipment: 'cable',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Kniender Kabelcrunch', 'Cable Crunches'],
    descriptionDe:
      'Kniend vor dem hohen Kabelzug, Seil am Kopf. Oberkörper einrollen und Ellbogen Richtung Knie führen.',
    descriptionEn:
      'Kneel at a high cable with the rope by your head. Curl the torso and bring the elbows towards the knees.',
  }),
  ex({
    id: 'sys.machine-crunch',
    nameDe: 'Bauchmaschine',
    nameEn: 'Machine Crunch',
    equipment: 'machine',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Ab Crunch Machine', 'Crunch Maschine'],
    descriptionDe:
      'Sitzend die Griffe oder Polster fassen und den Oberkörper gegen den Widerstand einrollen.',
    descriptionEn: 'Seated, take the handles or pads and curl the torso against the resistance.',
  }),
  ex({
    id: 'sys.reverse-crunch',
    nameDe: 'Reverse Crunches',
    nameEn: 'Reverse Crunch',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Umgekehrte Crunches'],
    descriptionDe:
      'Auf dem Rücken liegend die gebeugten Beine zur Brust ziehen und das Becken leicht anheben.',
    descriptionEn:
      'Lying on your back, pull the bent legs towards the chest and lift the pelvis slightly.',
  }),
  ex({
    id: 'sys.bicycle-crunch',
    nameDe: 'Fahrrad-Crunches',
    nameEn: 'Bicycle Crunch',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Bicycle Crunches', 'Radfahrer'],
    descriptionDe:
      'In Rückenlage abwechselnd Ellbogen zum gegenüberliegenden Knie führen, anderes Bein strecken.',
    descriptionEn:
      'On your back, alternately bring each elbow to the opposite knee while extending the other leg.',
  }),
  ex({
    id: 'sys.sit-up',
    nameDe: 'Sit-ups',
    nameEn: 'Sit-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Situps', 'Aufrichter'],
    descriptionDe:
      'Aus der Rückenlage mit gebeugten Knien den Oberkörper bis zum Sitzen aufrichten.',
    descriptionEn:
      'From lying on your back with knees bent, raise the torso all the way to sitting.',
  }),
  ex({
    id: 'sys.hanging-leg-raise',
    nameDe: 'Beinheben hängend',
    nameEn: 'Hanging Leg Raise',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['forearms'],
    aliases: ['Hängendes Beinheben', 'Leg Raise hängend'],
    descriptionDe:
      'An der Stange hängen und die gestreckten Beine kontrolliert bis zur Waagerechten oder höher heben.',
    descriptionEn:
      'Hang from a bar and raise the straight legs under control to horizontal or higher.',
  }),
  ex({
    id: 'sys.hanging-knee-raise',
    nameDe: 'Knieheben hängend',
    nameEn: 'Hanging Knee Raise',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Hängendes Knieheben', 'Knee Raise'],
    descriptionDe:
      'An der Stange oder im Dip-Ständer die Knie zur Brust ziehen, ohne zu schwingen.',
    descriptionEn:
      'Hanging from a bar or in a dip station, pull the knees to the chest without swinging.',
  }),
  ex({
    id: 'sys.lying-leg-raise',
    nameDe: 'Beinheben liegend',
    nameEn: 'Lying Leg Raise',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Liegendes Beinheben', 'Leg Raise'],
    descriptionDe:
      'Auf dem Rücken liegend die gestreckten Beine senkrecht heben und langsam bis knapp über den Boden senken.',
    descriptionEn:
      'Lying on your back, raise the straight legs to vertical and lower them slowly to just above the floor.',
  }),
  ex({
    id: 'sys.toes-to-bar',
    nameDe: 'Toes to Bar',
    nameEn: 'Toes to Bar',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['lats', 'forearms'],
    aliases: ['T2B', 'Füße zur Stange'],
    descriptionDe: 'An der Stange hängend die Füße bis an die Stange führen.',
    descriptionEn: 'Hanging from the bar, bring the feet all the way up to the bar.',
  }),
  ex({
    id: 'sys.dragon-flag',
    nameDe: 'Dragon Flag',
    nameEn: 'Dragon Flag',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    descriptionDe:
      'Auf einer Bank liegend hinter dem Kopf festhalten. Körper gestreckt anheben und langsam als Ganzes absenken.',
    descriptionEn:
      'Lying on a bench, hold on behind your head. Raise the straight body and lower it slowly as one piece.',
  }),
  ex({
    id: 'sys.ab-wheel-rollout',
    nameDe: 'Bauchroller',
    nameEn: 'Ab Wheel Rollout',
    exerciseType: 'bodyweight',
    equipment: 'other',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['lats'],
    aliases: ['Ab Wheel', 'Ab Roller', 'Rollout'],
    descriptionDe: 'Kniend den Bauchroller nach vorne rollen, Rumpf fest, und wieder zurückziehen.',
    descriptionEn: 'Kneeling, roll the ab wheel forward with a braced torso and pull it back.',
  }),
  ex({
    id: 'sys.dead-bug',
    nameDe: 'Dead Bug',
    nameEn: 'Dead Bug',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Toter Käfer'],
    descriptionDe:
      'In Rückenlage Arme und Beine nach oben. Gegengleich einen Arm und ein Bein strecken, unterer Rücken bleibt am Boden.',
    descriptionEn:
      'On your back with arms and legs up. Extend the opposite arm and leg while the lower back stays on the floor.',
  }),
  ex({
    id: 'sys.bird-dog',
    nameDe: 'Bird Dog',
    nameEn: 'Bird Dog',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['back', 'glutes'],
    aliases: ['Vierfüßlerstand Arm-Bein-Heben'],
    descriptionDe:
      'Im Vierfüßlerstand gegengleich Arm und Bein strecken, kurz halten und wechseln.',
    descriptionEn: 'On all fours, extend the opposite arm and leg, hold briefly and switch.',
  }),
  ex({
    id: 'sys.pallof-press',
    nameDe: 'Pallof Press',
    nameEn: 'Pallof Press',
    equipment: 'cable',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Anti-Rotationsdrücken'],
    descriptionDe:
      'Seitlich zum Kabelzug stehen, Griff vor der Brust. Arme nach vorne strecken, ohne dass der Rumpf sich dreht.',
    descriptionEn:
      'Stand side-on to the cable with the handle at the chest. Press the arms forward without letting the torso rotate.',
  }),
  ex({
    id: 'sys.cable-woodchop',
    nameDe: 'Holzhacker am Kabel',
    nameEn: 'Cable Woodchop',
    equipment: 'cable',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['shoulders'],
    aliases: ['Woodchopper', 'Holzhacker'],
    descriptionDe:
      'Griff diagonal von oben nach unten (oder umgekehrt) über den Körper ziehen und dabei den Rumpf drehen.',
    descriptionEn:
      'Pull the handle diagonally across the body from high to low (or reverse) while rotating the torso.',
  }),
  ex({
    id: 'sys.russian-twist',
    nameDe: 'Russian Twists',
    nameEn: 'Russian Twist',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Russische Drehungen'],
    descriptionDe:
      'Sitzend mit zurückgelehntem Oberkörper die Hände abwechselnd neben die Hüfte drehen.',
    descriptionEn:
      'Sitting and leaning back, rotate the hands alternately to each side of the hips.',
  }),
  ex({
    id: 'sys.dumbbell-side-bend',
    nameDe: 'Seitbeugen mit Kurzhantel',
    nameEn: 'Dumbbell Side Bend',
    equipment: 'dumbbell',
    movementPattern: 'core',
    primary: ['core'],
    aliases: ['Seitbeugen', 'Side Bend'],
    descriptionDe:
      'Im Stand eine Kurzhantel seitlich halten, Oberkörper zur Seite neigen und wieder aufrichten.',
    descriptionEn:
      'Standing with a dumbbell at one side, bend the torso sideways and return upright.',
  }),
  ex({
    id: 'sys.landmine-rotation',
    nameDe: 'Landmine Rotation',
    nameEn: 'Landmine Rotation',
    equipment: 'barbell',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['shoulders'],
    aliases: ['Landmine Twist'],
    descriptionDe:
      'Ende der fixierten Langhantel mit gestreckten Armen halten und in einem Bogen von Seite zu Seite führen.',
    descriptionEn:
      'Hold the end of an anchored barbell with straight arms and move it in an arc from side to side.',
  }),
  ex({
    id: 'sys.suspension-pike',
    nameDe: 'Pike am Schlingentrainer',
    nameEn: 'Suspension Pike',
    exerciseType: 'bodyweight',
    equipment: 'suspension',
    movementPattern: 'core',
    primary: ['core'],
    secondary: ['shoulders'],
    aliases: ['TRX Pike'],
    descriptionDe:
      'Füße in den Schlaufen, im Liegestütz. Hüfte mit gestreckten Beinen nach oben ziehen.',
    descriptionEn: 'Feet in the straps in a push-up position. Pull the hips up with straight legs.',
  }),
  ex({
    id: 'sys.suitcase-carry',
    nameDe: 'Suitcase Carry',
    nameEn: 'Suitcase Carry',
    exerciseType: 'distance',
    equipment: 'dumbbell',
    movementPattern: 'carry',
    primary: ['core'],
    secondary: ['forearms'],
    aliases: ['Koffertragen', 'Einarmiges Tragen'],
    descriptionDe: 'Eine schwere Hantel einseitig tragen und gehen, ohne sich zur Seite zu neigen.',
    descriptionEn: 'Carry a heavy weight on one side and walk without leaning sideways.',
  }),
];

export const FULL_BODY = [
  ex({
    id: 'sys.deadlift',
    nameDe: 'Kreuzheben',
    nameEn: 'Deadlift',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['hamstrings', 'glutes', 'back'],
    secondary: ['forearms', 'quadriceps'],
    aliases: ['Deadlift', 'Kreuzheben konventionell', 'Conventional Deadlift'],
    descriptionDe:
      'Stange über der Fußmitte, hüftbreiter Stand. Mit geradem Rücken aus Beinen und Hüfte aufrichten, Stange nah am Körper.',
    descriptionEn:
      'Bar over mid-foot, hip-width stance. Stand up through legs and hips with a flat back, bar close to the body.',
  }),
  ex({
    id: 'sys.farmers-carry',
    nameDe: 'Farmer’s Walk',
    nameEn: 'Farmer’s Carry',
    exerciseType: 'distance',
    equipment: 'dumbbell',
    movementPattern: 'carry',
    primary: ['forearms', 'fullBody'],
    secondary: ['core'],
    aliases: ['Farmers Walk', 'Bauerngang', 'Farmer Carry'],
    descriptionDe: 'Schwere Gewichte in beiden Händen tragen und aufrecht mit festem Rumpf gehen.',
    descriptionEn: 'Carry heavy weights in both hands and walk tall with a braced torso.',
  }),
  ex({
    id: 'sys.power-clean',
    nameDe: 'Umsetzen',
    nameEn: 'Power Clean',
    equipment: 'barbell',
    movementPattern: 'other',
    primary: ['fullBody'],
    secondary: ['glutes', 'hamstrings', 'shoulders'],
    aliases: ['Power Clean', 'Standumsetzen'],
    descriptionDe:
      'Stange explosiv vom Boden ziehen, unter die Stange kommen und sie vorne auf den Schultern fangen.',
    descriptionEn:
      'Pull the bar explosively from the floor, drop under it and catch it on the front of the shoulders.',
  }),
  ex({
    id: 'sys.hang-clean',
    nameDe: 'Umsetzen aus dem Hang',
    nameEn: 'Hang Clean',
    equipment: 'barbell',
    movementPattern: 'other',
    primary: ['fullBody'],
    secondary: ['glutes', 'hamstrings', 'shoulders'],
    aliases: ['Hang Clean', 'Hang Power Clean'],
    descriptionDe:
      'Wie das Umsetzen, aber aus einer Position mit der Stange über den Knien starten.',
    descriptionEn: 'Like the power clean, but start with the bar above the knees.',
  }),
  ex({
    id: 'sys.clean-and-press',
    nameDe: 'Umsetzen und Drücken',
    nameEn: 'Clean and Press',
    equipment: 'barbell',
    movementPattern: 'other',
    primary: ['fullBody'],
    secondary: ['shoulders', 'triceps'],
    aliases: ['Clean and Press'],
    descriptionDe: 'Stange auf die Schultern umsetzen und anschließend über den Kopf drücken.',
    descriptionEn: 'Clean the bar to the shoulders, then press it overhead.',
  }),
  ex({
    id: 'sys.thruster',
    nameDe: 'Thruster',
    nameEn: 'Thruster',
    equipment: 'barbell',
    movementPattern: 'squat',
    primary: ['fullBody'],
    secondary: ['quadriceps', 'shoulders'],
    aliases: ['Thrusters'],
    descriptionDe:
      'Aus der Frontkniebeuge kraftvoll aufstehen und die Bewegung direkt in ein Überkopfdrücken übergehen lassen.',
    descriptionEn:
      'Stand up powerfully from a front squat and flow straight into an overhead press.',
  }),
  ex({
    id: 'sys.kettlebell-swing',
    nameDe: 'Kettlebell Swings',
    nameEn: 'Kettlebell Swing',
    equipment: 'kettlebell',
    movementPattern: 'hinge',
    primary: ['glutes', 'hamstrings'],
    secondary: ['core', 'shoulders'],
    aliases: ['KB Swing', 'Kettlebell Schwung'],
    descriptionDe:
      'Kettlebell zwischen die Beine schwingen, Hüfte explosiv strecken und die Kettlebell bis Brusthöhe schwingen lassen.',
    descriptionEn:
      'Swing the kettlebell between the legs, snap the hips forward and let it swing up to chest height.',
  }),
  ex({
    id: 'sys.turkish-get-up',
    nameDe: 'Turkish Get-up',
    nameEn: 'Turkish Get-up',
    equipment: 'kettlebell',
    movementPattern: 'other',
    primary: ['fullBody'],
    secondary: ['shoulders', 'core'],
    aliases: ['TGU', 'Türkisches Aufstehen'],
    descriptionDe:
      'Mit der Kettlebell über Kopf gestreckt schrittweise vom Liegen zum Stehen kommen und zurück.',
    descriptionEn:
      'With a kettlebell held overhead, move step by step from lying to standing and back.',
  }),
  ex({
    id: 'sys.dumbbell-snatch',
    nameDe: 'Kurzhantel-Reißen',
    nameEn: 'Dumbbell Snatch',
    equipment: 'dumbbell',
    movementPattern: 'other',
    primary: ['fullBody'],
    secondary: ['shoulders', 'glutes'],
    aliases: ['DB Snatch', 'Einarmiges Reißen'],
    descriptionDe:
      'Kurzhantel in einer explosiven Bewegung vom Boden einarmig bis über den Kopf ziehen.',
    descriptionEn:
      'Pull a dumbbell from the floor to overhead with one arm in a single explosive movement.',
  }),
  ex({
    id: 'sys.sled-push',
    nameDe: 'Schlitten schieben',
    nameEn: 'Sled Push',
    exerciseType: 'distance',
    equipment: 'other',
    movementPattern: 'other',
    primary: ['fullBody'],
    secondary: ['quadriceps', 'glutes'],
    aliases: ['Sled Push', 'Prowler'],
    descriptionDe:
      'Mit vorgeneigtem Oberkörper einen beladenen Schlitten mit kräftigen Schritten schieben.',
    descriptionEn: 'Lean forward and push a loaded sled with powerful steps.',
  }),
];
