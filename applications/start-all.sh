#!/bin/bash

echo "======================================"
echo "Starting RLT POC services..."
echo "======================================"

# Stop on errors
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

start_service() {
    SERVICE_NAME=$1
    SERVICE_DIR=$2

    echo ""
    echo "Starting $SERVICE_NAME..."

    cd "$ROOT_DIR/$SERVICE_DIR"

    npm run dev &
    
    echo "$SERVICE_NAME started"
}

start_service "RLT Web" "rlt-web"
start_service "Terminology" "terminology"
start_service "FHIR Adapter" "fhir-adapter"
start_service "Fake MOLIS" "fake-molis"
start_service "Result Adapter" "result-adapter"
start_service "HL7-v2 Adapter" "hl7v2-adapter"
start_service "Orchestrator" "pathology-orchestrator"

echo ""
echo "======================================"
echo "All RLT services started!"
echo "======================================"

wait
