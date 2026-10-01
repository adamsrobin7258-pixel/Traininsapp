import { ex } from './define';

export const SHOULDERS = [
  ex({
    id: 'sys.overhead-press',
    nameDe: 'Langhantel-Schulterdrücken',
    nameEn: 'Barbell Overhead Press',
    equipment: 'barbell',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps', 'core'],
    aliases: ['Schulterdrücken', 'Overhead Press', 'Shoulder Press', 'OHP', 'Military Press'],
    descriptionDe:
      'Im Stand die Stange auf Schulterhöhe halten, Bauch und Gesäß anspannen. Stange senkrecht über den Kopf drücken und kontrolliert zurückführen.',
    descriptionEn:
      'Standing, hold the bar at shoulder height and brace your core and glutes. Press it straight overhead and lower it under control.',
  }),
  ex({
    id: 'sys.seated-dumbbell-shoulder-press',
    nameDe: 'Kurzhantel-Schulterdrücken sitzend',
    nameEn: 'Seated Dumbbell Shoulder Press',
    equipment: 'dumbbell',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps'],
    aliases: ['KH Schulterdrücken', 'DB Shoulder Press', 'Dumbbell Shoulder Press'],
    descriptionDe:
      'Auf einer Bank mit aufrechter Lehne sitzen. Kurzhanteln von Schulterhöhe über den Kopf drücken und langsam wieder absenken.',
    descriptionEn:
      'Sit on a bench with an upright back rest. Press the dumbbells from shoulder height overhead and lower them slowly.',
  }),
  ex({
    id: 'sys.arnold-press',
    nameDe: 'Arnold Press',
    nameEn: 'Arnold Press',
    equipment: 'dumbbell',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps'],
    aliases: ['Arnold Drücken'],
    descriptionDe:
      'Kurzhanteln vor dem Gesicht halten, Handflächen zum Körper. Beim Hochdrücken die Hände nach außen drehen, beim Absenken zurückdrehen.',
    descriptionEn:
      'Hold the dumbbells in front of your face, palms facing you. Rotate the palms outward while pressing up and back on the way down.',
  }),
  ex({
    id: 'sys.machine-shoulder-press',
    nameDe: 'Schulterpresse an der Maschine',
    nameEn: 'Machine Shoulder Press',
    equipment: 'machine',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps'],
    aliases: ['Schulterpresse', 'Shoulder Press Machine'],
    descriptionDe:
      'Sitzhöhe so einstellen, dass die Griffe auf Schulterhöhe liegen. Griffe nach oben drücken, ohne die Ellbogen ganz durchzustrecken.',
    descriptionEn:
      'Adjust the seat so the handles are at shoulder height. Press the handles up without fully locking the elbows.',
  }),
  ex({
    id: 'sys.smith-shoulder-press',
    nameDe: 'Schulterdrücken an der Multipresse',
    nameEn: 'Smith Machine Shoulder Press',
    equipment: 'smithMachine',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps'],
    aliases: ['Smith Schulterdrücken'],
    descriptionDe:
      'Auf einer aufrechten Bank unter der Multipresse sitzen. Stange von Kinnhöhe nach oben drücken und kontrolliert absenken.',
    descriptionEn:
      'Sit on an upright bench under the Smith machine. Press the bar up from chin height and lower it under control.',
  }),
  ex({
    id: 'sys.push-press',
    nameDe: 'Push Press',
    nameEn: 'Push Press',
    equipment: 'barbell',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps', 'quadriceps'],
    aliases: ['Stoßdrücken'],
    descriptionDe:
      'Wie Schulterdrücken, aber mit kurzem Schwung aus den Beinen: leicht in die Knie gehen, explosiv strecken und die Stange über den Kopf drücken.',
    descriptionEn:
      'Like an overhead press, but with a short leg drive: dip the knees slightly, extend explosively and press the bar overhead.',
  }),
  ex({
    id: 'sys.landmine-press',
    nameDe: 'Landmine Press',
    nameEn: 'Landmine Press',
    equipment: 'barbell',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['chest', 'triceps'],
    aliases: ['Landmine Drücken'],
    descriptionDe:
      'Ein Ende der Langhantel in einer Ecke oder Halterung fixieren. Das andere Ende von Schulterhöhe schräg nach vorne oben drücken.',
    descriptionEn:
      'Anchor one end of a barbell in a corner or holder. Press the other end from shoulder height up and forward.',
  }),
  ex({
    id: 'sys.kettlebell-press',
    nameDe: 'Kettlebell-Schulterdrücken',
    nameEn: 'Kettlebell Overhead Press',
    equipment: 'kettlebell',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps', 'core'],
    aliases: ['KB Press', 'Kettlebell Press'],
    descriptionDe:
      'Kettlebell in Racked-Position an der Schulter halten. Einarmig über den Kopf drücken, Rumpf stabil halten.',
    descriptionEn:
      'Hold the kettlebell in the rack position at the shoulder. Press it overhead with one arm while keeping the torso stable.',
  }),
  ex({
    id: 'sys.lateral-raise',
    nameDe: 'Kurzhantel-Seitheben',
    nameEn: 'Dumbbell Lateral Raise',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    aliases: ['Seitheben', 'Lateral Raise', 'Seitenheben'],
    descriptionDe:
      'Mit leicht gebeugten Ellbogen die Kurzhanteln seitlich bis etwa Schulterhöhe heben und langsam wieder senken.',
    descriptionEn:
      'With slightly bent elbows, raise the dumbbells out to the sides to about shoulder height and lower them slowly.',
  }),
  ex({
    id: 'sys.cable-lateral-raise',
    nameDe: 'Seitheben am Kabel',
    nameEn: 'Cable Lateral Raise',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    aliases: ['Kabel Seitheben'],
    descriptionDe:
      'Seitlich zum tiefen Kabelzug stehen, Griff mit der entfernten Hand fassen. Arm seitlich bis Schulterhöhe heben.',
    descriptionEn:
      'Stand side-on to a low cable and take the handle with the far hand. Raise the arm out to the side to shoulder height.',
  }),
  ex({
    id: 'sys.machine-lateral-raise',
    nameDe: 'Seitheben an der Maschine',
    nameEn: 'Machine Lateral Raise',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    descriptionDe:
      'Sitz so einstellen, dass die Schultern auf Höhe der Drehachse liegen. Polster seitlich bis Schulterhöhe heben.',
    descriptionEn:
      'Adjust the seat so the shoulders line up with the pivot. Raise the pads out to the sides to shoulder height.',
  }),
  ex({
    id: 'sys.front-raise',
    nameDe: 'Kurzhantel-Frontheben',
    nameEn: 'Dumbbell Front Raise',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    aliases: ['Frontheben', 'Front Raise'],
    descriptionDe:
      'Kurzhanteln mit fast gestreckten Armen vor dem Körper bis Schulterhöhe heben und kontrolliert senken.',
    descriptionEn:
      'Raise the dumbbells in front of you with almost straight arms to shoulder height and lower them under control.',
  }),
  ex({
    id: 'sys.cable-front-raise',
    nameDe: 'Frontheben am Kabel',
    nameEn: 'Cable Front Raise',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    descriptionDe:
      'Mit dem Rücken zum tiefen Kabelzug stehen. Griff mit gestrecktem Arm nach vorne bis Schulterhöhe heben.',
    descriptionEn:
      'Stand with your back to a low cable. Raise the handle forward with a straight arm to shoulder height.',
  }),
  ex({
    id: 'sys.plate-front-raise',
    nameDe: 'Frontheben mit Hantelscheibe',
    nameEn: 'Plate Front Raise',
    equipment: 'other',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    descriptionDe:
      'Hantelscheibe mit beiden Händen seitlich greifen und mit gestreckten Armen bis Augenhöhe heben.',
    descriptionEn:
      'Grip a weight plate at both sides and raise it with straight arms to eye level.',
  }),
  ex({
    id: 'sys.reverse-fly',
    nameDe: 'Reverse Flys mit Kurzhanteln',
    nameEn: 'Dumbbell Reverse Fly',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['Vorgebeugtes Seitheben', 'Rear Delt Fly', 'Reverse Butterfly'],
    descriptionDe:
      'Mit geradem Rücken nach vorne beugen. Kurzhanteln mit leicht gebeugten Armen seitlich nach oben führen, Fokus auf die hintere Schulter.',
    descriptionEn:
      'Hinge forward with a flat back. Raise the dumbbells out to the sides with slightly bent arms, focusing on the rear shoulder.',
  }),
  ex({
    id: 'sys.reverse-pec-deck',
    nameDe: 'Reverse Butterfly an der Maschine',
    nameEn: 'Reverse Pec Deck',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['Reverse Flys Maschine', 'Rear Delt Machine'],
    descriptionDe:
      'Mit der Brust zum Polster sitzen. Griffe mit fast gestreckten Armen in einem Bogen nach hinten ziehen.',
    descriptionEn: 'Sit facing the pad. Pull the handles back in an arc with almost straight arms.',
  }),
  ex({
    id: 'sys.cable-reverse-fly',
    nameDe: 'Reverse Flys am Kabel',
    nameEn: 'Cable Reverse Fly',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['Kabel Reverse Flys'],
    descriptionDe:
      'Zwischen zwei Kabelzügen auf Schulterhöhe stehen, Kabel überkreuzt greifen und die Arme seitlich nach hinten öffnen.',
    descriptionEn:
      'Stand between two cables at shoulder height, grab them crossed over and open the arms out and back.',
  }),
  ex({
    id: 'sys.face-pull',
    nameDe: 'Face Pulls',
    nameEn: 'Face Pull',
    equipment: 'cable',
    movementPattern: 'horizontalPull',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['Facepull', 'Gesichtszug'],
    descriptionDe:
      'Seil am Kabelzug auf Kopfhöhe. Seil zum Gesicht ziehen und dabei die Hände nach außen auseinanderführen.',
    descriptionEn:
      'Set a rope on a cable at head height. Pull it towards your face while spreading the hands apart.',
  }),
  ex({
    id: 'sys.upright-row',
    nameDe: 'Aufrechtes Rudern',
    nameEn: 'Upright Row',
    equipment: 'barbell',
    movementPattern: 'verticalPull',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['Upright Row Langhantel', 'Kinnziehen'],
    descriptionDe:
      'Stange mit schulterbreitem Griff vor dem Körper halten und mit hohen Ellbogen bis etwa Brusthöhe ziehen.',
    descriptionEn:
      'Hold the bar in front of you with a shoulder-width grip and pull it to about chest height, leading with the elbows.',
  }),
  ex({
    id: 'sys.band-pull-apart',
    nameDe: 'Band Pull-Aparts',
    nameEn: 'Band Pull-Apart',
    equipment: 'band',
    movementPattern: 'horizontalPull',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['Band auseinanderziehen'],
    descriptionDe:
      'Widerstandsband mit gestreckten Armen vor der Brust halten und auseinanderziehen, bis es die Brust berührt.',
    descriptionEn:
      'Hold a resistance band in front of the chest with straight arms and pull it apart until it touches the chest.',
  }),
  ex({
    id: 'sys.pike-push-up',
    nameDe: 'Pike Push-ups',
    nameEn: 'Pike Push-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps'],
    aliases: ['Pike Liegestütze'],
    descriptionDe:
      'In einer umgekehrten V-Position mit hoher Hüfte stützen. Kopf zwischen den Händen Richtung Boden senken und hochdrücken.',
    descriptionEn:
      'Support yourself in an inverted V with hips high. Lower your head between the hands towards the floor and press back up.',
  }),
  ex({
    id: 'sys.handstand-push-up',
    nameDe: 'Handstand-Liegestütze',
    nameEn: 'Handstand Push-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPush',
    primary: ['shoulders'],
    secondary: ['triceps'],
    aliases: ['HSPU', 'Handstand Push-ups'],
    descriptionDe:
      'Im Handstand mit den Füßen an einer Wand. Kopf kontrolliert Richtung Boden senken und wieder hochdrücken.',
    descriptionEn:
      'Kick up into a handstand with feet against a wall. Lower your head towards the floor under control and press back up.',
  }),
  ex({
    id: 'sys.suspension-y-raise',
    nameDe: 'Y-Raise am Schlingentrainer',
    nameEn: 'Suspension Y Raise',
    exerciseType: 'bodyweight',
    equipment: 'suspension',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    secondary: ['back'],
    aliases: ['TRX Y-Raise'],
    descriptionDe:
      'Griffe mit gestreckten Armen halten und schräg nach hinten lehnen. Körper hochziehen, indem die Arme in eine Y-Form über den Kopf geführt werden.',
    descriptionEn:
      'Hold the handles with straight arms and lean back. Pull your body up by raising the arms overhead into a Y shape.',
  }),
  ex({
    id: 'sys.cable-external-rotation',
    nameDe: 'Außenrotation am Kabel',
    nameEn: 'Cable External Rotation',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['shoulders'],
    aliases: ['Außenrotation', 'External Rotation'],
    descriptionDe:
      'Seitlich zum Kabelzug auf Ellbogenhöhe stehen, Ellbogen am Körper und 90 Grad gebeugt. Unterarm nach außen drehen.',
    descriptionEn:
      'Stand side-on to a cable at elbow height, elbow at your side and bent 90 degrees. Rotate the forearm outward.',
  }),
];
