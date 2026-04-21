"use client";
import { useEffect } from "react";
import { updateLastVisit } from "./actions";

export function LastVisitUpdater() {
  useEffect(() => {
    updateLastVisit();
  }, []);
  return null;
}
