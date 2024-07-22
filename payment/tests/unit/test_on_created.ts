import { handler, savePaymentToken } from '../src/on_created';
import AWSMock from 'aws-sdk-mock';
import { Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const mockContext = {} as Context;
const ENVIRONMENT = 'test';
const TABLE_NAME = 'TABLE_NAME';

beforeAll(() => {
  process.env.ENVIRONMENT = ENVIRONMENT;
  process.env.TABLE_NAME = TABLE_NAME;
  AWSMock.setSDKInstance(require('aws-sdk'));
});

afterAll(() => {
  AWSMock.restore();
});

describe('on_created tests', () => {
  let orderId: string;
  let paymentToken: string;

  beforeEach(() => {
    orderId = uuidv4();
    paymentToken = uuidv4();
  });

  it('should save payment token', async () => {
    AWSMock.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
      callback(null, {});
    });

    await savePaymentToken(orderId, paymentToken);

    AWSMock.restore('DynamoDB.DocumentClient');
  });

  it('should handle event', async () => {
    const event = {
      source: 'ecommerce.orders',
      'detail-type': 'OrderCreated',
      resources: [orderId],
      detail: {
        orderId: orderId,
        paymentToken: paymentToken
      }
    };

    const savePaymentTokenMock = jest.fn();
    savePaymentTokenMock.mockResolvedValueOnce(undefined);

    jest.mock('../src/on_created', () => ({
      savePaymentToken: savePaymentTokenMock,
    }));

    await handler(event, mockContext);

    expect(savePaymentTokenMock).toHaveBeenCalledWith(orderId, paymentToken);

    jest.restoreAllMocks();
  });
});