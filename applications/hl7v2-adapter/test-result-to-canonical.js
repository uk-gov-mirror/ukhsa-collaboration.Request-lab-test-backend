const message = [
  "MSH|^~\\&|MOLIS|LAB001|RLT|RLT001|20260907031458||ORU^R01|MOLIS-MOLIS-10002|P|2.5",
  "PID|1||9999999999^^^NHS||Smith^John||19750312",
  "ORC|RE|RLT-10001|MOLIS-10002",
  "OBR|1|RLT-10001|MOLIS-10002|43396009^Haemoglobin A1c measurement",
  "OBX|1|NM|999791000000106^Haemoglobin A1c level - IFCC standardised||48|mmol/mol|20-42|H|||F||20260907031458"
].join("\r");

const response =
  await fetch(
    "http://localhost:4006/hl7v2/result-to-canonical",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        message
      })
    }
  );

console.log(
  "HTTP",
  response.status
);

const data =
  await response.json();

console.log(
  JSON.stringify(
    data,
    null,
    2
  )
);

if (
  response.status !== 200 ||
  data.status !== "SUCCESS"
) {
  process.exit(1);
}

const result =
  data.result;

if (result.value !== 48) {
  throw new Error(
    `Expected value 48, got ${result.value}`
  );
}

if (
  result.unit !==
  "mmol/mol"
) {
  throw new Error(
    `Unexpected unit: ${result.unit}`
  );
}

if (
  result.referenceRange?.low !== 20 ||
  result.referenceRange?.high !== 42
) {
  throw new Error(
    "Unexpected reference range"
  );
}

if (
  result.interpretation !==
  "H"
) {
  throw new Error(
    `Unexpected interpretation: ${result.interpretation}`
  );
}

if (
  result.status !==
  "F"
) {
  throw new Error(
    `Unexpected result status: ${result.status}`
  );
}

console.log(
  "HL7 v2 result -> Canonical Result PASSED"
);