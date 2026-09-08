// Fixed taxonomies for the exercise catalog. These are hand-authored (not
// derived from any external dataset) so FGPOWER owns its own vocabulary and
// can present a coherent anatomical/equipment taxonomy in both languages.

export type MuscleGroup =
  | "CHEST"
  | "BACK"
  | "SHOULDERS"
  | "ARMS"
  | "LEGS"
  | "GLUTES"
  | "CORE"
  | "NECK"
  | "FULL_BODY";

export interface MuscleSeed {
  id: string;
  nameEn: string;
  namePt: string;
  group: MuscleGroup;
  sortOrder: number;
  /** free-exercise-db muscle tag(s) that map onto this entry (coarse import). */
  fedbAliases?: string[];
}

export const MUSCLES: MuscleSeed[] = [
  { id: "chest", nameEn: "Chest", namePt: "Peitoral", group: "CHEST", sortOrder: 10, fedbAliases: ["chest"] },
  { id: "lats", nameEn: "Latissimus Dorsi", namePt: "Latíssimo do dorso", group: "BACK", sortOrder: 20, fedbAliases: ["lats"] },
  { id: "traps", nameEn: "Trapezius", namePt: "Trapézio", group: "BACK", sortOrder: 21, fedbAliases: ["traps"] },
  { id: "rhomboids", nameEn: "Rhomboids", namePt: "Romboides", group: "BACK", sortOrder: 22 },
  { id: "middle-back", nameEn: "Middle Back", namePt: "Meio das costas", group: "BACK", sortOrder: 23, fedbAliases: ["middle back"] },
  { id: "spinal-erectors", nameEn: "Spinal Erectors", namePt: "Eretores da espinha", group: "BACK", sortOrder: 24, fedbAliases: ["lower back"] },
  { id: "shoulders", nameEn: "Shoulders", namePt: "Ombros", group: "SHOULDERS", sortOrder: 30, fedbAliases: ["shoulders"] },
  { id: "anterior-deltoid", nameEn: "Anterior Deltoid", namePt: "Deltoide anterior", group: "SHOULDERS", sortOrder: 31 },
  { id: "lateral-deltoid", nameEn: "Lateral Deltoid", namePt: "Deltoide lateral", group: "SHOULDERS", sortOrder: 32 },
  { id: "posterior-deltoid", nameEn: "Posterior Deltoid", namePt: "Deltoide posterior", group: "SHOULDERS", sortOrder: 33 },
  { id: "biceps", nameEn: "Biceps", namePt: "Bíceps", group: "ARMS", sortOrder: 40, fedbAliases: ["biceps"] },
  { id: "triceps", nameEn: "Triceps", namePt: "Tríceps", group: "ARMS", sortOrder: 41, fedbAliases: ["triceps"] },
  { id: "forearms", nameEn: "Forearms", namePt: "Antebraços", group: "ARMS", sortOrder: 42, fedbAliases: ["forearms"] },
  { id: "quadriceps", nameEn: "Quadriceps", namePt: "Quadríceps", group: "LEGS", sortOrder: 50, fedbAliases: ["quadriceps"] },
  { id: "hamstrings", nameEn: "Hamstrings", namePt: "Isquiotibiais", group: "LEGS", sortOrder: 51, fedbAliases: ["hamstrings"] },
  { id: "calves", nameEn: "Calves", namePt: "Panturrilhas", group: "LEGS", sortOrder: 52, fedbAliases: ["calves"] },
  { id: "adductors", nameEn: "Adductors", namePt: "Adutores", group: "LEGS", sortOrder: 53, fedbAliases: ["adductors"] },
  { id: "abductors", nameEn: "Abductors", namePt: "Abdutores", group: "LEGS", sortOrder: 54, fedbAliases: ["abductors"] },
  { id: "glutes", nameEn: "Glutes", namePt: "Glúteos", group: "GLUTES", sortOrder: 60, fedbAliases: ["glutes"] },
  { id: "abdominals", nameEn: "Abdominals", namePt: "Abdômen", group: "CORE", sortOrder: 70, fedbAliases: ["abdominals"] },
  { id: "obliques", nameEn: "Obliques", namePt: "Oblíquos", group: "CORE", sortOrder: 71 },
  { id: "neck", nameEn: "Neck", namePt: "Pescoço", group: "NECK", sortOrder: 80, fedbAliases: ["neck"] },
  { id: "full-body", nameEn: "Full Body", namePt: "Corpo inteiro", group: "FULL_BODY", sortOrder: 90 },
];

export type EquipmentCategory = "FREE_WEIGHT" | "MACHINE" | "CABLE" | "BODYWEIGHT" | "BAND" | "SPECIALTY" | "NONE";

export interface EquipmentSeed {
  id: string;
  nameEn: string;
  namePt: string;
  category: EquipmentCategory;
  sortOrder: number;
  fedbAlias?: string;
}

export const EQUIPMENT: EquipmentSeed[] = [
  { id: "barbell", nameEn: "Barbell", namePt: "Barra reta", category: "FREE_WEIGHT", sortOrder: 10, fedbAlias: "barbell" },
  { id: "dumbbell", nameEn: "Dumbbell", namePt: "Halteres", category: "FREE_WEIGHT", sortOrder: 11, fedbAlias: "dumbbell" },
  { id: "ez-bar", nameEn: "EZ Curl Bar", namePt: "Barra W", category: "FREE_WEIGHT", sortOrder: 12, fedbAlias: "e-z curl bar" },
  { id: "kettlebell", nameEn: "Kettlebell", namePt: "Kettlebell", category: "FREE_WEIGHT", sortOrder: 13, fedbAlias: "kettlebells" },
  { id: "machine", nameEn: "Machine", namePt: "Máquina", category: "MACHINE", sortOrder: 20, fedbAlias: "machine" },
  { id: "smith-machine", nameEn: "Smith Machine", namePt: "Smith", category: "MACHINE", sortOrder: 21 },
  { id: "cable", nameEn: "Cable", namePt: "Cabo (polia)", category: "CABLE", sortOrder: 30, fedbAlias: "cable" },
  { id: "bodyweight", nameEn: "Bodyweight", namePt: "Peso do corpo", category: "BODYWEIGHT", sortOrder: 40, fedbAlias: "body only" },
  { id: "pull-up-bar", nameEn: "Pull-up Bar", namePt: "Barra fixa", category: "BODYWEIGHT", sortOrder: 41 },
  { id: "bench", nameEn: "Bench", namePt: "Banco", category: "SPECIALTY", sortOrder: 50 },
  { id: "resistance-band", nameEn: "Resistance Band", namePt: "Faixa elástica", category: "BAND", sortOrder: 60, fedbAlias: "bands" },
  { id: "medicine-ball", nameEn: "Medicine Ball", namePt: "Bola medicinal", category: "SPECIALTY", sortOrder: 70, fedbAlias: "medicine ball" },
  { id: "exercise-ball", nameEn: "Stability Ball", namePt: "Bola suíça", category: "SPECIALTY", sortOrder: 71, fedbAlias: "exercise ball" },
  { id: "foam-roller", nameEn: "Foam Roller", namePt: "Rolo de espuma", category: "SPECIALTY", sortOrder: 72, fedbAlias: "foam roll" },
  { id: "other-equipment", nameEn: "Other Equipment", namePt: "Outro equipamento", category: "SPECIALTY", sortOrder: 90, fedbAlias: "other" },
  { id: "none", nameEn: "No Equipment", namePt: "Sem equipamento", category: "NONE", sortOrder: 99 },
];

export interface MovementPatternSeed {
  id: string;
  nameEn: string;
  namePt: string;
  descriptionEn?: string;
  descriptionPt?: string;
  sortOrder: number;
}

export const MOVEMENT_PATTERNS: MovementPatternSeed[] = [
  { id: "squat", nameEn: "Squat", namePt: "Agachamento", sortOrder: 10 },
  { id: "hinge", nameEn: "Hip Hinge", namePt: "Dobradiça de quadril", sortOrder: 20 },
  { id: "lunge", nameEn: "Lunge / Split Stance", namePt: "Avanço / Passada", sortOrder: 30 },
  { id: "horizontal-push", nameEn: "Horizontal Push", namePt: "Empurrar horizontal", sortOrder: 40 },
  { id: "vertical-push", nameEn: "Vertical Push", namePt: "Empurrar vertical", sortOrder: 50 },
  { id: "horizontal-pull", nameEn: "Horizontal Pull", namePt: "Puxar horizontal", sortOrder: 60 },
  { id: "vertical-pull", nameEn: "Vertical Pull", namePt: "Puxar vertical", sortOrder: 70 },
  { id: "hip-extension", nameEn: "Hip Extension", namePt: "Extensão de quadril", sortOrder: 80 },
  { id: "knee-extension", nameEn: "Knee Extension", namePt: "Extensão de joelho", sortOrder: 90 },
  { id: "knee-flexion", nameEn: "Knee Flexion", namePt: "Flexão de joelho", sortOrder: 100 },
  { id: "elbow-flexion", nameEn: "Elbow Flexion", namePt: "Flexão de cotovelo", sortOrder: 110 },
  { id: "elbow-extension", nameEn: "Elbow Extension", namePt: "Extensão de cotovelo", sortOrder: 120 },
  { id: "shoulder-abduction", nameEn: "Shoulder Abduction", namePt: "Abdução de ombro", sortOrder: 130 },
  { id: "shoulder-extension", nameEn: "Shoulder Extension / Horizontal Abduction", namePt: "Extensão de ombro / Abdução horizontal", sortOrder: 140 },
  { id: "plantar-flexion", nameEn: "Plantar Flexion", namePt: "Flexão plantar", sortOrder: 150 },
  { id: "trunk-flexion", nameEn: "Trunk Flexion", namePt: "Flexão de tronco", sortOrder: 160 },
  { id: "anti-extension", nameEn: "Anti-Extension", namePt: "Anti-extensão", sortOrder: 170 },
  { id: "anti-rotation", nameEn: "Anti-Rotation", namePt: "Anti-rotação", sortOrder: 180 },
  { id: "rotation", nameEn: "Rotation", namePt: "Rotação", sortOrder: 190 },
  { id: "carry", nameEn: "Loaded Carry", namePt: "Carregada", sortOrder: 200 },
  { id: "olympic", nameEn: "Olympic / Total Body", namePt: "Olímpico / Corpo total", sortOrder: 210 },
];
