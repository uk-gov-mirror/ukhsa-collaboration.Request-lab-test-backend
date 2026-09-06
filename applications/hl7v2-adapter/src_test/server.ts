import Fastify from "fastify";

import {
  parseHL7Message
} from "./parser.js";

import {
  hl7ToCanonical
} from "./canonical.js";

import {
  canonicalToFHIR
} from "./fhir.js";

import {
  fhirToHL7
} from "./hl7v2.js";

import {
  canonicalToHL7
} from "./canonical-to-hl7.js";

import { fhirToHl7 } from "./fhir-to-hl7.js";

const app = Fastify({
  logger: true
});

const PORT =
  Number(process.env.PORT) || 4006;

app.get("/health", async () => {
  return {
    status: "UP",
    service: "hl7v2-adapter"
  };
});

app.post(
  "/hl7v2/to-fhir",
  async (request, reply) => {

    try {

      const body =
        request.body as any;

      const message =
        typeof body === "string"
          ? body
          : body?.message;

      if (!message) {
        return reply.code(400).send({
          status: "INVALID_REQUEST",
          message:
            "HL7 v2 message is required"
        });
      }

      const segments =
        parseHL7Message(message);

      const canonical =
        hl7ToCanonical(segments);

      const fhir =
        canonicalToFHIR(canonical);

      return {
        status: "SUCCESS",
        direction: "HL7V2_TO_FHIR_R4",
        canonical,
        fhir
      };

    } catch (error: any) {

      return reply.code(422).send({
        status: "HL7V2_MAPPING_ERROR",
        message: error.message
      });
    }
  }
);

app.post("/hl7v2/from-fhir", async (request, reply) => {
  try {
    const body = request.body as {
      fhir?: any;
    };

    if (!body?.fhir) {
      return reply.code(400).send({
        status: "INVALID_REQUEST",
        message: "FHIR Bundle is required"
      });
    }

    const message = fhirToHl7(body.fhir);

    return reply.send({
      status: "SUCCESS",
      messageType: "OML^O21",
      message
    });
  } catch (error: any) {
    request.log.error(error);

    return reply.code(422).send({
      status: "FHIR_TO_HL7_ERROR",
      message: error?.message || "Unable to convert FHIR to HL7 v2"
    });
  }
});

app.post(
  "/hl7v2/from-canonical",
  async (request, reply) => {

    try {

      const body =
        request.body as {
          request?: any;
        };

      if (!body?.request) {

        return reply
          .code(400)
          .send({
            status:
              "INVALID_REQUEST",

            message:
              "Canonical lab request is required"
          });
      }

      const message =
        canonicalToHL7(
          body.request
        );

      return reply.send({

        status:
          "SUCCESS",

        direction:
          "CANONICAL_TO_HL7V2",

        messageType:
          "OML^O21",

        message

      });

    } catch (error: any) {

      request.log.error(error);

      return reply
        .code(422)
        .send({

          status:
            "CANONICAL_TO_HL7V2_ERROR",

          message:
            error?.message ||
            "Unable to convert canonical request to HL7 v2"

        });
    }
  }
);

app.listen({
  port: PORT,
  host: "0.0.0.0"
}).then(() => {

  console.log(
    `[HL7V2 ADAPTER] Running on port ${PORT}`
  );

}).catch((error) => {

  app.log.error(error);

  process.exit(1);
});