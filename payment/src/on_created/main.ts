/**
 * OnCreated Function
 */

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { Logger, injectLambdaContext } from "@aws-lambda-powertools/logger";
import { Tracer, captureLambdaHandler, captureMethod } from "@aws-lambda-powertools/tracer";
import { Metrics, logMetrics, MetricUnits } from "@aws-lambda-powertools/metrics";

const ENVIRONMENT = process.env.ENVIRONMENT!;
const TABLE_NAME = process.env.TABLE_NAME!;

const dynamodb = new DynamoDBClient({});
const logger = new Logger();
const tracer = new Tracer();
const metrics = new Metrics({ namespace: "ecommerce.payment" });

interface EventDetail {
  orderId: string;
  paymentToken: string;
}

interface Event {
  detail: EventDetail;
}

@captureMethod(tracer)
const savePaymentToken = async (orderId: string, paymentToken: string): Promise<void> => {
  const command = new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      orderId: { S: orderId },
      paymentToken: { S: paymentToken },
    },
  });

  await dynamodb.send(command);
};

@logMetrics(metrics, { raiseOnEmptyMetrics: false })
@injectLambdaContext(logger)
@captureLambdaHandler(tracer)
export const handler = async (event: Event): Promise<void> => {
  const { orderId, paymentToken } = event.detail;

  logger.info({
    message: `Received new order ${orderId}`,
    orderId,
    paymentToken,
  });

  await savePaymentToken(orderId, paymentToken);

  // Add custom metrics
  metrics.addDimension("environment", ENVIRONMENT);
  metrics.addMetric("paymentCreated", MetricUnits.Count, 1);
};