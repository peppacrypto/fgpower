import "server-only";
import { prisma } from "@/lib/db";

export async function listMuscles() {
  return prisma.muscle.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function listEquipment() {
  return prisma.equipment.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function listMovementPatterns() {
  return prisma.movementPattern.findMany({ orderBy: { sortOrder: "asc" } });
}
