import axios from 'axios';
import AWSMock from 'aws-sdk-mock';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler, getPaymentToken, deletePaymentToken, processPayment } from '../src/on_completed';
import { v4 as uuidv4 } from 'uuid';

const mockContext = {} as Context;
const API_URL = 'mock://API_URL';
const ENVIRONMENT = 'test';
const TABLE_NAME = 'TABLE_NAME';

beforeAll(() => {
  process.env.API_URL = API_URL;
  process.env.ENVIRONMENT = ENVIRONMENT;
  process.env.TABLE_NAME = TABLE_NAME;
  AWSMock.setSDKInstance(require('aws-sdk'));
});

afterAll(() => {
  AWSMock.restore();
});

describe('on_completed tests', () => {
  let orderId: string;
  let paymentToken: string;

  beforeEach(() => {
    orderId = uuidv4();
    paymentToken = uuidv4();
  });

  it('should get payment token', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {
        Item: {
          orderId: params.Key.orderId,
          paymentToken: paymentToken
        }
      });
    });

    const response = await getPaymentToken(orderId);
    expect(response).toBe(paymentToken);

    AWSMock.restore('DynamoDB.DocumentClient');
  });

  it('should delete payment token', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      callback(null, {});
    });

    await deletePaymentToken(orderId);

    AWSMock.restore('DynamoDB.DocumentClient');
  });

  it('should process payment', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } });

    await processPayment(paymentToken);

    expect(axios.post).toHaveBeenCalledWith(`${API_URL}/processPayment`, {
      paymentToken
    });

    jest.restoreAllMocks();
  });

  it('should fail processing payment', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ data: { message: 'ERROR_MESSAGE' } });

    await expect(processPayment(paymentToken)).rejects.toThrow('Failed to process payment: ERROR_MESSAGE');

    expect(axios.post).toHaveBeenCalledWith(`${API_URL}/processPayment`, {
      paymentToken
    });

    jest.restoreAllMocks();
  });

  it('should handle event', async () => {
    const event = {
      detail: {
        orderId: orderId,
        total: 2345
      }
    };

    jest.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } });

    AWSMock.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
      callback(null, {
        Item: {
          orderId: params.Key.orderId,
          paymentToken: paymentToken
        }
      });
    });

    AWSMock.mock('DynamoDB.DocumentClient', 'delete', (params, callback) => {
      callback(null, {});
    });

    await handler(event as any, mockContext);

    expect(axios.post).toHaveBeenCalledWith(`${API_URL}/processPayment`, {
      paymentToken
    });

    AWSMock.restore('DynamoDB.DocumentClient');
    jest.restoreAllMocks();
  });
});