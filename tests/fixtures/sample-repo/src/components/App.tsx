import { shout } from "../util";
import { VERSION } from "@sample/shared";

export default function App() {
  const lazy = import("../math");
  return <div>{shout(VERSION)}{String(lazy)}</div>;
}
