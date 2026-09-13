import {
  useEffect,
  useRef
} from "react";

import bwipjs from "@bwip-js/browser";

interface Gs1BarcodeProps {
  value: string;
}

export default function Gs1Barcode({
  value
}: Gs1BarcodeProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    try {
      bwipjs.toCanvas(
        canvasRef.current,
        {
          bcid: "gs1-128",
          text: value,
          scale: 2,
          height: 12,
          includetext: true,
          textxalign: "center"
        }
      );
    } catch (error) {
      console.error(
        "Unable to generate GS1-128 barcode",
        error
      );
    }
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Specimen GS1-128 barcode"
    />
  );
}