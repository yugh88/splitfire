export type SseMessage = { event: string; data: string };

/** Incremental parser for `event:` / `data:` blocks split across arbitrary network chunks. */
export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer = (buffer + chunk).replace(/\r\n/g, "\n");
    let end = buffer.indexOf("\n\n");
    while (end !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length > 0) onMessage({ event, data: data.join("\n") });
      end = buffer.indexOf("\n\n");
    }
  };
}
