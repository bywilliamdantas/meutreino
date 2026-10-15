/* Imagens ilustrativas dos exercícios.
   Fonte: yuhonas/free-exercise-db (domínio público, Unlicense) — cada exercício tem 2 fotos
   (0 = posição inicial, 1 = posição final).

   Como funciona:
   - EXERCISE_IMAGE_MAP liga o NOME do exercício (como está em EXERCISE_LIBRARY) ao id da pasta
     no free-exercise-db. Nome da biblioteca sem entrada aqui = ícone padrão. Exercício PRÓPRIO do
     usuário tenta a foto de um exercício parecido pela primeira palavra (ver GUESS_RULES).
   - As imagens são procuradas em ordem: 1) ./exercise-images/ (cópia local, funciona offline e é
     guardada pelo service worker); 2) CDN do GitHub. Se nenhuma carregar, vira ícone.
   - `npm run imagens:verificar` confere os ids contra o banco real e lista o que falta;
     `npm run imagens:baixar` copia as fotos para public/exercise-images/. */

import { EXERCISE_LIBRARY } from "../data/exercise-library.js";

export const EXERCISE_IMAGE_SOURCES = [
  "./exercise-images/",
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/"
];

/* nome (como na biblioteca) -> id no free-exercise-db */
export const EXERCISE_IMAGE_MAP = {
  /* Peitoral */
  "Supino reto com barra": "Barbell_Bench_Press_-_Medium_Grip",
  "Supino reto com halteres": "Dumbbell_Bench_Press",
  "Supino inclinado com barra": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "Supino inclinado com halteres": "Incline_Dumbbell_Press",
  "Supino declinado com barra": "Decline_Barbell_Bench_Press",
  "Supino declinado com halteres": "Decline_Dumbbell_Bench_Press",
  "Supino declinado": "Decline_Barbell_Bench_Press",
  "Supino inclinado Smith": "Smith_Machine_Incline_Bench_Press",
  "Supino horizontal": "Machine_Bench_Press",
  "Chest Press": "Machine_Bench_Press",
  "Supino fechado": "Close-Grip_Barbell_Bench_Press",
  "Pullover com halter": "Bent-Arm_Dumbbell_Pullover",
  "Crossover alto": "Cable_Crossover",
  "Crossover médio": "Cable_Crossover",
  "Crossover baixo": "Cable_Crossover",
  "Crossover unilateral": "Cable_Crossover",
  "Crucifixo no cabo": "Cable_Crossover",
  "Crucifixo inclinado com halteres": "Incline_Dumbbell_Flyes",
  "Crucifixo": "Dumbbell_Flyes",
  "Voador": "Butterfly",
  "Peck deck": "Butterfly",
  "Flexão tradicional": "Pushups",
  "Paralelas com inclinação do tronco": "Dips_-_Chest_Version",

  /* Costas */
  "Barra fixa pronada": "Pullups",
  "Barra fixa": "Pullups",
  "Barra fixa supinada": "Chin-Up",
  "Chin-up": "Chin-Up",
  "Puxada frontal": "Wide-Grip_Lat_Pulldown",
  "Puxada aberta": "Wide-Grip_Lat_Pulldown",
  "Puxada fechada": "Close-Grip_Front_Lat_Pulldown",
  "Puxada supinada": "Underhand_Cable_Pulldowns",
  "Pulldown com braço reto": "Straight-Arm_Pulldown",
  "Remada baixa": "Seated_Cable_Rows",
  "Remada curvada com barra": "Bent_Over_Barbell_Row",
  "Remada curvada supinada": "Reverse_Grip_Bent-Over_Rows",
  "Remada unilateral com halter": "One-Arm_Dumbbell_Row",
  "Remada serrote": "One-Arm_Dumbbell_Row",
  "Remada cavalinho": "T-Bar_Row_with_Handle",
  "Remada alta": "Upright_Barbell_Row",
  "Levantamento terra": "Barbell_Deadlift",
  "Levantamento terra romeno": "Romanian_Deadlift",
  "Terra romeno": "Romanian_Deadlift",
  "Levantamento terra sumô": "Sumo_Deadlift",
  "Hiperextensão": "Hyperextensions_Back_Extensions",
  "Back Extension": "Hyperextensions_Back_Extensions",
  "Superman": "Superman",

  /* Trapézio / ombros */
  "Encolhimento com barra": "Barbell_Shrug",
  "Encolhimento com halteres": "Dumbbell_Shrug",
  "Encolhimento no Smith": "Barbell_Shrug",
  "Face Pull": "Face_Pull",
  "Farmer's Walk": "Farmers_Walk",
  "Desenvolvimento militar com barra": "Standing_Military_Press",
  "Desenvolvimento com halteres": "Dumbbell_Shoulder_Press",
  "Desenvolvimento Arnold": "Arnold_Dumbbell_Press",
  "Desenvolvimento na máquina": "Machine_Shoulder_Military_Press",
  "Elevação lateral com halteres": "Side_Lateral_Raise",
  "Elevação frontal com halteres": "Front_Dumbbell_Raise",
  "Crucifixo inverso com halteres": "Reverse_Flyes",
  "Crucifixo inverso na máquina": "Reverse_Machine_Flyes",
  "Reverse Pec Deck": "Reverse_Machine_Flyes",

  /* Bíceps / tríceps */
  "Rosca direta com barra": "Barbell_Curl",
  "Rosca direta com barra W": "EZ-Bar_Curl",
  "Rosca direta com halteres": "Dumbbell_Bicep_Curl",
  "Rosca alternada": "Dumbbell_Alternate_Bicep_Curl",
  "Rosca martelo": "Hammer_Curls",
  "Rosca concentrada": "Concentration_Curls",
  "Rosca Scott": "Preacher_Curl",
  "Rosca Scott com barra": "Preacher_Curl",
  "Rosca Scott com halteres": "One_Arm_Dumbbell_Preacher_Curl",
  "Rosca inclinada": "Incline_Dumbbell_Curl",
  "Rosca direta no cabo": "Standing_Biceps_Cable_Curl",
  "Rosca reversa": "Reverse_Barbell_Curl",
  "Rosca Zottman": "Zottman_Curl",
  "Rosca spider": "Spider_Curl",
  "Tríceps testa com barra": "EZ-Bar_Skullcrusher",
  "Tríceps pulley": "Triceps_Pushdown",
  "Tríceps barra": "Triceps_Pushdown",
  "Tríceps corda": "Triceps_Pushdown_-_Rope_Attachment",
  "Tríceps francês": "Standing_Dumbbell_Triceps_Extension",
  "Tríceps coice": "Tricep_Dumbbell_Kickback",
  "Paralelas": "Dips_-_Triceps_Version",
  "Dips": "Dips_-_Triceps_Version",

  /* Pernas / glúteos */
  "Agachamento livre": "Barbell_Squat",
  "Agachamento frontal": "Front_Barbell_Squat",
  "Agachamento goblet": "Goblet_Squat",
  "Goblet Squat": "Goblet_Squat",
  "Agachamento Smith": "Smith_Machine_Squat",
  "Hack Squat": "Hack_Squat",
  "Leg Press 45°": "Leg_Press",
  "Leg Press horizontal": "Leg_Press",
  "Cadeira extensora": "Leg_Extensions",
  "Mesa flexora": "Lying_Leg_Curls",
  "Cadeira flexora": "Seated_Leg_Curl",
  "Afundo com barra": "Barbell_Lunge",
  "Afundo com halteres": "Dumbbell_Lunges",
  "Afundo caminhando": "Bodyweight_Walking_Lunge",
  "Step-up": "Dumbbell_Step_Ups",
  "Step-up com halteres": "Dumbbell_Step_Ups",
  "Stiff com barra": "Stiff-Legged_Barbell_Deadlift",
  "Stiff": "Stiff-Legged_Barbell_Deadlift",
  "Good Morning": "Good_Morning",
  "Hip Thrust com barra": "Barbell_Hip_Thrust",
  "Glute Bridge com barra": "Barbell_Glute_Bridge",
  "Abdução na máquina": "Thigh_Abductor",
  "Abdução de quadril": "Thigh_Abductor",
  "Adução na máquina": "Thigh_Adductor",
  "Elevação de panturrilha em pé com barra": "Standing_Calf_Raises",
  "Panturrilha em pé": "Standing_Calf_Raises",
  "Panturrilha sentada": "Seated_Calf_Raise",
  "Panturrilha no Leg Press": "Calf_Press_On_The_Leg_Press_Machine",
  "Panturrilha no Smith": "Smith_Machine_Calf_Raise",
  "Panturrilha donkey": "Donkey_Calf_Raises",

  /* Abdômen / core */
  "Abdominal tradicional": "Crunches",
  "Crunch": "Crunches",
  "Crunch reverso": "Reverse_Crunch",
  "Abdominal bicicleta": "Air_Bike",
  "Sit-up": "Sit-Up",
  "Elevação de pernas": "Hanging_Leg_Raise",
  "Crunch no cabo": "Cable_Crunch",
  "Prancha": "Plank",
  "Prancha lateral": "Side_Bridge",
  "Mountain Climber": "Mountain_Climbers",
  "Dead Bug": "Dead_Bug",
  "Pallof Press": "Pallof_Press",

  /* Kettlebell */
  "Kettlebell Swing": "One-Arm_Kettlebell_Swings",

  /* ---- Ampliação: demais exercícios da biblioteca (equivalente mais próximo no banco) ---- */
  /* Quadríceps */
  "Agachamento com barra alta": "Barbell_Full_Squat",
  "Agachamento com barra baixa": "Barbell_Squat",
  "Agachamento sumô": "Plie_Dumbbell_Squat",
  "Agachamento com halteres": "Dumbbell_Squat",
  "Agachamento búlgaro": "Split_Squat_with_Dumbbells",
  "Agachamento unilateral": "One_Leg_Barbell_Squat",
  "Agachamento com calcanhar elevado": "Narrow_Stance_Squats",
  "Agachamento Zercher": "Zercher_Squats",
  "Agachamento Hack com barra": "Barbell_Hack_Squat",
  "Afundo reverso": "Dumbbell_Rear_Lunge",
  "Afundo búlgaro": "Split_Squat_with_Dumbbells",
  "Sissy squat": "Weighted_Sissy_Squat",
  "Pistol squat": "Kettlebell_Pistol_Squat",
  "Leg Press vertical": "Leg_Press",
  "Agachamento pendular": "Hack_Squat",
  "Agachamento V-Squat": "Lying_Machine_Squat",

  /* Glúteos */
  "Hip Thrust com halteres": "Barbell_Hip_Thrust",
  "Glute Bridge com halteres": "Barbell_Glute_Bridge",
  "Step-up alto": "Dumbbell_Step_Ups",
  "Agachamento profundo": "Barbell_Full_Squat",
  "Swing com kettlebell": "One-Arm_Kettlebell_Swings",
  "Hip Thrust máquina": "Barbell_Hip_Thrust",
  "Glute Drive": "Barbell_Hip_Thrust",
  "Máquina de extensão de quadril": "Glute_Kickback",
  "Glúteo no cabo/máquina": "One-Legged_Cable_Kickback",
  "Máquina de coice": "Glute_Kickback",
  "Coice no cabo": "One-Legged_Cable_Kickback",
  "Extensão de quadril no cabo": "One-Legged_Cable_Kickback",
  "Abdução no cabo": "Thigh_Abductor",
  "Adução no cabo": "Cable_Hip_Adduction",
  "Pull-through": "Pull_Through",

  /* Posteriores de coxa */
  "Stiff com halteres": "Stiff-Legged_Dumbbell_Deadlift",
  "Nordic Curl": "Natural_Glute_Ham_Raise",
  "Glute Ham Raise": "Glute_Ham_Raise",
  "Flexão nórdica assistida": "Natural_Glute_Ham_Raise",
  "Flexora unilateral": "Lying_Leg_Curls",
  "Flexora vertical": "Standing_Leg_Curl",
  "Glute Ham Developer": "Glute_Ham_Raise",
  "Máquina de posterior": "Seated_Leg_Curl",

  /* Adutores / abdutores */
  "Adução com faixa": "Band_Hip_Adductions",
  "Adução lateral no cabo": "Cable_Hip_Adduction",
  "Copenhagen plank": "Side_Bridge",
  "Abdução deitada": "Side_Leg_Raises",
  "Caminhada lateral com faixa": "Monster_Walk",
  "Monster walk": "Monster_Walk",

  /* Panturrilhas */
  "Elevação de panturrilha em pé com halteres": "Standing_Dumbbell_Calf_Raise",
  "Elevação unilateral": "Standing_Dumbbell_Calf_Raise",
  "Panturrilha no degrau": "Standing_Calf_Raises",
  "Panturrilha no Hack": "Calf_Press",
  "Panturrilha horizontal": "Calf_Press",

  /* Peitoral */
  "Supino unilateral com halter": "One_Arm_Dumbbell_Bench_Press",
  "Floor Press": "Floor_Press",
  "Floor Press com halteres": "Dumbbell_Floor_Press",
  "Squeeze Press": "Dumbbell_Bench_Press_with_Neutral_Grip",
  "Chest Press inclinado": "Leverage_Incline_Chest_Press",
  "Chest Press declinado": "Leverage_Decline_Chest_Press",
  "Supino convergente": "Leverage_Chest_Press",
  "Supino unilateral máquina": "Leverage_Chest_Press",
  "Crucifixo unilateral": "One-Arm_Flat_Bench_Dumbbell_Flye",
  "Press no cabo": "Cable_Chest_Press",
  "Supino inclinado máquina": "Leverage_Incline_Chest_Press",
  "Supino inclinado unilateral": "Incline_Dumbbell_Press",
  "Crucifixo inclinado no cabo": "Incline_Cable_Flye",
  "Crossover de baixo para cima": "Low_Cable_Crossover",
  "Squeeze Press inclinado": "Hammer_Grip_Incline_DB_Bench_Press",
  "Supino declinado máquina": "Leverage_Decline_Chest_Press",
  "Crossover de cima para baixo": "Cable_Crossover",
  "Crucifixo declinado": "Decline_Dumbbell_Flyes",

  /* Costas */
  "Barra fixa neutra": "V-Bar_Pullup",
  "Barra fixa aberta": "Wide-Grip_Rear_Pull-Up",
  "Barra fixa fechada": "Pullups",
  "Barra fixa unilateral": "One_Arm_Chin-Up",
  "Remada Pendlay": "Bent_Over_Barbell_Row",
  "Remada com kettlebell": "One-Arm_Kettlebell_Row",
  "Puxada articulada": "Wide-Grip_Lat_Pulldown",
  "Puxada convergente": "V-Bar_Pulldown",
  "Puxada unilateral": "One_Arm_Lat_Pulldown",
  "Remada articulada": "Leverage_Iso_Row",
  "Remada unilateral": "One-Arm_Dumbbell_Row",
  "Remada cavalinho máquina": "T-Bar_Row_with_Handle",
  "Remada Hammer": "Leverage_Iso_Row",
  "High Row": "Leverage_High_Row",
  "Low Row": "Seated_Cable_Rows",
  "Máquina de dorsal": "Leverage_High_Row",
  "Puxada neutra": "V-Bar_Pulldown",
  "Pullover no cabo": "Straight-Arm_Pulldown",
  "Remada ajoelhada": "Kneeling_High_Pulley_Row",
  "Lat Pulldown unilateral": "One_Arm_Lat_Pulldown",

  /* Trapézio */
  "Encolhimento com kettlebell": "Dumbbell_Shrug",
  "High Pull": "Kettlebell_Sumo_High_Pull",
  "Encolhimento no cabo": "Cable_Shrugs",
  "Encolhimento máquina": "Leverage_Shrug",
  "Remada alta no cabo": "Upright_Cable_Row",

  /* Ombros */
  "Desenvolvimento no Smith": "Smith_Machine_Overhead_Shoulder_Press",
  "Desenvolvimento unilateral": "Dumbbell_One-Arm_Shoulder_Press",
  "Desenvolvimento sentado": "Seated_Dumbbell_Press",
  "Desenvolvimento em pé": "Standing_Dumbbell_Press",
  "Elevação frontal com barra": "Standing_Front_Barbell_Raise_Over_Head",
  "Elevação frontal no cabo": "Front_Cable_Raise",
  "Elevação frontal unilateral": "Single_Dumbbell_Raise",
  "Elevação lateral unilateral": "One-Arm_Side_Laterals",
  "Elevação lateral no cabo": "Standing_Low-Pulley_Deltoid_Raise",
  "Elevação lateral unilateral no cabo": "Standing_Low-Pulley_Deltoid_Raise",
  "Elevação lateral na máquina": "Side_Lateral_Raise",
  "Elevação lateral inclinada": "One-Arm_Incline_Lateral_Raise",
  "Elevação lateral sentado": "Seated_Side_Lateral_Raise",
  "Elevação lateral no banco": "Lying_One-Arm_Lateral_Raise",
  "Lean-Away Lateral Raise": "One-Arm_Side_Laterals",
  "Crucifixo inverso no cabo": "Cable_Rear_Delt_Fly",
  "Crucifixo inverso unilateral": "Cable_Rear_Delt_Fly",
  "Remada alta aberta": "Cable_Rope_Rear-Delt_Rows",
  "Remada para deltoide posterior": "Barbell_Rear_Delt_Row",
  "Rear Delt Row": "Barbell_Rear_Delt_Row",

  /* Bíceps */
  "Rosca martelo cruzada": "Cross_Body_Hammer_Curl",
  "Rosca 21": "Barbell_Curl",
  "Rosca drag": "Drag_Curl",
  "Rosca unilateral": "Standing_One-Arm_Cable_Curl",
  "Rosca bayesiana": "Standing_One-Arm_Cable_Curl",
  "Bayesian Curl": "Standing_One-Arm_Cable_Curl",
  "Rosca Scott máquina": "Machine_Preacher_Curls",
  "Rosca máquina": "Machine_Bicep_Curl",
  "Rosca unilateral máquina": "Machine_Bicep_Curl",
  "Máquina de bíceps": "Machine_Bicep_Curl",
  "Rosca unilateral no cabo": "Standing_One-Arm_Cable_Curl",
  "Rosca martelo no cabo": "Cable_Hammer_Curls_-_Rope_Attachment",
  "Rosca inversa no cabo": "Reverse_Cable_Curl",
  "Rosca baixa": "Standing_Biceps_Cable_Curl",
  "Rosca alta": "High_Cable_Curls",
  "Rosca concentrada no cabo": "Concentration_Curls",

  /* Tríceps */
  "Tríceps testa com halteres": "Lying_Dumbbell_Tricep_Extension",
  "Tríceps francês unilateral": "Dumbbell_One-Arm_Triceps_Extension",
  "Tríceps acima da cabeça": "Cable_Rope_Overhead_Triceps_Extension",
  "Tate Press": "Tate_Press",
  "JM Press": "JM_Press",
  "Tríceps máquina": "Machine_Triceps_Extension",
  "Tríceps mergulho máquina": "Dip_Machine",
  "Tríceps articulado": "Machine_Triceps_Extension",
  "Tríceps unilateral": "Cable_One_Arm_Tricep_Extension",
  "Tríceps inverso": "Reverse_Grip_Triceps_Pushdown",
  "Tríceps cross-body": "Cable_One_Arm_Tricep_Extension",
  "Tríceps coice no cabo": "Tricep_Dumbbell_Kickback",

  /* Antebraço */
  "Rosca de punho": "Palms-Up_Barbell_Wrist_Curl_Over_A_Bench",
  "Rosca de punho reversa": "Palms-Down_Wrist_Curl_Over_A_Bench",
  "Rosca inversa": "Reverse_Barbell_Curl",
  "Pinch Grip": "Plate_Pinch",
  "Wrist Roller": "Wrist_Roller",
  "Flexão de dedos": "Finger_Curls",
  "Pronação de punho": "Dumbbell_Lying_Pronation",
  "Supinação de punho": "Dumbbell_Lying_Supination",
  "Pegada estática": "One_Handed_Hang",

  /* Abdômen / lombar */
  "Abdominal canivete": "Jackknife_Sit-Up",
  "V-Up": "Jackknife_Sit-Up",
  "Elevação de joelhos": "Knee_Hip_Raise_On_Parallel_Bars",
  "Crunch máquina": "Ab_Crunch_Machine",
  "Elevação de pernas na máquina": "Knee_Hip_Raise_On_Parallel_Bars",
  "Abdominal na máquina": "Ab_Crunch_Machine",
  "Woodchopper no cabo": "Standing_Cable_Wood_Chop",
  "RKC Plank": "Plank",
  "Hiperextensão unilateral": "Hyperextensions_Back_Extensions",
  "Extensão lombar na máquina": "Hyperextensions_Back_Extensions",
  "Reverse Hyperextension": "Reverse_Hyperextension",

  /* Kettlebell */
  "Russian Swing": "One-Arm_Kettlebell_Swings",
  "American Swing": "One-Arm_Kettlebell_Swings",
  "Front Squat": "Front_Squats_With_Two_Kettlebells",
  "Clean": "Two-Arm_Kettlebell_Clean",
  "Clean & Press": "Two-Arm_Kettlebell_Clean",
  "Snatch": "One-Arm_Kettlebell_Snatch",
  "Turkish Get-Up": "Kettlebell_Turkish_Get-Up_Squat_style",
  "Windmill": "Kettlebell_Windmill",
  "Farmer Walk": "Farmers_Walk",
  "Suitcase Carry": "Farmers_Walk",
  "Front Rack Carry": "Farmers_Walk",
  "Kettlebell Row": "One-Arm_Kettlebell_Row",
  "Kettlebell Lunges": "Dumbbell_Lunges",
  "Kettlebell Thruster": "Kettlebell_Thruster",
  "Kettlebell Press": "Two-Arm_Kettlebell_Military_Press",
  "Kettlebell High Pull": "Kettlebell_Sumo_High_Pull",

  /* Peso corporal */
  "Flexão inclinada": "Incline_Push-Up",
  "Flexão declinada": "Decline_Push-Up",
  "Flexão diamante": "Push-Ups_-_Close_Triceps_Position",
  "Flexão unilateral": "Single-Arm_Push-Up",
  "Flexão explosiva": "Plyo_Push-up",
  "Australian Pull-up": "Inverted_Row",
  "Bulgarian Split Squat": "Split_Squat_with_Dumbbells",
  "Handstand Push-up": "Handstand_Push-Ups",
  "Muscle-up": "Muscle_Up",
  "Agachamento": "Bodyweight_Squat",
  "Afundo": "Bodyweight_Walking_Lunge"
};

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/* Índice por nome normalizado (sem acento/caixa): "supino  RETO com barra" também acha. */
const INDEX = new Map(Object.entries(EXERCISE_IMAGE_MAP).map(([name, id]) => [norm(name), id]));

/* Exercícios PRÓPRIOS (nome que não está na biblioteca): em vez de ficar sem foto, tenta a
   "família" do exercício pela primeira palavra do nome. É um palpite — mostra um exercício
   parecido, não necessariamente o mesmo. Nomes da biblioteca nunca passam por aqui. */
const LIBRARY_NAMES = new Set(Object.values(EXERCISE_LIBRARY).flat().map(norm));
const GUESS_RULES = [
  [/^supino inclinado/, "Incline_Dumbbell_Press"],
  [/^supino declinado/, "Decline_Barbell_Bench_Press"],
  [/^supino.*halter/, "Dumbbell_Bench_Press"],
  [/^supino/, "Barbell_Bench_Press_-_Medium_Grip"],
  [/^crucifixo inverso/, "Reverse_Flyes"],
  [/^crucifixo/, "Dumbbell_Flyes"],
  [/^flexao/, "Pushups"],
  [/^barra fixa/, "Pullups"],
  [/^puxada/, "Wide-Grip_Lat_Pulldown"],
  [/^remada.*(halter|serrote|unilateral)/, "One-Arm_Dumbbell_Row"],
  [/^remada/, "Bent_Over_Barbell_Row"],
  [/^(levantamento )?terra/, "Barbell_Deadlift"],
  [/^stiff/, "Stiff-Legged_Barbell_Deadlift"],
  [/^agachamento/, "Barbell_Squat"],
  [/^afundo/, "Dumbbell_Lunges"],
  [/^leg press/, "Leg_Press"],
  [/^hip thrust/, "Barbell_Hip_Thrust"],
  [/^panturrilha/, "Standing_Calf_Raises"],
  [/^desenvolvimento/, "Dumbbell_Shoulder_Press"],
  [/^elevacao lateral/, "Side_Lateral_Raise"],
  [/^elevacao frontal/, "Front_Dumbbell_Raise"],
  [/^encolhimento/, "Dumbbell_Shrug"],
  [/^rosca martelo/, "Hammer_Curls"],
  [/^rosca scott/, "Preacher_Curl"],
  [/^rosca.*(halter)/, "Dumbbell_Bicep_Curl"],
  [/^rosca/, "Barbell_Curl"],
  [/^triceps/, "Triceps_Pushdown"],
  [/^abdominal/, "Crunches"],
  [/^prancha/, "Plank"]
];

export function exerciseImageId(name) {
  const n = norm(name);
  if (!n) return null;
  const exact = INDEX.get(n);
  if (exact) return exact;
  if (LIBRARY_NAMES.has(n)) return null;
  const hit = GUESS_RULES.find(([re]) => re.test(n));
  return hit ? hit[1] : null;
}

/* ids cujas imagens não carregaram em nenhuma fonte: vão direto ao ícone nos próximos renders. */
const FAILED = new Set();
export const markImageFailed = (id) => FAILED.add(id);
export const imageFailed = (id) => FAILED.has(id);
export const resetFailedImages = () => FAILED.clear();

/* frame: 0 = início, 1 = fim; source: índice em EXERCISE_IMAGE_SOURCES */
export function exerciseImageUrl(id, frame = 0, source = 0) {
  const base = EXERCISE_IMAGE_SOURCES[source];
  return base ? `${base}${encodeURIComponent(id)}/${frame}.jpg` : null;
}
