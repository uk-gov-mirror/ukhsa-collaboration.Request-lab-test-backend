export interface BarcodeData {
  symbology: "GS1-128";
  payload: string;
  humanReadable: string;
}

export function buildSpecimenBarcode(
  requestId: string,
  specimenId: string
): BarcodeData {
  const rltValue =
    requestId.replace(/[^A-Za-z0-9-]/g, "");

  const specimenValue =
    specimenId.replace(/[^A-Za-z0-9-]/g, "");

  return {
    symbology: "GS1-128",

    payload:
      `(91)${rltValue}(92)${specimenValue}`,

    humanReadable:
      `(91) ${rltValue}  (92) ${specimenValue}`
  };
}