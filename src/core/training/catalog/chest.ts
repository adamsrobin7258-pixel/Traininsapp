import { ex } from './define';

export const CHEST = [
  ex({
    id: 'sys.bench-press',
    nameDe: 'Langhantel-Bankdrücken',
    nameEn: 'Barbell Bench Press',
    equipment: 'barbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    aliases: ['Bankdrücken', 'Bench Press', 'LH Bankdrücken', 'Flachbankdrücken'],
    descriptionDe:
      'Auf der Flachbank liegen, Schulterblätter zusammenziehen. Stange kontrolliert zur unteren Brust senken und wieder nach oben drücken.',
    descriptionEn:
      'Lie on a flat bench with shoulder blades pulled back. Lower the bar under control to the lower chest and press it back up.',
  }),
  ex({
    id: 'sys.dumbbell-bench-press',
    nameDe: 'Kurzhantel-Bankdrücken',
    nameEn: 'Dumbbell Bench Press',
    equipment: 'dumbbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    aliases: ['KH Bankdrücken', 'DB Bench Press', 'Kurzhanteldrücken'],
    descriptionDe:
      'Auf der Flachbank liegend die Kurzhanteln seitlich der Brust absenken und über der Brust wieder zusammenführen.',
    descriptionEn:
      'Lying on a flat bench, lower the dumbbells beside the chest and press them back up above the chest.',
  }),
  ex({
    id: 'sys.incline-bench-press',
    nameDe: 'Langhantel-Schrägbankdrücken',
    nameEn: 'Incline Barbell Bench Press',
    equipment: 'barbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    aliases: ['Schrägbankdrücken', 'Incline Bench Press'],
    descriptionDe:
      'Bank auf etwa 30–45 Grad stellen. Stange zur oberen Brust senken und senkrecht nach oben drücken.',
    descriptionEn:
      'Set the bench to about 30–45 degrees. Lower the bar to the upper chest and press it straight up.',
  }),
  ex({
    id: 'sys.incline-dumbbell-press',
    nameDe: 'Kurzhantel-Schrägbankdrücken',
    nameEn: 'Incline Dumbbell Press',
    equipment: 'dumbbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    aliases: ['Schrägbankdrücken mit Kurzhanteln', 'KH Schrägbankdrücken', 'Incline DB Press'],
    descriptionDe:
      'Auf der Schrägbank die Kurzhanteln neben der oberen Brust absenken und nach oben drücken.',
    descriptionEn:
      'On an incline bench, lower the dumbbells beside the upper chest and press them up.',
  }),
  ex({
    id: 'sys.decline-bench-press',
    nameDe: 'Negativbankdrücken',
    nameEn: 'Decline Bench Press',
    equipment: 'barbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    aliases: ['Negativ Bankdrücken'],
    descriptionDe:
      'Auf der Negativbank mit fixierten Beinen die Stange zur unteren Brust senken und nach oben drücken.',
    descriptionEn:
      'On a decline bench with the legs secured, lower the bar to the lower chest and press it up.',
  }),
  ex({
    id: 'sys.decline-dumbbell-press',
    nameDe: 'Kurzhantel-Negativbankdrücken',
    nameEn: 'Decline Dumbbell Press',
    equipment: 'dumbbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    descriptionDe:
      'Auf der Negativbank die Kurzhanteln neben der unteren Brust absenken und nach oben drücken.',
    descriptionEn: 'On a decline bench, lower the dumbbells beside the lower chest and press up.',
  }),
  ex({
    id: 'sys.floor-press',
    nameDe: 'Langhantel-Bodendrücken',
    nameEn: 'Barbell Floor Press',
    equipment: 'barbell',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps'],
    aliases: ['Floor Press'],
    descriptionDe:
      'Auf dem Boden liegend die Stange senken, bis die Oberarme den Boden berühren, kurz halten und nach oben drücken.',
    descriptionEn:
      'Lying on the floor, lower the bar until the upper arms touch the floor, pause briefly and press up.',
  }),
  ex({
    id: 'sys.smith-bench-press',
    nameDe: 'Bankdrücken an der Multipresse',
    nameEn: 'Smith Machine Bench Press',
    equipment: 'smithMachine',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    aliases: ['Smith Bankdrücken'],
    descriptionDe:
      'Bank unter der geführten Stange ausrichten. Stange zur Brust senken und in der Führung nach oben drücken.',
    descriptionEn:
      'Position the bench under the guided bar. Lower the bar to the chest and press it up along the rails.',
  }),
  ex({
    id: 'sys.smith-incline-press',
    nameDe: 'Schrägbankdrücken an der Multipresse',
    nameEn: 'Smith Machine Incline Press',
    equipment: 'smithMachine',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    descriptionDe:
      'Schrägbank unter der geführten Stange ausrichten. Stange zur oberen Brust senken und nach oben drücken.',
    descriptionEn:
      'Place an incline bench under the guided bar. Lower the bar to the upper chest and press up.',
  }),
  ex({
    id: 'sys.chest-press-machine',
    nameDe: 'Brustpresse',
    nameEn: 'Machine Chest Press',
    equipment: 'machine',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    aliases: ['Chest Press', 'Brustpresse Maschine'],
    descriptionDe:
      'Sitz so einstellen, dass die Griffe auf Brusthöhe liegen. Griffe nach vorn drücken und kontrolliert zurückführen.',
    descriptionEn:
      'Adjust the seat so the handles are at chest height. Press the handles forward and return under control.',
  }),
  ex({
    id: 'sys.incline-chest-press-machine',
    nameDe: 'Schräge Brustpresse',
    nameEn: 'Incline Machine Chest Press',
    equipment: 'machine',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    aliases: ['Incline Chest Press'],
    descriptionDe:
      'An der Maschine die Griffe schräg nach oben vorn drücken und langsam zurückführen.',
    descriptionEn: 'On the machine, press the handles up and forward and return them slowly.',
  }),
  ex({
    id: 'sys.cable-chest-press',
    nameDe: 'Brustpresse am Kabel stehend',
    nameEn: 'Standing Cable Chest Press',
    equipment: 'cable',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders', 'core'],
    descriptionDe:
      'Mit Schrittstellung zwischen zwei Kabelzügen stehen und die Griffe auf Brusthöhe nach vorn drücken.',
    descriptionEn:
      'Stand in a split stance between two cable towers and press the handles forward at chest height.',
  }),
  ex({
    id: 'sys.cable-fly',
    nameDe: 'Kabel-Flys',
    nameEn: 'Cable Fly',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['chest'],
    aliases: ['Cable Crossover', 'Kabelziehen über Kreuz', 'Kabel Flys'],
    descriptionDe:
      'Zwischen zwei Kabelzügen die Griffe mit leicht gebeugten Armen im Bogen vor der Brust zusammenführen.',
    descriptionEn:
      'Between two cable towers, bring the handles together in front of the chest in an arc with slightly bent arms.',
  }),
  ex({
    id: 'sys.low-cable-fly',
    nameDe: 'Kabel-Flys von unten',
    nameEn: 'Low-to-High Cable Fly',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['chest'],
    secondary: ['shoulders'],
    descriptionDe:
      'Kabel unten einhängen und die Griffe im Bogen nach oben vor die obere Brust führen.',
    descriptionEn:
      'With the pulleys set low, bring the handles up in an arc in front of the upper chest.',
  }),
  ex({
    id: 'sys.high-cable-fly',
    nameDe: 'Kabel-Flys von oben',
    nameEn: 'High-to-Low Cable Fly',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['chest'],
    descriptionDe: 'Kabel oben einhängen und die Griffe im Bogen nach unten vor den Bauch führen.',
    descriptionEn:
      'With the pulleys set high, bring the handles down in an arc in front of the abdomen.',
  }),
  ex({
    id: 'sys.dumbbell-fly',
    nameDe: 'Kurzhantel-Flys',
    nameEn: 'Dumbbell Fly',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['chest'],
    aliases: ['Fliegende', 'KH Flys', 'DB Fly'],
    descriptionDe:
      'Auf der Flachbank die Kurzhanteln mit leicht gebeugten Armen seitlich absenken und im Bogen zurückführen.',
    descriptionEn:
      'On a flat bench, lower the dumbbells out to the sides with slightly bent arms and bring them back in an arc.',
  }),
  ex({
    id: 'sys.incline-dumbbell-fly',
    nameDe: 'Kurzhantel-Flys auf der Schrägbank',
    nameEn: 'Incline Dumbbell Fly',
    equipment: 'dumbbell',
    movementPattern: 'isolation',
    primary: ['chest'],
    secondary: ['shoulders'],
    aliases: ['Schrägbank Fliegende'],
    descriptionDe:
      'Auf der Schrägbank die Kurzhanteln im Bogen seitlich absenken und über der Brust zusammenführen.',
    descriptionEn:
      'On an incline bench, lower the dumbbells out to the sides in an arc and bring them together above the chest.',
  }),
  ex({
    id: 'sys.pec-deck',
    nameDe: 'Butterfly-Maschine',
    nameEn: 'Pec Deck',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['chest'],
    aliases: ['Butterfly', 'Machine Fly', 'Pec Fly'],
    descriptionDe:
      'Mit aufrechtem Oberkörper die Arme oder Polster vor der Brust zusammenführen und langsam öffnen.',
    descriptionEn:
      'Sitting upright, bring the arms or pads together in front of the chest and open them slowly.',
  }),
  ex({
    id: 'sys.push-up',
    nameDe: 'Liegestütze',
    nameEn: 'Push-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders', 'core'],
    aliases: ['Liegestütz', 'Push up', 'Pushups'],
    descriptionDe:
      'Hände etwas breiter als schulterbreit, Körper gestreckt. Brust Richtung Boden senken und wieder hochdrücken.',
    descriptionEn:
      'Hands slightly wider than shoulder width, body straight. Lower the chest towards the floor and push back up.',
  }),
  ex({
    id: 'sys.incline-push-up',
    nameDe: 'Liegestütze mit erhöhten Händen',
    nameEn: 'Incline Push-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    descriptionDe:
      'Hände auf eine Bank oder Erhöhung stützen und Liegestütze mit gestrecktem Körper ausführen.',
    descriptionEn: 'Place the hands on a bench or box and do push-ups with a straight body.',
  }),
  ex({
    id: 'sys.decline-push-up',
    nameDe: 'Liegestütze mit erhöhten Füßen',
    nameEn: 'Decline Push-up',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['shoulders', 'triceps'],
    descriptionDe: 'Füße auf eine Bank legen und Liegestütze mit gestrecktem Körper ausführen.',
    descriptionEn: 'Rest the feet on a bench and do push-ups with a straight body.',
  }),
  ex({
    id: 'sys.dip',
    nameDe: 'Dips',
    nameEn: 'Dip',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'verticalPush',
    primary: ['chest', 'triceps'],
    secondary: ['shoulders'],
    aliases: ['Barrenstütz', 'Chest Dip', 'Parallel Bar Dip'],
    descriptionDe:
      'Am Barren den Körper mit leicht nach vorn geneigtem Oberkörper absenken und wieder hochdrücken.',
    descriptionEn:
      'On parallel bars, lower the body with the torso slightly leaned forward and press back up.',
  }),
  ex({
    id: 'sys.suspension-push-up',
    nameDe: 'Liegestütze am Schlingentrainer',
    nameEn: 'Suspension Push-up',
    exerciseType: 'bodyweight',
    equipment: 'suspension',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders', 'core'],
    aliases: ['TRX Liegestütze', 'TRX Push-up'],
    descriptionDe:
      'Griffe der Schlaufen halten, Körper gestreckt nach vorn neigen und Liegestütze mit stabiler Schulter ausführen.',
    descriptionEn:
      'Hold the suspension handles, lean forward with a straight body and do push-ups with stable shoulders.',
  }),
  ex({
    id: 'sys.band-chest-press',
    nameDe: 'Brustpresse mit Widerstandsband',
    nameEn: 'Band Chest Press',
    exerciseType: 'bodyweight',
    equipment: 'band',
    movementPattern: 'horizontalPush',
    primary: ['chest'],
    secondary: ['triceps', 'shoulders'],
    descriptionDe:
      'Band hinter dem Rücken auf Brusthöhe führen oder befestigen und die Enden nach vorn drücken.',
    descriptionEn:
      'Run the band behind the back or anchor it at chest height and press the ends forward.',
  }),
];
