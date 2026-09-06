const hl7 = [
  "MSH|^~\\&|RLT|RLT001|MOLIS|LAB001|20260903070000||OML^O21|RLT-10001|P|2.5",
  "PID|1||9999999999^^^NHS||Smith^John||19750312|M",
  "ORC|NW|RLT-10001",
  "OBR|1|RLT-10001||43396009^Haemoglobin A1c measurement",
  "SPM|1|||122555007^Venous blood specimen"
].join("\r");

const response = await fetch(
  "http://localhost:4010/molis/orders/hl7v2",
  {
    method: "POST",
    headers: {
      "content-type": "text/plain"
    },
    body: hl7
  }
);

const body = await response.json();

console.log("HTTP", response.status);
console.log(JSON.stringify(body, null, 2));

if (response.status !== 201) {
  process.exit(1);
}

if (body.status !== "ORDER_RECEIVED") {
  process.exit(1);
}

if (body.protocol !== "HL7_V2") {
  process.exit(1);
}

if (body.order?.requestId !== "RLT-10001") {
  process.exit(1);
}

if (body.order?.patient?.nhsNumber !== "9999999999") {
  process.exit(1);
}

if (body.order?.test?.code !== "43396009") {
  process.exit(1);
}

if (body.order?.specimen?.type !== "Venous blood specimen") {
  process.exit(1);
}

console.log("HL7 v2 -> Fake MOLIS test PASSED");
