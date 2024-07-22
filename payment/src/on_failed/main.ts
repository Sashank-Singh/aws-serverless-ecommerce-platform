/**
 * OnFailed Function
 */

import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import { Tracer, captureLambdaHandler, captureMethod } from "@aws-lambda-powertools/tracer";
import { Metrics, logMetrics, MetricUnits } from "@aws-lambda-powertools/metrics";

const API_URL = process.env.API_URL!;
const ENVIRONMENT = process.env.ENVIRONMENT!;
const TABLE_NAME = process.env.TABLE_NAME!;

const dynamodb = new DynamoDBClient({});
const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics({ namespace: "ecommerce.payment" });

interface EventDetail {
  orderId: string;
  total: number;
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

  if (!response.Item || !response.Item.paymentToken) {
    throw new Error(`No payment token found for orderId: ${orderId}`);
  }

  return response.Item.paymentToken.S!;
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
const cancelPayment = async (paymentToken: string): Promise<void> => {
  const response = await axios.post(`${API_URL}/cancelPayment`, {
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
  const { orderId, total } = event.detail;

  logger.info({
    message: `Received failed order ${orderId}`,
    orderId,
  });

  const paymentToken = await getPaymentToken(orderId);
  await cancelPayment(paymentToken);
  await deletePaymentToken(orderId);

  // Add custom metrics
  metrics.addDimension("environment", ENVIRONMENT);
  metrics.addMetric("paymentCancelled", MetricUnits.Count, 1);
  metrics.addMetric("amountLost", MetricUnits.Count, total);
};