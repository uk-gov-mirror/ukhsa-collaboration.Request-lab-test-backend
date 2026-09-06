export const config = {

  port:
    Number(
      process.env.PORT ??
      4005
    ),

  terminologyUrl:
    process.env.TERMINOLOGY_URL ??
    "http://localhost:4001",

  fhirAdapterUrl:
    process.env.FHIR_ADAPTER_URL ??
    "http://localhost:4002",

  hl7v2AdapterUrl:
    process.env.HL7V2_ADAPTER_URL ??
    "http://localhost:4006",

  molisUrl:
    process.env.MOLIS_URL ??
    "http://localhost:4010",

  resultAdapterUrl:
    process.env.RESULT_ADAPTER_URL ??
    "http://localhost:4003"

};