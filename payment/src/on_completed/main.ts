/**
 * OnCompleted Function
 */

import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import { Tracer, captureLambdaHandler, captureMethod } from "@aws-lambda-powertools/tracer";
import { Metrics, logMetrics, MetricUnits } from "@aws-lambda-powertools/metrics";
import axios from "axios";

const API_URL = process.env.API_URL!;
const ENVIRONMENT = process.env.ENVIRONMENT!;
const TABLE_NAME = process.env.TABLE_NAME!;

const dynamodb = new DynamoDBClient({});
const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics({ namespace: "ecommerce.payment" });

interface EventDetail {
  orderId: string;
}

interface Event {
  detail: EventDetail;
}

@captureMethod(tracer)
const getPaymentToken = async (orderId: string): Promise<string> => {
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      orderId: { S: orderId },
    },
  });

  const response = await dynamodb.send(command);
  return response.Item?.paymentToken.S || "";
};

@captureMethod(tracer)
const deletePaymentToken = async (orderId: string): Promise<void> => {
  const command = new DeleteItemCommand({
    TableName: TABLE_NAME,
    Key: {
      orderId: { S: orderId },
    },
  });

  await dynamodb.send(command);
};

@captureMethod(tracer)
const processPayment = async (paymentToken: string): Promise<void> => {
  const response = await axios.post(`${API_URL}/processPayment`, {
    paymentToken,
  });

  if (!response.data.ok) {
    throw new Error(`Failed to process payment: ${response.data.message || "No error message"}`);
  }
};

@logMetrics(metrics, { raiseOnEmptyMetrics: false })
@injectLambdaContext(logger)
@captureLambdaHandler(tracer)
export const handler = async (event: Event): Promise<void> => {
  const { orderId } = event.detail;

  logger.info({
    message: `Received completed order ${orderId}`,
    orderId,
  });

  logger.debug({
    message: `Received completed order ${orderId}`,
    event,
  });

  const paymentToken = await getPaymentToken(orderId);
  await processPayment(paymentToken);
  await deletePaymentToken(orderId);

  // Add custom metrics
  metrics.addDimension("environment", ENVIRONMENT);
  metrics.addMetric("paymentProcessed", MetricUnits.Count, 1);
};