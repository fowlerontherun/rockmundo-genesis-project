import { Navigate } from "react-router-dom";
import { festivalRoutes } from "@/features/festivals/routes";

/**
 * Legacy /festivals entry point.
 *
 * Keep bookmarks and existing navigation working, but send players into the
 * canonical Festival directory. The old game_events browser used a separate
 * ticket/attendance model and could hide modern company-owned Festivals.
 */
export default function Festivals() {
  return <Navigate replace to={festivalRoutes.publicDirectory()} />;
}
