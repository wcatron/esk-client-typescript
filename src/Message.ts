import { TextDecoder, TextEncoder } from './utils';

export enum MessageCommand {
  CONNECT = 1,
  CONNACK = 2,
  PUBLISH = 3,
  SUBSCRIBE = 8,
  SUBACK = 9,
  UNSUBSCRIBE = 10,
  UNSUBACK = 11,
  INFORM = 103,
}

export class Message {
  command: MessageCommand;
  topic?: string;
  data: Uint8Array;
  clientId?: string;
  get payload(): string {
    return new TextDecoder('utf-8').decode(this.data);
  }
  private _rawSubscribe() {
    const topicArray = new TextEncoder().encode(this.topic);
    const dataArray = this.data;
    const packageLength = 2 + topicArray.length + dataArray.length + 1;
    const packageBuffer = new Uint8Array(packageLength);
    packageBuffer[0] = this.command;
    packageBuffer[1] = packageLength;
    packageBuffer[2] = this.topic!.length;
    packageBuffer.set(topicArray, 3);
    packageBuffer.set(dataArray, 3 + topicArray.length);
    return packageBuffer;
  }
  private _rawConnect() {
    const clientIdArray = new TextEncoder().encode(this.clientId);
    const packageLength = 2 + clientIdArray.length;
    const packageBuffer = new Uint8Array(packageLength);
    packageBuffer[0] = this.command;
    packageBuffer[1] = packageLength;
    packageBuffer.set(clientIdArray, 2);
    return packageBuffer;
  }
  get raw(): Uint8Array {
    switch (this.command) {
      case MessageCommand.CONNECT:
        return this._rawConnect();
      case MessageCommand.PUBLISH:
      case MessageCommand.SUBSCRIBE:
      case MessageCommand.UNSUBSCRIBE:
        return this._rawSubscribe();
      default:
        console.info(this);
        throw new Error(
          'Unable to generate message of command type ' + this.command
        );
    }
  }
  constructor({
    command,
    topic,
    data,
    payload,
    clientId,
  }: {
    command: MessageCommand;
    topic?: string;
    data?: Uint8Array;
    payload?: string;
    clientId?: string;
  }) {
    this.command = command;
    this.topic = topic;
    this.clientId = clientId;
    if (data) {
      this.data = data;
    } else if (payload) {
      this.data = new TextEncoder().encode(payload);
    } else {
      this.data = new Uint8Array();
    }
  }
  static fromRaw(input: Uint8Array) {
    const command = input[0];
    switch (command) {
      case MessageCommand.CONNACK: {
        const clientLength = input[1];
        const clientId = new TextDecoder('utf-8').decode(
          input.slice(2, 2 + clientLength)
        );
        return new Message({
          command,
          clientId,
        });
      }
      case MessageCommand.PUBLISH: {
        const topicLength = input[2];
        const topic = new TextDecoder('utf-8').decode(
          input.slice(3, 3 + topicLength)
        );
        return new Message({
          command,
          topic,
          data: input.slice(3 + topicLength),
        });
      }
      case MessageCommand.SUBACK:
      case MessageCommand.UNSUBACK: {
        const topicLength = input[2];
        const topic = new TextDecoder('utf-8').decode(
          input.slice(3, 3 + topicLength)
        );
        return new Message({
          command,
          topic,
        });
      }
      default:
        console.log(command + ': ' + new TextDecoder('utf-8').decode(input));
        throw new Error('Command not setup in Message');
    }
  }
}
