/**
 * Task ids come from a model-proposed plan and end up in branch names (`splitfire/<id>`), check-run
 * names and prompts. Anything outside this shape is rejected rather than escaped: no slashes, no
 * shell metacharacters, no leading dot or dash, and at most 64 characters.
 *
 * The same source is embedded in the generated gates workflow, so a branch name is only ever used
 * to look an id up in `.splitfire/plan.json`; it is never executed.
 */
export const TASK_ID_SOURCE = "[A-Za-z0-9][A-Za-z0-9._-]{0,63}";

export const TASK_ID_PATTERN = new RegExp(`^${TASK_ID_SOURCE}$`);

export function isSafeTaskId(value: string): boolean {
  return TASK_ID_PATTERN.test(value);
}
