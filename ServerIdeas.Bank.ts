import { projection } from './src/Projection'
import { handler } from './src/Handler'
import { Message } from './src/Message'

type AccountParams = {
  accountId: string;
};
type AccountTransaction = {
  amount: number;
  id: string;
};
type BalanceProjection = {
  balance: number;
};

const parseMessage: (message: Message) => AccountTransaction = (message) => {
  // TODO: Proper schema validation
  const event = JSON.parse(message.payload)
  if ('amount' in event && typeof event['amount'] === 'number') {
    return event
  }
  throw new Error('Could not validate AccountTransaction')
}

const balanceProjection = projection<
  AccountParams,
  BalanceProjection
>(
  ['/withdrawals', '/deposits'],
  '/balance',
  (message: Message, {}, { balance }) => {
    const { amount } = parseMessage(message)
    return {
      balance: balance + amount,
    };
  },
  {
    balance: 0,
  }
);

const withdrawalHandler = handler<AccountParams>(
  ['/withdrawals/requests'],
  (message: Message, {}, { get, publish }) => {
    const { amount } = parseMessage(message)
    const { balance } = get(balanceProjection);
    if (amount > balance) {
      publish('/withdrawals/rejected', {
        ...event,
        reason: 'Insufficient funds',
      });
    } else {
      publish('/withdrawals', event);
    }
  }
);
