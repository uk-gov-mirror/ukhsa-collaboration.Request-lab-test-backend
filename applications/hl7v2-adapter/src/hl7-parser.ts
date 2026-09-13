export interface Hl7Segment {
  name: string;
  fields: string[];
}

export interface Hl7Component {
  value?: string;
  text?: string;
  system?: string;
}

export function parseHl7Message(
  message: string
): Hl7Segment[] {
  return message
    .replace(/\r\n/g, "\r")
    .replace(/\n/g, "\r")
    .split("\r")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const fields = line.split("|");

      return {
        name: fields[0],
        fields
      };
    });
}

export function parseCodedElement(
  value?: string
): Hl7Component {
  if (!value) {
    return {};
  }

  const [
    code,
    text,
    system
  ] = value.split("^");

  return {
    value: code || undefined,
    text: text || undefined,
    system: system || undefined
  };
}

export function decodeHl7Text(
  value?: string
): string | undefined {
  if (value == null) {
    return undefined;
  }

  return value
    .replace(/\\\.br\\/gi, "\n")
    .replace(/\\F\\/g, "|")
    .replace(/\\S\\/g, "^")
    .replace(/\\R\\/g, "~")
    .replace(/\\E\\/g, "\\")
    .replace(/\\T\\/g, "&");
}

export interface Hl7Observation {
  setId?: string;

  valueType?: string;

  identifier?: {
    code?: string;
    display?: string;
    system?: string;
  };

  subId?: string;

  rawValue?: string;

  value?: string | number;

  units?: {
    code?: string;
    display?: string;
    system?: string;
  };

  referenceRange?: string;

  interpretation?: string[];

  abnormalFlags?: string[];

  resultStatus?: string;

  observationTime?: string;

  responsibleObserver?: string;
}

function parseObservationValue(
  valueType: string | undefined,
  rawValue: string | undefined
): string | number | undefined {
  if (rawValue == null || rawValue === "") {
    return undefined;
  }

  switch (valueType) {
    case "NM": {
      const number =
        Number(rawValue);

      return Number.isNaN(number)
        ? rawValue
        : number;
    }

    case "FT":
    case "TX":
    case "ST":
      return decodeHl7Text(rawValue);

    default:
      return decodeHl7Text(rawValue);
  }
}

export function parseObx(
  fields: string[]
): Hl7Observation {
  const identifier =
    parseCodedElement(fields[3]);

  const units =
    parseCodedElement(fields[6]);

  const valueType =
    fields[2];

  const rawValue =
    fields[5];

  return {
    setId:
      fields[1] || undefined,

    valueType,

    identifier: {
      code:
        identifier.value,

      display:
        identifier.text,

      system:
        identifier.system
    },

    subId:
      fields[4] || undefined,

    rawValue,

    value:
      parseObservationValue(
        valueType,
        rawValue
      ),

    units: {
      code:
        units.value,

      display:
        units.text,

      system:
        units.system
    },

    referenceRange:
      fields[7] || undefined,

    abnormalFlags:
      fields[8]
        ? fields[8].split("~")
        : undefined,

    resultStatus:
      fields[11] || undefined,

    observationTime:
      fields[14] || undefined,

    responsibleObserver:
      fields[16] || undefined
  };
}

export interface Hl7OrderResultGroup {
  orc?: {
    orderControl?: string;
    placerOrderNumber?: string;
    fillerOrderNumber?: string;
    placerGroupNumber?: string;
    orderStatus?: string;
  };

  obr?: {
    setId?: string;

    placerOrderNumber?: string;

    fillerOrderNumber?: string;

    test?: {
      code?: string;
      display?: string;
      system?: string;
    };

    observationDateTime?: string;
  };

  observations: Hl7Observation[];
}

export function buildOrderResultGroups(
  segments: Hl7Segment[]
): Hl7OrderResultGroup[] {
  const groups: Hl7OrderResultGroup[] = [];

  let current:
    | Hl7OrderResultGroup
    | undefined;

  for (const segment of segments) {
    switch (segment.name) {
      case "ORC": {
        current = {
          orc: {
            orderControl:
              segment.fields[1] || undefined,

            placerOrderNumber:
              segment.fields[2] || undefined,

            fillerOrderNumber:
              segment.fields[3] || undefined,

            placerGroupNumber:
              segment.fields[4] || undefined,

            orderStatus:
              segment.fields[5] || undefined
          },

          observations: []
        };

        groups.push(current);

        break;
      }

      case "OBR": {
        if (!current) {
          current = {
            observations: []
          };

          groups.push(current);
        }

        const test =
          parseCodedElement(
            segment.fields[4]
          );

        current.obr = {
          setId:
            segment.fields[1] || undefined,

          placerOrderNumber:
            segment.fields[2] || undefined,

          fillerOrderNumber:
            segment.fields[3] || undefined,

          test: {
            code:
              test.value,

            display:
              test.text,

            system:
              test.system
          },

          observationDateTime:
            segment.fields[7] ||
            undefined
        };

        break;
      }

      case "OBX": {
        if (!current) {
          current = {
            observations: []
          };

          groups.push(current);
        }

        current.observations.push(
          parseObx(segment.fields)
        );

        break;
      }
    }
  }

  return groups;
}

export interface Hl7Header {
  sendingApplication?: string;
  sendingFacility?: string;
  receivingApplication?: string;
  receivingFacility?: string;
  messageDateTime?: string;
  messageType?: string;
  triggerEvent?: string;
  controlId?: string;
  processingId?: string;
  version?: string;
  characterSet?: string;
}

function parseMsh(
  fields: string[]
): Hl7Header {
  const [
    messageType,
    triggerEvent
  ] =
    (fields[8] ?? "")
      .split("^");

  return {
    sendingApplication:
      fields[2] || undefined,

    sendingFacility:
      fields[3] || undefined,

    receivingApplication:
      fields[4] || undefined,

    receivingFacility:
      fields[5] || undefined,

    messageDateTime:
      fields[6] || undefined,

    messageType:
      messageType || undefined,

    triggerEvent:
      triggerEvent || undefined,

    controlId:
      fields[9] || undefined,

    processingId:
      fields[10] || undefined,

    version:
      fields[11] || undefined,

    characterSet:
      fields[17] || undefined
  };
}

interface Hl7PatientIdentifier {
  value?: string;
  assigningAuthority?: string;
}

function parsePatientIdentifier(
  value?: string
): Hl7PatientIdentifier {
  const components =
    (value ?? "").split("^");

  return {
    value:
      components[0] || undefined,

    assigningAuthority:
      components[3] || undefined
  };
}