import { ex } from './define';

export const LEGS = [
  ex({
    id: 'sys.back-squat',
    nameDe: 'Langhantel-Kniebeugen',
    nameEn: 'Barbell Back Squat',
    equipment: 'barbell',
    movementPattern: 'squat',
    primary: ['quadriceps', 'glutes'],
    secondary: ['hamstrings', 'core'],
    aliases: ['Kniebeugen', 'Kniebeuge', 'Squat', 'Back Squat', 'LH Kniebeugen'],
    descriptionDe:
      'Stange auf dem oberen Rücken, Füße etwa schulterbreit. Hüfte nach hinten unten senken, Knie folgen den Zehen, und aus den Beinen hochdrücken.',
    descriptionEn:
      'Bar on the upper back, feet about shoulder-width. Sit the hips back and down, knees tracking the toes, and drive back up.',
  }),
  ex({
    id: 'sys.front-squat',
    nameDe: 'Frontkniebeugen',
    nameEn: 'Front Squat',
    equipment: 'barbell',
    movementPattern: 'squat',
    primary: ['quadriceps'],
    secondary: ['glutes', 'core'],
    aliases: ['Front Kniebeugen'],
    descriptionDe:
      'Stange vorne auf den Schultern, Ellbogen hoch. Mit aufrechtem Oberkörper tief beugen und hochdrücken.',
    descriptionEn:
      'Bar resting on the front of the shoulders, elbows high. Squat deep with an upright torso and stand up.',
  }),
  ex({
    id: 'sys.goblet-squat',
    nameDe: 'Goblet Squat',
    nameEn: 'Goblet Squat',
    equipment: 'kettlebell',
    movementPattern: 'squat',
    primary: ['quadriceps', 'glutes'],
    secondary: ['core'],
    aliases: ['Goblet Kniebeugen', 'Kelchkniebeuge'],
    descriptionDe:
      'Kettlebell oder Kurzhantel vor der Brust halten. Aufrecht zwischen die Knie absenken und wieder aufrichten.',
    descriptionEn:
      'Hold a kettlebell or dumbbell in front of the chest. Squat down upright between the knees and stand back up.',
  }),
  ex({
    id: 'sys.smith-squat',
    nameDe: 'Kniebeugen an der Multipresse',
    nameEn: 'Smith Machine Squat',
    equipment: 'smithMachine',
    movementPattern: 'squat',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Smith Kniebeugen'],
    descriptionDe:
      'Stange der Multipresse auf dem oberen Rücken, Füße leicht vor dem Körper. Kontrolliert beugen und hochdrücken.',
    descriptionEn:
      'Smith bar on the upper back, feet slightly in front. Squat down under control and press back up.',
  }),
  ex({
    id: 'sys.hack-squat',
    nameDe: 'Hackenschmidt-Kniebeugen',
    nameEn: 'Hack Squat',
    equipment: 'machine',
    movementPattern: 'squat',
    primary: ['quadriceps'],
    secondary: ['glutes'],
    aliases: ['Hackenschmidt', 'Hack Squat Maschine'],
    descriptionDe:
      'Rücken an das Polster der Maschine, Schultern unter die Auflagen. Tief beugen und über die ganze Fußsohle hochdrücken.',
    descriptionEn:
      'Back against the machine pad, shoulders under the supports. Squat deep and press up through the whole foot.',
  }),
  ex({
    id: 'sys.bodyweight-squat',
    nameDe: 'Kniebeugen ohne Gewicht',
    nameEn: 'Bodyweight Squat',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'squat',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Air Squat', 'Körpergewicht Kniebeugen'],
    descriptionDe: 'Arme nach vorne nehmen, Hüfte nach hinten unten senken und wieder aufstehen.',
    descriptionEn: 'Reach the arms forward, sit the hips back and down, then stand up again.',
  }),
  ex({
    id: 'sys.leg-press',
    nameDe: 'Beinpresse',
    nameEn: 'Leg Press',
    equipment: 'machine',
    movementPattern: 'squat',
    primary: ['quadriceps'],
    secondary: ['glutes'],
    aliases: ['Leg Press Maschine', '45 Grad Beinpresse'],
    descriptionDe:
      'Füße schulterbreit auf die Plattform. Knie kontrolliert zur Brust führen und die Plattform wegdrücken, ohne die Knie durchzustrecken.',
    descriptionEn:
      'Feet shoulder-width on the platform. Bring the knees towards the chest under control and press away without locking the knees.',
  }),
  ex({
    id: 'sys.single-leg-press',
    nameDe: 'Einbeinige Beinpresse',
    nameEn: 'Single-Leg Press',
    equipment: 'machine',
    movementPattern: 'squat',
    primary: ['quadriceps'],
    secondary: ['glutes'],
    aliases: ['Beinpresse einbeinig'],
    descriptionDe: 'Wie die Beinpresse, aber nur mit einem Bein. Becken bleibt gerade.',
    descriptionEn: 'Like the leg press, but with one leg. Keep the pelvis level.',
  }),
  ex({
    id: 'sys.bulgarian-split-squat',
    nameDe: 'Bulgarische Kniebeugen',
    nameEn: 'Bulgarian Split Squat',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Bulgarian Split Squat', 'Bulgarische Split Squats', 'BSS'],
    descriptionDe:
      'Hinteren Fuß auf eine Bank legen, Kurzhanteln seitlich. Vorderes Knie beugen, bis der Oberschenkel etwa waagerecht ist.',
    descriptionEn:
      'Rest the back foot on a bench, dumbbells at your sides. Bend the front knee until the thigh is about level.',
  }),
  ex({
    id: 'sys.split-squat',
    nameDe: 'Split Squats',
    nameEn: 'Split Squat',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Standausfallschritt'],
    descriptionDe:
      'In Schrittstellung stehen. Senkrecht absenken, bis das hintere Knie fast den Boden berührt, und hochdrücken.',
    descriptionEn:
      'Stand in a split stance. Lower straight down until the back knee nearly touches the floor and push up.',
  }),
  ex({
    id: 'sys.walking-lunge',
    nameDe: 'Gehende Ausfallschritte',
    nameEn: 'Walking Lunge',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'glutes'],
    secondary: ['hamstrings'],
    aliases: ['Ausfallschritte', 'Lunges', 'Walking Lunges'],
    descriptionDe:
      'Mit Kurzhanteln abwechselnd große Schritte nach vorne machen und das hintere Knie Richtung Boden senken.',
    descriptionEn:
      'Holding dumbbells, take alternating long steps forward and lower the back knee towards the floor.',
  }),
  ex({
    id: 'sys.reverse-lunge',
    nameDe: 'Ausfallschritte rückwärts',
    nameEn: 'Reverse Lunge',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Reverse Lunges', 'Rückwärtsausfallschritt'],
    descriptionDe:
      'Einen großen Schritt nach hinten machen, hinteres Knie absenken und zurück in den Stand drücken.',
    descriptionEn: 'Take a long step back, lower the back knee and push back to standing.',
  }),
  ex({
    id: 'sys.lateral-lunge',
    nameDe: 'Seitliche Ausfallschritte',
    nameEn: 'Lateral Lunge',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'adductors'],
    secondary: ['glutes'],
    aliases: ['Side Lunge', 'Seitausfallschritt'],
    descriptionDe:
      'Breiter Schritt zur Seite, Hüfte nach hinten auf das gebeugte Bein setzen, anderes Bein bleibt gestreckt.',
    descriptionEn:
      'Step wide to the side and sit the hips back onto the bent leg while the other leg stays straight.',
  }),
  ex({
    id: 'sys.step-up',
    nameDe: 'Step-ups',
    nameEn: 'Step-up',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Aufsteiger', 'Box Step-up'],
    descriptionDe:
      'Mit einem Fuß auf eine Box oder Bank steigen und sich mit diesem Bein nach oben drücken.',
    descriptionEn: 'Place one foot on a box or bench and drive up with that leg.',
  }),
  ex({
    id: 'sys.leg-extension',
    nameDe: 'Beinstrecker',
    nameEn: 'Leg Extension',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['quadriceps'],
    aliases: ['Beinstrecken', 'Leg Extension Maschine'],
    descriptionDe:
      'Knie auf Höhe der Drehachse, Polster vor den Schienbeinen. Beine strecken und langsam beugen.',
    descriptionEn:
      'Knees at the pivot, pad in front of the shins. Extend the legs and bend them slowly.',
  }),
  ex({
    id: 'sys.leg-curl',
    nameDe: 'Liegender Beinbeuger',
    nameEn: 'Lying Leg Curl',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['hamstrings'],
    aliases: ['Beinbeuger', 'Beinbeuger an der Maschine', 'Leg Curl', 'Beincurls'],
    descriptionDe:
      'Bäuchlings auf der Maschine, Polster über den Fersen. Fersen zum Gesäß beugen und kontrolliert strecken.',
    descriptionEn:
      'Lie face down on the machine with the pad above the heels. Curl the heels towards the glutes and extend under control.',
  }),
  ex({
    id: 'sys.seated-leg-curl',
    nameDe: 'Sitzender Beinbeuger',
    nameEn: 'Seated Leg Curl',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['hamstrings'],
    descriptionDe: 'Sitzend die Unterschenkel auf das Polster legen und nach unten hinten beugen.',
    descriptionEn: 'Seated with the lower legs on the pad, curl them down and back.',
  }),
  ex({
    id: 'sys.nordic-curl',
    nameDe: 'Nordic Curls',
    nameEn: 'Nordic Hamstring Curl',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'isolation',
    primary: ['hamstrings'],
    aliases: ['Nordic Hamstring Curl', 'Nordics'],
    descriptionDe:
      'Kniend, Fersen fixiert. Oberkörper gerade und so langsam wie möglich nach vorne senken.',
    descriptionEn:
      'Kneeling with the heels anchored, lower the straight torso forward as slowly as possible.',
  }),
  ex({
    id: 'sys.romanian-deadlift',
    nameDe: 'Rumänisches Kreuzheben',
    nameEn: 'Romanian Deadlift',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['hamstrings'],
    secondary: ['glutes', 'back'],
    aliases: ['RDL', 'Rumänisches Kreuzheben Langhantel'],
    descriptionDe:
      'Knie leicht gebeugt, Rücken gerade. Stange nah an den Beinen entlang senken, indem die Hüfte nach hinten geschoben wird.',
    descriptionEn:
      'Knees slightly bent, back flat. Lower the bar close along the legs by pushing the hips back.',
  }),
  ex({
    id: 'sys.dumbbell-romanian-deadlift',
    nameDe: 'Rumänisches Kreuzheben mit Kurzhanteln',
    nameEn: 'Dumbbell Romanian Deadlift',
    equipment: 'dumbbell',
    movementPattern: 'hinge',
    primary: ['hamstrings'],
    secondary: ['glutes'],
    aliases: ['KH RDL', 'DB RDL'],
    descriptionDe:
      'Kurzhanteln vor den Oberschenkeln. Hüfte nach hinten schieben und die Hanteln entlang der Beine senken.',
    descriptionEn:
      'Dumbbells in front of the thighs. Push the hips back and lower the dumbbells along the legs.',
  }),
  ex({
    id: 'sys.stiff-leg-deadlift',
    nameDe: 'Kreuzheben mit gestreckten Beinen',
    nameEn: 'Stiff-Leg Deadlift',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['hamstrings'],
    secondary: ['back', 'glutes'],
    aliases: ['Stiff Leg Deadlift', 'Steifbeiniges Kreuzheben'],
    descriptionDe:
      'Mit fast gestreckten Knien die Stange bis zur Dehnung der Beinrückseite senken, Rücken gerade.',
    descriptionEn:
      'With nearly straight knees, lower the bar until the backs of the legs stretch, back flat.',
  }),
  ex({
    id: 'sys.single-leg-rdl',
    nameDe: 'Einbeiniges Rumänisches Kreuzheben',
    nameEn: 'Single-Leg Romanian Deadlift',
    equipment: 'dumbbell',
    movementPattern: 'hinge',
    primary: ['hamstrings', 'glutes'],
    aliases: ['Single Leg RDL', 'Einbeiniges Kreuzheben'],
    descriptionDe:
      'Auf einem Bein stehen, Oberkörper nach vorne neigen und das freie Bein nach hinten strecken.',
    descriptionEn: 'Stand on one leg, tip the torso forward and extend the free leg behind you.',
  }),
  ex({
    id: 'sys.good-morning',
    nameDe: 'Good Mornings',
    nameEn: 'Good Morning',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['hamstrings'],
    secondary: ['back', 'glutes'],
    aliases: ['Guten Morgen'],
    descriptionDe:
      'Stange auf dem oberen Rücken. Mit geradem Rücken die Hüfte nach hinten schieben und den Oberkörper nach vorne neigen.',
    descriptionEn:
      'Bar on the upper back. Push the hips back and tip the torso forward with a flat back.',
  }),
  ex({
    id: 'sys.sumo-deadlift',
    nameDe: 'Sumo-Kreuzheben',
    nameEn: 'Sumo Deadlift',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['glutes', 'adductors'],
    secondary: ['hamstrings', 'quadriceps', 'back'],
    aliases: ['Sumo Deadlift', 'Sumo Kreuzheben'],
    descriptionDe:
      'Breiter Stand, Zehen nach außen, Griff innerhalb der Knie. Stange mit geradem Rücken nach oben ziehen.',
    descriptionEn:
      'Wide stance, toes out, grip inside the knees. Pull the bar up with a flat back.',
  }),
  ex({
    id: 'sys.trap-bar-deadlift',
    nameDe: 'Trap-Bar-Kreuzheben',
    nameEn: 'Trap Bar Deadlift',
    equipment: 'other',
    movementPattern: 'hinge',
    primary: ['quadriceps', 'glutes'],
    secondary: ['hamstrings', 'back'],
    aliases: ['Hex Bar Deadlift', 'Hexbar Kreuzheben'],
    descriptionDe:
      'In der Mitte der Trap Bar stehen, Griffe seitlich fassen. Mit geradem Rücken aus Beinen und Hüfte aufrichten.',
    descriptionEn:
      'Stand inside the trap bar and grip the side handles. Stand up through the legs and hips with a flat back.',
  }),
  ex({
    id: 'sys.adductor-machine',
    nameDe: 'Adduktorenmaschine',
    nameEn: 'Hip Adduction Machine',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['adductors'],
    aliases: ['Adduktoren', 'Beine zusammendrücken', 'Adductor Machine'],
    descriptionDe: 'Sitzend die Polster an den Innenseiten der Knie zusammendrücken.',
    descriptionEn: 'Seated, squeeze the pads at the inside of the knees together.',
  }),
  ex({
    id: 'sys.abductor-machine',
    nameDe: 'Abduktorenmaschine',
    nameEn: 'Hip Abduction Machine',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['glutes'],
    aliases: ['Abduktoren', 'Beine auseinanderdrücken', 'Abductor Machine'],
    descriptionDe: 'Sitzend die Polster an den Außenseiten der Knie nach außen drücken.',
    descriptionEn: 'Seated, press the pads at the outside of the knees outward.',
  }),
  ex({
    id: 'sys.pistol-squat',
    nameDe: 'Pistol Squats',
    nameEn: 'Pistol Squat',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'squat',
    primary: ['quadriceps', 'glutes'],
    aliases: ['Einbeinige Kniebeuge'],
    descriptionDe:
      'Auf einem Bein tief in die Hocke gehen, das andere Bein gestreckt nach vorne halten, und wieder aufstehen.',
    descriptionEn:
      'Squat deep on one leg with the other leg held straight in front, then stand back up.',
  }),
  ex({
    id: 'sys.wall-sit',
    nameDe: 'Wandsitzen',
    nameEn: 'Wall Sit',
    exerciseType: 'timed',
    equipment: 'bodyweight',
    movementPattern: 'squat',
    primary: ['quadriceps'],
    aliases: ['Wall Sit', 'Stuhl an der Wand'],
    descriptionDe:
      'Mit dem Rücken an der Wand in eine Sitzposition mit 90 Grad im Knie gehen und halten.',
    descriptionEn:
      'With your back against a wall, lower into a seated position with knees at 90 degrees and hold.',
  }),
  ex({
    id: 'sys.sissy-squat',
    nameDe: 'Sissy Squats',
    nameEn: 'Sissy Squat',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'squat',
    primary: ['quadriceps'],
    descriptionDe:
      'Auf den Fußballen stehend Knie nach vorne schieben und den Oberkörper gerade nach hinten lehnen.',
    descriptionEn:
      'On the balls of the feet, push the knees forward while leaning the straight torso back.',
  }),
  ex({
    id: 'sys.cossack-squat',
    nameDe: 'Kosakenkniebeugen',
    nameEn: 'Cossack Squat',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'lunge',
    primary: ['quadriceps', 'adductors'],
    secondary: ['glutes'],
    aliases: ['Cossack Squat'],
    descriptionDe:
      'Sehr breiter Stand. Seitlich tief auf ein Bein absenken, das andere bleibt gestreckt mit Zehen nach oben.',
    descriptionEn:
      'Very wide stance. Sink deep to one side while the other leg stays straight with the toes up.',
  }),
];

export const GLUTES = [
  ex({
    id: 'sys.hip-thrust',
    nameDe: 'Langhantel-Hip-Thrust',
    nameEn: 'Barbell Hip Thrust',
    equipment: 'barbell',
    movementPattern: 'hinge',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    aliases: ['Hip Thrust', 'Hüftstrecken', 'Hip Thrusts'],
    descriptionDe:
      'Oberen Rücken an eine Bank lehnen, Stange über der Hüfte. Hüfte nach oben strecken, bis der Körper eine Linie bildet.',
    descriptionEn:
      'Upper back against a bench, bar across the hips. Drive the hips up until the body forms a straight line.',
  }),
  ex({
    id: 'sys.machine-hip-thrust',
    nameDe: 'Hip Thrust an der Maschine',
    nameEn: 'Machine Hip Thrust',
    equipment: 'machine',
    movementPattern: 'hinge',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    aliases: ['Glute Drive'],
    descriptionDe:
      'Rücken an das Polster, Gurt oder Polster über der Hüfte. Hüfte nach oben strecken.',
    descriptionEn: 'Back against the pad, belt or pad across the hips. Drive the hips up.',
  }),
  ex({
    id: 'sys.glute-bridge',
    nameDe: 'Glute Bridge',
    nameEn: 'Glute Bridge',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'hinge',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    aliases: ['Beckenheben', 'Hüftheben', 'Brücke'],
    descriptionDe:
      'Auf dem Rücken liegen, Füße aufgestellt. Hüfte anheben, bis Knie, Hüfte und Schultern eine Linie bilden.',
    descriptionEn:
      'Lie on your back with feet planted. Lift the hips until knees, hips and shoulders form a line.',
  }),
  ex({
    id: 'sys.single-leg-glute-bridge',
    nameDe: 'Einbeinige Glute Bridge',
    nameEn: 'Single-Leg Glute Bridge',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'hinge',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    aliases: ['Einbeiniges Beckenheben'],
    descriptionDe: 'Wie die Glute Bridge, aber ein Bein ist gestreckt in der Luft.',
    descriptionEn: 'Like the glute bridge, but with one leg held straight in the air.',
  }),
  ex({
    id: 'sys.cable-glute-kickback',
    nameDe: 'Glute-Kickbacks am Kabel',
    nameEn: 'Cable Glute Kickback',
    equipment: 'cable',
    movementPattern: 'isolation',
    primary: ['glutes'],
    aliases: ['Kabel Kickbacks Po', 'Beinrückheben am Kabel'],
    descriptionDe:
      'Manschette am Fußgelenk, leicht vorgebeugt am tiefen Kabelzug. Bein gestreckt nach hinten führen.',
    descriptionEn:
      'Ankle cuff on, leaning slightly forward at a low cable. Move the straight leg backward.',
  }),
  ex({
    id: 'sys.machine-glute-kickback',
    nameDe: 'Glute-Kickbacks an der Maschine',
    nameEn: 'Machine Glute Kickback',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['glutes'],
    aliases: ['Gesäßmaschine'],
    descriptionDe:
      'Oberkörper auf dem Polster abstützen und das Bein gegen den Widerstand nach hinten strecken.',
    descriptionEn:
      'Support the torso on the pad and extend the leg backward against the resistance.',
  }),
  ex({
    id: 'sys.quadruped-kickback',
    nameDe: 'Kickbacks im Vierfüßlerstand',
    nameEn: 'Quadruped Kickback',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'isolation',
    primary: ['glutes'],
    aliases: ['Donkey Kicks', 'Beinheben Vierfüßler'],
    descriptionDe:
      'Im Vierfüßlerstand ein gebeugtes Bein nach hinten oben drücken, ohne ins Hohlkreuz zu fallen.',
    descriptionEn: 'On all fours, press one bent leg back and up without arching the lower back.',
  }),
  ex({
    id: 'sys.cable-pull-through',
    nameDe: 'Cable Pull-Through',
    nameEn: 'Cable Pull-Through',
    equipment: 'cable',
    movementPattern: 'hinge',
    primary: ['glutes'],
    secondary: ['hamstrings'],
    aliases: ['Pull Through'],
    descriptionDe:
      'Mit dem Rücken zum tiefen Kabelzug, Seil zwischen den Beinen. Hüfte nach hinten schieben und kraftvoll nach vorne strecken.',
    descriptionEn:
      'Back to a low cable, rope between the legs. Push the hips back and drive them forward powerfully.',
  }),
  ex({
    id: 'sys.band-lateral-walk',
    nameDe: 'Seitwärtsgehen mit Widerstandsband',
    nameEn: 'Banded Lateral Walk',
    exerciseType: 'bodyweight',
    equipment: 'band',
    movementPattern: 'isolation',
    primary: ['glutes'],
    aliases: ['Monster Walk', 'Band Walk', 'Lateral Band Walk'],
    descriptionDe:
      'Band über den Knien oder Fußgelenken, leicht in die Knie gehen und seitlich Schritte machen.',
    descriptionEn: 'Band above the knees or ankles, bend the knees slightly and take side steps.',
  }),
  ex({
    id: 'sys.curtsy-lunge',
    nameDe: 'Curtsy Lunges',
    nameEn: 'Curtsy Lunge',
    equipment: 'dumbbell',
    movementPattern: 'lunge',
    primary: ['glutes'],
    secondary: ['quadriceps', 'adductors'],
    aliases: ['Knicks-Ausfallschritt'],
    descriptionDe: 'Ein Bein diagonal hinter das andere setzen und das hintere Knie absenken.',
    descriptionEn: 'Step one leg diagonally behind the other and lower the back knee.',
  }),
  ex({
    id: 'sys.kettlebell-sumo-squat',
    nameDe: 'Sumo-Kniebeugen mit Kettlebell',
    nameEn: 'Kettlebell Sumo Squat',
    equipment: 'kettlebell',
    movementPattern: 'squat',
    primary: ['glutes', 'adductors'],
    secondary: ['quadriceps'],
    aliases: ['Sumo Squat', 'Sumo Kniebeugen'],
    descriptionDe:
      'Breiter Stand, Zehen nach außen, Kettlebell hängt zwischen den Beinen. Aufrecht tief beugen.',
    descriptionEn:
      'Wide stance, toes out, kettlebell hanging between the legs. Squat deep with an upright torso.',
  }),
  ex({
    id: 'sys.reverse-hyperextension',
    nameDe: 'Reverse Hyperextensions',
    nameEn: 'Reverse Hyperextension',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'hinge',
    primary: ['glutes'],
    secondary: ['hamstrings', 'back'],
    aliases: ['Reverse Hyper'],
    descriptionDe:
      'Bäuchlings auf einer Bank, Beine hängen über die Kante. Gestreckte Beine bis zur Waagerechten heben.',
    descriptionEn:
      'Lie face down on a bench with the legs hanging off the edge. Raise the straight legs to horizontal.',
  }),
];

export const CALVES = [
  ex({
    id: 'sys.calf-raise',
    nameDe: 'Wadenheben stehend an der Maschine',
    nameEn: 'Standing Machine Calf Raise',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['calves'],
    aliases: ['Wadenheben', 'Calf Raise', 'Wadenmaschine stehend'],
    descriptionDe:
      'Fußballen auf der Kante, Schultern unter den Polstern. Fersen tief absenken und so hoch wie möglich drücken.',
    descriptionEn:
      'Balls of the feet on the edge, shoulders under the pads. Lower the heels deep and rise as high as possible.',
  }),
  ex({
    id: 'sys.seated-calf-raise',
    nameDe: 'Wadenheben sitzend',
    nameEn: 'Seated Calf Raise',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['calves'],
    aliases: ['Wadenmaschine sitzend'],
    descriptionDe: 'Sitzend, Polster auf den Oberschenkeln. Fersen absenken und wieder anheben.',
    descriptionEn: 'Seated with the pad on the thighs. Lower the heels and raise them again.',
  }),
  ex({
    id: 'sys.leg-press-calf-raise',
    nameDe: 'Wadenheben an der Beinpresse',
    nameEn: 'Leg Press Calf Raise',
    equipment: 'machine',
    movementPattern: 'isolation',
    primary: ['calves'],
    descriptionDe:
      'Fußballen an die Unterkante der Plattform, Beine gestreckt. Plattform nur mit den Füßen wegdrücken.',
    descriptionEn:
      'Balls of the feet on the lower edge of the platform, legs straight. Push it away with the feet only.',
  }),
  ex({
    id: 'sys.single-leg-calf-raise',
    nameDe: 'Einbeiniges Wadenheben',
    nameEn: 'Single-Leg Calf Raise',
    exerciseType: 'bodyweight',
    equipment: 'bodyweight',
    movementPattern: 'isolation',
    primary: ['calves'],
    descriptionDe:
      'Auf einem Bein auf einer Stufe stehen, Ferse absenken und auf die Zehenspitzen drücken.',
    descriptionEn: 'Stand on one leg on a step, lower the heel and rise onto the toes.',
  }),
  ex({
    id: 'sys.smith-calf-raise',
    nameDe: 'Wadenheben an der Multipresse',
    nameEn: 'Smith Machine Calf Raise',
    equipment: 'smithMachine',
    movementPattern: 'isolation',
    primary: ['calves'],
    descriptionDe:
      'Stange auf dem oberen Rücken, Fußballen auf einer Erhöhung. Fersen senken und hochdrücken.',
    descriptionEn:
      'Bar on the upper back, balls of the feet on a raised surface. Lower the heels and rise.',
  }),
];
