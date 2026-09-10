import Fastify from "fastify";
import cors from "@fastify/cors";

import {
  generateAccessionNumber,
  processOrder
} from "./processor.js";

import {
  saveOrder,
  getOrder,
  getAllOrders
} from "./store.js";

import {
  buildDiagnosticReport,
  buildObservation
} from "./fhir.js";

import type {
  MolisOrder
} from "./types.js";

import {
  hl7ToMolisOrder
} from "./hl7v2.js";

import {
  resultToHL7V2
} from "./result-to-hl7v2.js";


const app =
  Fastify({
    logger: true
  });


await app.register(cors, {
  origin: true
});


// ==================================================
// HEALTH
// ==================================================

app.get("/health", async () => {

  return {

    status:
      "UP",

    service:
      "fake-molis"

  };
});


// ==================================================
// CREATE ORDER
// ==================================================

app.post<{
  Body: any;
}>(
  "/molis/orders",
  async (
    request,
    reply
  ) => {

    const bundle =
      request.body as any;


    // ----------------------------------------------
    // Basic validation
    // ----------------------------------------------

    if (
      !bundle ||
      bundle.resourceType !== "Bundle"
    ) {

      return reply
        .code(400)
        .send({

          status:
            "INVALID_FHIR",

          message:
            "Expected FHIR Bundle"

        });
    }


    if (
      bundle.type !== "message"
    ) {

      return reply
        .code(400)
        .send({

          status:
            "INVALID_BUNDLE",

          message:
            "Expected message Bundle"

        });
    }


    // ----------------------------------------------
    // Find resources
    // ----------------------------------------------

    const entries =
      bundle.entry ?? [];


    const patient =
      entries.find(
        (entry: any) =>
          entry.resource?.resourceType ===
          "Patient"
      )?.resource;


    const practitioner =
      entries.find(
        (entry: any) =>
          entry.resource?.resourceType ===
          "Practitioner"
      )?.resource;


    const organizations =
      entries
        .map(
          (entry: any) =>
            entry.resource
        )
        .filter(
          (resource: any) =>
            resource?.resourceType ===
            "Organization"
        );


    const serviceRequest =
      entries.find(
        (entry: any) =>
          entry.resource?.resourceType ===
          "ServiceRequest"
      )?.resource;


    const specimen =
      entries.find(
        (entry: any) =>
          entry.resource?.resourceType ===
          "Specimen"
      )?.resource;


    if (
      !patient ||
      !serviceRequest ||
      !specimen
    ) {

      return reply
        .code(422)
        .send({

          status:
            "INCOMPLETE_REQUEST",

          message:
            "Patient, ServiceRequest and Specimen are required"

        });
    }


    // ----------------------------------------------
    // Generate accession
    // ----------------------------------------------

    const accessionNumber =
      generateAccessionNumber();


    // ----------------------------------------------
    // Extract patient
    // ----------------------------------------------

    const nhsIdentifier =
      patient.identifier?.find(
        (identifier: any) =>
          identifier.system ===
          "https://fhir.nhs.uk/Id/nhs-number"
      );


    // ----------------------------------------------
    // Extract requester
    // ----------------------------------------------

    const practitionerName =
      practitioner?.name?.[0]?.text
      ??
      "Unknown practitioner";


    const requesterOrganisation =
      organizations.find(
        (org: any) =>
          org.identifier?.some(
            (identifier: any) =>
              identifier.value ===
              serviceRequest.performer?.[0]?.reference
          )
      );


    // ----------------------------------------------
    // Build MOLIS order
    // ----------------------------------------------

    const order: MolisOrder = {

      accessionNumber,

      requestId:
        serviceRequest.identifier?.[0]?.value
        ??
        `FHIR-${serviceRequest.id}`,

      status:
        "RECEIVED",

      receivedAt:
        new Date().toISOString(),


      patient: {

        nhsNumber:
          nhsIdentifier?.value
          ??
          "",

        firstName:
          patient.name?.[0]?.given?.[0]
          ??
          "",

        lastName:
          patient.name?.[0]?.family
          ??
          "",

        dateOfBirth:
          patient.birthDate
          ??
          ""
      },


      requester: {

        practitionerId:
          practitioner?.identifier?.[0]?.value
          ??
          "",

        name:
          practitionerName,

        organisationCode:
          requesterOrganisation
            ?.identifier?.[0]?.value
          ??
          ""
      },


      laboratory: {

        organisationCode:
          "LAB001",

        name:
          "Fake MOLIS Pathology Laboratory"
      },


      test: {

        code:
          serviceRequest.code
            ?.coding?.[0]?.code
          ??
          "",

        display:
          serviceRequest.code
            ?.coding?.[0]?.display
          ??
          ""
      },


      specimen: {

        id:
          specimen.id,

        type:
          specimen.type
            ?.coding?.[0]?.display
          ??
          ""
      }

    };


    saveOrder(order);


    // ----------------------------------------------
    // Return acknowledgement
    // ----------------------------------------------

    return reply
      .code(201)
      .send({

        status:
          "ORDER_RECEIVED",

        accessionNumber,

        order
      });
  }
);


// ==================================================
// CREATE ORDER FROM HL7 v2
// ==================================================

app.post<{
  Body: string | { message?: string };
}>(
  "/molis/orders/hl7v2",
  async (
    request,
    reply
  ) => {
    try {
      const body = request.body;
      const message =
        typeof body === "string"
          ? body
          : body?.message;

      if (!message) {
        return reply
          .code(400)
          .send({
            status: "INVALID_HL7V2",
            message: "HL7 v2 message is required"
          });
      }

      const input = hl7ToMolisOrder(message);
      const accessionNumber = generateAccessionNumber();

      const order: MolisOrder = {
        accessionNumber,
        requestId: input.requestId,
        status: "RECEIVED",
        receivedAt: new Date().toISOString(),
        patient: input.patient,
        requester: input.requester,
        laboratory: input.laboratory,
        test: input.test,
        specimen: input.specimen
      };

      saveOrder(order);

      return reply
        .code(201)
        .send({
          status: "ORDER_RECEIVED",
          protocol: "HL7_V2",
          accessionNumber,
          order
        });
    } catch (error: any) {
      request.log.error(error);

      return reply
        .code(422)
        .send({
          status: "HL7V2_ORDER_ERROR",
          message:
            error?.message ||
            "Unable to process HL7 v2 order"
        });
    }
  }
);

app.get<{
  Params: {
    accessionNumber: string;
  };
}>(
  "/molis/orders/:accessionNumber/hl7v2",
  async (
    request,
    reply
  ) => {

    try {
    const accessionNumber = request.params.accessionNumber;
    const order =
      getOrder(accessionNumber);

    if (!order) {

      return reply
        .code(404)
        .send({
          status: "ORDER_NOT_FOUND",
          accessionNumber
        });

    }

    if (
      order.status !==
      "RESULT_AVAILABLE"
    ) {

      return reply
        .code(409)
        .send({
          status: "RESULT_NOT_AVAILABLE",
          accessionNumber,
          orderStatus: order.status
        });

    }

    const message =
      resultToHL7V2(order);

    return reply
      .type("text/plain")
      .code(200)
      .send(message);

    } catch (error: any) {

      request.log.error(error);

      return reply
        .code(422)
        .send({
          status: "HL7V2_RESULT_ERROR",
          message:
            error?.message ||
            "Unable to generate HL7 v2 result"
        });

    }
  }
);


// ==================================================
// LIST ORDERS
// ==================================================

app.get(
  "/molis/orders",
  async () => {

    return {

      count:
        getAllOrders().length,

      orders:
        getAllOrders()

    };
  }
);


// ==================================================
// GET ORDER
// ==================================================

app.get<{
  Params: {
    accessionNumber: string;
  };
}>(
  "/molis/orders/:accessionNumber",
  async (
    request,
    reply
  ) => {

    const order =
      getOrder(
        request.params.accessionNumber
      );


    if (!order) {

      return reply
        .code(404)
        .send({

          status:
            "NOT_FOUND"

        });
    }


    return order;
  }
);


// ==================================================
// PROCESS ORDER
// ==================================================

app.post<{
  Params: {
    accessionNumber: string;
  };
}>(
  "/molis/orders/:accessionNumber/process",
  async (
    request,
    reply
  ) => {

    const order =
      processOrder(
        request.params.accessionNumber
      );


    if (!order) {

      return reply
        .code(404)
        .send({

          status:
            "NOT_FOUND"

        });
    }


    return {

      status:
        order.status,

      accessionNumber:
        order.accessionNumber,

      result:
        order.result

    };
  }
);


// ==================================================
// FHIR RESULT
// ==================================================

app.get<{
  Params: {
    accessionNumber: string;
  };
}>(
  "/molis/orders/:accessionNumber/fhir",
  async (
    request,
    reply
  ) => {

    const order =
      getOrder(
        request.params.accessionNumber
      );


    if (!order) {

      return reply
        .code(404)
        .send({

          status:
            "NOT_FOUND"

        });
    }


    if (
      order.status !==
        "RESULT_AVAILABLE" ||
      !order.result
    ) {

      return reply
        .code(409)
        .send({

          status:
            "RESULT_NOT_AVAILABLE",

          currentStatus:
            order.status

        });
    }


    const diagnosticReport =
      buildDiagnosticReport(
        order
      );


    const observation =
      buildObservation(
        order
      );


    return {

      resourceType:
        "Bundle",

      type:
        "collection",

      entry: [

        {
          fullUrl:
            `urn:uuid:${diagnosticReport.id}`,

          resource:
            diagnosticReport
        },

        {
          fullUrl:
            `urn:uuid:${observation.id}`,

          resource:
            observation
        }

      ]
    };
  }
);


// ==================================================
// START
// ==================================================

try {

  await app.listen({

    port:
      4010,

    host:
      "0.0.0.0"

  });


  console.log(
    "Fake MOLIS running on http://localhost:4010"
  );

} catch (error) {

  app.log.error(error);

  process.exit(1);
}