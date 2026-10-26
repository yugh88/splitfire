import { add } from "./math";
import type { User } from "@/types";
import React from "react";
export * from "./util/strings.js";
// import { nope } from "./does-not-exist";

export function greet(user: User): string {
  return `${add(1, 2)} ${user.name} ${String(React)}`;
}
