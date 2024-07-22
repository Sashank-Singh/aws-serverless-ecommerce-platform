/**
 * OnModified Function
 */

import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
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
  new: {
    orderId: string;
    total: number;
  };
  old: {
    total: number;
  };
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
const updatePaymentAmount = async (paymentToken: string, amount: number): Promise<void> => {
  const response = await axios.post(`${API_URL}/updateAmount`, {
    paymentToken,
    amount,
  });

  const body = response.data;
  if ("message" in body) {
    throw new Error(`Error updating amount: ${body.message}`);
  }
};

@logMetrics(metrics, { raiseOnEmptyMetrics: false })
@injectLambdaContext(logger)
@captureLambdaHandler(tracer)
export const handler = async (event: Event): Promise<void> => {
  const { orderId, total: newTotal } = event.detail.new;
  const { total: oldTotal } = event.detail.old;

  logger.info({
    message: `Received modification of order ${orderId}`,
    orderId,
    old_amount: oldTotal,
    new_amount: newTotal,
  });

  const paymentToken = await getPaymentToken(orderId);
  await updatePaymentAmount(paymentToken, newTotal);

  // Add custom metrics
  metrics.addDimension("environment", ENVIRONMENT);
  const difference = newTotal - oldTotal;
  const metric = difference < 0 ? "amountLost" : "amountWon";
  metrics.addMetric(metric, MetricUnits.Count, Math.abs(difference));
};