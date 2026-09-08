-- CreateEnum
CREATE TYPE "TrainingGoal" AS ENUM ('HYPERTROPHY', 'STRENGTH', 'GENERAL_FITNESS', 'STRENGTH_HYPERTROPHY', 'SPORTS_PERFORMANCE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EquipmentAccess" AS ENUM ('FULL_GYM', 'HOME_DUMBBELLS', 'HOME_BODYWEIGHT', 'MINIMAL');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PRIVATE', 'FOLLOWERS', 'PUBLIC');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'LEGS', 'GLUTES', 'CORE', 'NECK', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('FREE_WEIGHT', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'BAND', 'SPECIALTY', 'NONE');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('STRENGTH', 'STRETCHING', 'PLYOMETRICS', 'POWERLIFTING', 'OLYMPIC_WEIGHTLIFTING', 'STRONGMAN', 'CARDIO');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ForceType" AS ENUM ('PUSH', 'PULL', 'STATIC', 'OTHER');

-- CreateEnum
CREATE TYPE "Laterality" AS ENUM ('BILATERAL', 'UNILATERAL', 'ALTERNATING');

-- CreateEnum
CREATE TYPE "Mechanics" AS ENUM ('COMPOUND', 'ISOLATION');

-- CreateEnum
CREATE TYPE "MuscleRole" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE_START', 'IMAGE_END', 'ILLUSTRATION', 'VIDEO');

-- CreateEnum
CREATE TYPE "ExerciseRelationKind" AS ENUM ('REGRESSION', 'PROGRESSION', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('GUIDELINE', 'SYSTEMATIC_REVIEW', 'META_ANALYSIS', 'UMBRELLA_REVIEW', 'RCT', 'CONTROLLED_TRIAL', 'CROSSOVER_TRIAL', 'BIOMECHANICAL', 'EMG', 'OBSERVATIONAL', 'EXPERT_CONSENSUS', 'NARRATIVE_REVIEW');

-- CreateEnum
CREATE TYPE "EvidenceLevel" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "TrainingStyle" AS ENUM ('FULL_BODY', 'UPPER_LOWER', 'PUSH_PULL_LEGS', 'BODY_PART_SPLIT', 'HYBRID', 'ENDURANCE_SUPPORT');

-- CreateEnum
CREATE TYPE "ProgressionStrategy" AS ENUM ('DOUBLE', 'LINEAR_LOAD', 'REPETITION', 'RIR_BASED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('WARMUP', 'WORKING', 'DROP', 'FAILURE');

-- CreateEnum
CREATE TYPE "PersonalRecordKind" AS ENUM ('MAX_WEIGHT', 'MAX_REPS_AT_WEIGHT', 'ESTIMATED_1RM', 'SESSION_VOLUME');

-- CreateEnum
CREATE TYPE "BodyMetricKind" AS ENUM ('BODYWEIGHT', 'WAIST', 'CHEST', 'HIPS', 'ARM', 'THIGH', 'CALF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FollowRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('WORKOUT', 'PERSONAL_RECORD', 'MILESTONE', 'PROGRAM_COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FG_RECEIVED', 'NEW_FOLLOWER', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPTED', 'PERSONAL_RECORD', 'PROGRAM_WEEK_COMPLETE', 'PROGRAM_COMPLETED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'FAKE_DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "role" TEXT DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "goal" "TrainingGoal" NOT NULL DEFAULT 'GENERAL_FITNESS',
    "experience" "ExperienceLevel" NOT NULL DEFAULT 'BEGINNER',
    "daysPerWeek" INTEGER NOT NULL DEFAULT 3,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "equipmentAccess" "EquipmentAccess" NOT NULL DEFAULT 'FULL_GYM',
    "preferredDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "doesEndurance" BOOLEAN NOT NULL DEFAULT false,
    "enduranceNotes" TEXT,
    "limitations" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "loadIncrementKg" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "restTimerSound" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompletedAt" TIMESTAMP(3),
    "isPublicAccount" BOOLEAN NOT NULL DEFAULT false,
    "defaultWorkoutVisibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "showLoadsPublicly" BOOLEAN NOT NULL DEFAULT false,
    "showBodyMetricsPublicly" BOOLEAN NOT NULL DEFAULT false,
    "showCurrentProgram" BOOLEAN NOT NULL DEFAULT true,
    "discoverable" BOOLEAN NOT NULL DEFAULT true,
    "autoShareAchievements" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Muscle" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "group" "MuscleGroup" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Muscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementPattern" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "descriptionPt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MovementPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceId" TEXT,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "category" "ExerciseCategory" NOT NULL DEFAULT 'STRENGTH',
    "movementPatternId" TEXT,
    "equipmentId" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "forceType" "ForceType" NOT NULL DEFAULT 'OTHER',
    "laterality" "Laterality" NOT NULL DEFAULT 'BILATERAL',
    "mechanics" "Mechanics" NOT NULL DEFAULT 'COMPOUND',
    "isCurated" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "instructionsEn" JSONB NOT NULL DEFAULT '[]',
    "instructionsPt" JSONB NOT NULL DEFAULT '[]',
    "contentEn" JSONB,
    "contentPt" JSONB,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseAlias" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',

    CONSTRAINT "ExerciseAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseMuscle" (
    "exerciseId" TEXT NOT NULL,
    "muscleId" TEXT NOT NULL,
    "role" "MuscleRole" NOT NULL,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("exerciseId","muscleId")
);

-- CreateTable
CREATE TABLE "ExerciseMedia" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "altEn" TEXT,
    "altPt" TEXT,
    "attribution" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExerciseMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseRelation" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "relatedExerciseId" TEXT NOT NULL,
    "kind" "ExerciseRelationKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExerciseRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteExercise" (
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteExercise_pkey" PRIMARY KEY ("userId","exerciseId")
);

-- CreateTable
CREATE TABLE "ExerciseUserNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseUserNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    "publicationYear" INTEGER NOT NULL,
    "doi" TEXT,
    "pubmedId" TEXT,
    "url" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "evidenceLevel" "EvidenceLevel" NOT NULL,
    "abstractSummary" TEXT NOT NULL,
    "summaryPt" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseEvidence" (
    "exerciseId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "noteEn" TEXT,
    "notePt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExerciseEvidence_pkey" PRIMARY KEY ("exerciseId","sourceId")
);

-- CreateTable
CREATE TABLE "TrainingPrinciple" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titlePt" TEXT NOT NULL,
    "summaryEn" TEXT NOT NULL,
    "summaryPt" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyPt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPrinciple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPrincipleEvidence" (
    "principleId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "noteEn" TEXT,
    "notePt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingPrincipleEvidence_pkey" PRIMARY KEY ("principleId","sourceId")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "taglineEn" TEXT NOT NULL,
    "taglinePt" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionPt" TEXT NOT NULL,
    "audienceEn" TEXT NOT NULL,
    "audiencePt" TEXT NOT NULL,
    "goal" "TrainingGoal" NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "sessionMinutes" INTEGER NOT NULL,
    "equipmentAccess" "EquipmentAccess" NOT NULL,
    "trainingStyle" "TrainingStyle" NOT NULL,
    "progressionStrategy" "ProgressionStrategy" NOT NULL DEFAULT 'DOUBLE',
    "rationaleEn" TEXT NOT NULL,
    "rationalePt" TEXT NOT NULL,
    "weeklyGuidance" JSONB NOT NULL DEFAULT '[]',
    "restGuidanceEn" TEXT,
    "restGuidancePt" TEXT,
    "isFlagship" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateDay" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "namePt" TEXT NOT NULL,
    "focusEn" TEXT,
    "focusPt" TEXT,
    "estimatedMinutes" INTEGER,

    CONSTRAINT "WorkoutTemplateDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateExercise" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "groupKey" TEXT,
    "alternativeSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sets" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "rirTarget" DOUBLE PRECISION,
    "rpeTarget" DOUBLE PRECISION,
    "restSeconds" INTEGER NOT NULL,
    "tempo" TEXT,
    "warmupSets" INTEGER NOT NULL DEFAULT 0,
    "progressionStrategy" "ProgressionStrategy",
    "loadIncrementKg" DOUBLE PRECISION,
    "notesEn" TEXT,
    "notesPt" TEXT,

    CONSTRAINT "WorkoutTemplateExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateEvidence" (
    "templateId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "noteEn" TEXT,
    "notePt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkoutTemplateEvidence_pkey" PRIMARY KEY ("templateId","sourceId")
);

-- CreateTable
CREATE TABLE "WorkoutTemplatePrinciple" (
    "templateId" TEXT NOT NULL,
    "principleId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkoutTemplatePrinciple_pkey" PRIMARY KEY ("templateId","principleId")
);

-- CreateTable
CREATE TABLE "UserProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceTemplateId" TEXT,
    "sourceTemplateVersion" INTEGER,
    "goal" "TrainingGoal",
    "daysPerWeek" INTEGER NOT NULL DEFAULT 3,
    "durationWeeks" INTEGER,
    "progressionStrategy" "ProgressionStrategy" NOT NULL DEFAULT 'DOUBLE',
    "weeklyGuidance" JSONB NOT NULL DEFAULT '[]',
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "UserProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgramDay" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "focus" TEXT,
    "weekday" INTEGER,
    "estimatedMinutes" INTEGER,

    CONSTRAINT "UserProgramDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgramExercise" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "groupKey" TEXT,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "repMin" INTEGER NOT NULL DEFAULT 8,
    "repMax" INTEGER NOT NULL DEFAULT 12,
    "rirTarget" DOUBLE PRECISION,
    "rpeTarget" DOUBLE PRECISION,
    "restSeconds" INTEGER NOT NULL DEFAULT 120,
    "tempo" TEXT,
    "warmupSets" INTEGER NOT NULL DEFAULT 0,
    "loadTargetKg" DOUBLE PRECISION,
    "progressionStrategy" "ProgressionStrategy",
    "loadIncrementKg" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "UserProgramExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "currentWeek" INTEGER NOT NULL DEFAULT 1,
    "nextDayIndex" INTEGER NOT NULL DEFAULT 0,
    "plannedSessions" INTEGER,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "programSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "programId" TEXT,
    "programDayId" TEXT,
    "name" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "programWeek" INTEGER,
    "programDayIndex" INTEGER,
    "notes" TEXT,
    "bodyweightKg" DOUBLE PRECISION,
    "totalVolumeKg" DOUBLE PRECISION,
    "totalWorkingSets" INTEGER,
    "totalReps" INTEGER,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "showDetailedLoads" BOOLEAN NOT NULL DEFAULT false,
    "caption" TEXT,
    "daySnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExerciseLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "programExerciseId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "groupKey" TEXT,
    "prescribedSets" INTEGER NOT NULL,
    "repMin" INTEGER NOT NULL,
    "repMax" INTEGER NOT NULL,
    "rirTarget" DOUBLE PRECISION,
    "rpeTarget" DOUBLE PRECISION,
    "restSeconds" INTEGER NOT NULL,
    "warmupSets" INTEGER NOT NULL DEFAULT 0,
    "tempo" TEXT,
    "notes" TEXT,
    "wasSkipped" BOOLEAN NOT NULL DEFAULT false,
    "substitutedFromExerciseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutExerciseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseLogId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "setType" "SetType" NOT NULL DEFAULT 'WORKING',
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "rir" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "restSeconds" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExercisePersonalRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "kind" "PersonalRecordKind" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "reps" INTEGER,
    "setLogId" TEXT,
    "sessionId" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExercisePersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BodyMetricKind" NOT NULL,
    "customLabel" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable
CREATE TABLE "FollowRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "FollowRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "FollowRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "sessionId" TEXT,
    "caption" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PRIVATE',
    "showDetailedLoads" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB NOT NULL,
    "fgCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFG" (
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityFG_pkey" PRIMARY KEY ("activityId","userId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "NotificationType" NOT NULL,
    "activityId" TEXT,
    "followRequestId" TEXT,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "activityId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_sourceId_key" ON "Exercise"("sourceId");

-- CreateIndex
CREATE INDEX "Exercise_namePt_idx" ON "Exercise"("namePt");

-- CreateIndex
CREATE INDEX "Exercise_nameEn_idx" ON "Exercise"("nameEn");

-- CreateIndex
CREATE INDEX "Exercise_equipmentId_idx" ON "Exercise"("equipmentId");

-- CreateIndex
CREATE INDEX "Exercise_movementPatternId_idx" ON "Exercise"("movementPatternId");

-- CreateIndex
CREATE INDEX "Exercise_isPublished_popularity_idx" ON "Exercise"("isPublished", "popularity");

-- CreateIndex
CREATE INDEX "ExerciseAlias_alias_idx" ON "ExerciseAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseAlias_exerciseId_alias_locale_key" ON "ExerciseAlias"("exerciseId", "alias", "locale");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscleId_role_idx" ON "ExerciseMuscle"("muscleId", "role");

-- CreateIndex
CREATE INDEX "ExerciseMedia_exerciseId_sortOrder_idx" ON "ExerciseMedia"("exerciseId", "sortOrder");

-- CreateIndex
CREATE INDEX "ExerciseRelation_relatedExerciseId_idx" ON "ExerciseRelation"("relatedExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseRelation_exerciseId_relatedExerciseId_kind_key" ON "ExerciseRelation"("exerciseId", "relatedExerciseId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseUserNote_userId_exerciseId_key" ON "ExerciseUserNote"("userId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSource_key_key" ON "EvidenceSource"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSource_doi_key" ON "EvidenceSource"("doi");

-- CreateIndex
CREATE INDEX "EvidenceSource_evidenceLevel_idx" ON "EvidenceSource"("evidenceLevel");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPrinciple_slug_key" ON "TrainingPrinciple"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplate_slug_key" ON "WorkoutTemplate"("slug");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_isPublished_sortOrder_idx" ON "WorkoutTemplate"("isPublished", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplateDay_templateId_dayIndex_key" ON "WorkoutTemplateDay"("templateId", "dayIndex");

-- CreateIndex
CREATE INDEX "WorkoutTemplateExercise_exerciseId_idx" ON "WorkoutTemplateExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplateExercise_dayId_sortOrder_key" ON "WorkoutTemplateExercise"("dayId", "sortOrder");

-- CreateIndex
CREATE INDEX "UserProgram_userId_status_updatedAt_idx" ON "UserProgram"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgramDay_programId_dayIndex_key" ON "UserProgramDay"("programId", "dayIndex");

-- CreateIndex
CREATE INDEX "UserProgramExercise_dayId_sortOrder_idx" ON "UserProgramExercise"("dayId", "sortOrder");

-- CreateIndex
CREATE INDEX "UserProgramExercise_exerciseId_idx" ON "UserProgramExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "ProgramEnrollment_userId_status_idx" ON "ProgramEnrollment"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_idx" ON "WorkoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkoutExerciseLog_sessionId_sortOrder_idx" ON "WorkoutExerciseLog"("sessionId", "sortOrder");

-- CreateIndex
CREATE INDEX "WorkoutExerciseLog_userId_exerciseId_createdAt_idx" ON "WorkoutExerciseLog"("userId", "exerciseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SetLog_exerciseLogId_setNumber_idx" ON "SetLog"("exerciseLogId", "setNumber");

-- CreateIndex
CREATE INDEX "SetLog_userId_exerciseId_completedAt_idx" ON "SetLog"("userId", "exerciseId", "completedAt" DESC);

-- CreateIndex
CREATE INDEX "SetLog_sessionId_idx" ON "SetLog"("sessionId");

-- CreateIndex
CREATE INDEX "ExercisePersonalRecord_userId_exerciseId_kind_achievedAt_idx" ON "ExercisePersonalRecord"("userId", "exerciseId", "kind", "achievedAt" DESC);

-- CreateIndex
CREATE INDEX "ExercisePersonalRecord_userId_achievedAt_idx" ON "ExercisePersonalRecord"("userId", "achievedAt" DESC);

-- CreateIndex
CREATE INDEX "BodyMetric_userId_kind_measuredAt_idx" ON "BodyMetric"("userId", "kind", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "Follow_followingId_createdAt_idx" ON "Follow"("followingId", "createdAt");

-- CreateIndex
CREATE INDEX "FollowRequest_targetId_status_idx" ON "FollowRequest"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FollowRequest_requesterId_targetId_key" ON "FollowRequest"("requesterId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_sessionId_key" ON "Activity"("sessionId");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Activity_visibility_createdAt_idx" ON "Activity"("visibility", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ActivityFG_userId_createdAt_idx" ON "ActivityFG"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

-- CreateIndex
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_movementPatternId_fkey" FOREIGN KEY ("movementPatternId") REFERENCES "MovementPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseAlias" ADD CONSTRAINT "ExerciseAlias_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_muscleId_fkey" FOREIGN KEY ("muscleId") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseMedia" ADD CONSTRAINT "ExerciseMedia_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseRelation" ADD CONSTRAINT "ExerciseRelation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseRelation" ADD CONSTRAINT "ExerciseRelation_relatedExerciseId_fkey" FOREIGN KEY ("relatedExerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteExercise" ADD CONSTRAINT "FavoriteExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteExercise" ADD CONSTRAINT "FavoriteExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseUserNote" ADD CONSTRAINT "ExerciseUserNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseUserNote" ADD CONSTRAINT "ExerciseUserNote_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEvidence" ADD CONSTRAINT "ExerciseEvidence_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseEvidence" ADD CONSTRAINT "ExerciseEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPrincipleEvidence" ADD CONSTRAINT "TrainingPrincipleEvidence_principleId_fkey" FOREIGN KEY ("principleId") REFERENCES "TrainingPrinciple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPrincipleEvidence" ADD CONSTRAINT "TrainingPrincipleEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateDay" ADD CONSTRAINT "WorkoutTemplateDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "WorkoutTemplateDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateEvidence" ADD CONSTRAINT "WorkoutTemplateEvidence_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateEvidence" ADD CONSTRAINT "WorkoutTemplateEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EvidenceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplatePrinciple" ADD CONSTRAINT "WorkoutTemplatePrinciple_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplatePrinciple" ADD CONSTRAINT "WorkoutTemplatePrinciple_principleId_fkey" FOREIGN KEY ("principleId") REFERENCES "TrainingPrinciple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgram" ADD CONSTRAINT "UserProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgram" ADD CONSTRAINT "UserProgram_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgramDay" ADD CONSTRAINT "UserProgramDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "UserProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgramExercise" ADD CONSTRAINT "UserProgramExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "UserProgramDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgramExercise" ADD CONSTRAINT "UserProgramExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramEnrollment" ADD CONSTRAINT "ProgramEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "UserProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "ProgramEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "UserProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "UserProgramDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseLog" ADD CONSTRAINT "WorkoutExerciseLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseLog" ADD CONSTRAINT "WorkoutExerciseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseLog" ADD CONSTRAINT "WorkoutExerciseLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseLog" ADD CONSTRAINT "WorkoutExerciseLog_programExerciseId_fkey" FOREIGN KEY ("programExerciseId") REFERENCES "UserProgramExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExerciseLog" ADD CONSTRAINT "WorkoutExerciseLog_substitutedFromExerciseId_fkey" FOREIGN KEY ("substitutedFromExerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseLogId_fkey" FOREIGN KEY ("exerciseLogId") REFERENCES "WorkoutExerciseLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetLog" ADD CONSTRAINT "SetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePersonalRecord" ADD CONSTRAINT "ExercisePersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePersonalRecord" ADD CONSTRAINT "ExercisePersonalRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePersonalRecord" ADD CONSTRAINT "ExercisePersonalRecord_setLogId_fkey" FOREIGN KEY ("setLogId") REFERENCES "SetLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExercisePersonalRecord" ADD CONSTRAINT "ExercisePersonalRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowRequest" ADD CONSTRAINT "FollowRequest_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFG" ADD CONSTRAINT "ActivityFG_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFG" ADD CONSTRAINT "ActivityFG_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_followRequestId_fkey" FOREIGN KEY ("followRequestId") REFERENCES "FollowRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
