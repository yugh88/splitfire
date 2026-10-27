/** A problem the user can fix (bad arguments, bad repo, unreadable path). */
export class CliError extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
  }
}
