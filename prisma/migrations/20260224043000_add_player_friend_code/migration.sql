ALTER TABLE "Player"
ADD COLUMN "friendCode" TEXT;

CREATE UNIQUE INDEX "Player_friendCode_key" ON "Player"("friendCode");
