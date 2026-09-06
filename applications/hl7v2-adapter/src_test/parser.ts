export interface HL7Segment {
  name: string;
  fields: string[];
}

export function parseHL7Message(message: string): HL7Segment[] {
  const lines = message
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split("\r")
    .filter(Boolean);

  return lines.map((line) => {
    const fields = line.split("|");

    return {
      name: fields[0],
      fields
    };
  });
}

export function getSegment(
  segments: HL7Segment[],
  name: string
): HL7Segment | undefined {
  return segments.find((segment) => segment.name === name);
}

export function getSegments(
  segments: HL7Segment[],
  name: string
): HL7Segment[] {
  return segments.filter((segment) => segment.name === name);
}