/**
 * ValidateFunction
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import { Tracer, captureLambdaHandler, captureMethod } from '@aws-lambda-powertools/tracer';
import { Logger, injectLambdaContext } from '@aws-lambda-powertools/logger';
import { iamUserId, response } from 'ecom.apigateway'; // Import your custom modules

const API_URL = process.env.API_URL!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

const logger = new Logger();
const tracer = new Tracer();

interface RequestBody {
  paymentToken: string;
  total: number;
}

@captureMethod(tracer)
const validatePaymentToken = async (paymentToken: string, total: number): Promise<boolean> => {
  try {
    const res = await axios.post(`${API_URL}/check`, {
      paymentToken,
      amount: total,
    });

    const body = res.data;
    if (!('ok' in body)) {
      logger.error({
        message: "Missing 'ok' in 3rd party response body",
        body,
        paymentToken,
      });
    }
    return body.ok || false;
  } catch (error) {
    logger.error({
      message: 'Error validating payment token',
      error: error.message,
      paymentToken,
    });
    return false;
  }
};

@injectLambdaContext(logger)
@captureLambdaHandler(tracer)
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const userId = iamUserId(event);
  if (!userId) {
    logger.warn({ message: 'User ARN not found in event' });
    return response('Unauthorized', 401);
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || '');
  } catch (exc) {
    logger.warn({ message: 'Failed to parse JSON body', error: exc.message });
    return response('Failed to parse JSON body', 400);
  }

  const requiredKeys = ['paymentToken', 'total'] as const;
  for (const key of requiredKeys) {
    if (!(key in body)) {
      logger.warn({
        message: `Missing '${key}' in request body.`,
        body,
      });
      return response(`Missing '${key}' in request body.`, 400);
    }
  }

  const valid = await validatePaymentToken(body.paymentToken, body.total);

  return response({
    ok: valid,
  });
};