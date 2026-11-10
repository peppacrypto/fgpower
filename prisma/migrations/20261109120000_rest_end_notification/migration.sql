-- Settings → Durante o treino: a notification at the end of a rest (on by default).
ALTER TABLE "Profile" ADD COLUMN "restEndNotification" BOOLEAN NOT NULL DEFAULT true;
