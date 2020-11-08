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

function byteArrayFromInt(long: number, length: number) {
  // we want to represent the input as a 8-bytes array
  var byteArray = new Uint8Array(length);
  for (var index = 0; index < byteArray.length; index++) {
    var byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }
  return byteArray;
}

function byteArrayToInt(array: Uint8Array) {
  var value = 0;
  for (var i = array.length - 1; i >= 0; i--) {
    value = value * 256 + array[i];
  }
  return value;
}

const STANDARD_HEADER_LENGTH = 2; // command, restOfMessageLength
const TOPIC_LENGTH = 2; // number of bytes to store the topic
const WITH_TOPIC_HEADER = 2 + 8; // topic length, cursor

export class Message {
  command: MessageCommand;
  topic?: string;
  data: Uint8Array;
  clientId?: string;
  cursor?: number;
  get payload(): string {
    return new TextDecoder('utf-8').decode(this.data);
  }
  private _rawSubscribe() {
    const topicArray = new TextEncoder().encode(this.topic);
    const dataArray = this.data;
    const headerLength = STANDARD_HEADER_LENGTH + WITH_TOPIC_HEADER;
    const topicLength = topicArray.length;
    const packageLength = headerLength + topicLength + dataArray.length;
    const packageBuffer = new Uint8Array(packageLength);
    packageBuffer[0] = this.command;
    packageBuffer[1] = packageLength;
    packageBuffer.set(
      byteArrayFromInt(this.topic!.length, TOPIC_LENGTH),
      STANDARD_HEADER_LENGTH
    );
    packageBuffer.set(
      byteArrayFromInt(this.cursor || 0, 8),
      STANDARD_HEADER_LENGTH + TOPIC_LENGTH
    );
    packageBuffer.set(topicArray, headerLength);
    packageBuffer.set(dataArray, headerLength + topicLength);
    return packageBuffer;
  }
  private _rawConnect() {
    const clientIdArray = new TextEncoder().encode(this.clientId);
    const packageLength = STANDARD_HEADER_LENGTH + clientIdArray.length;
    const packageBuffer = new Uint8Array(packageLength);
    packageBuffer[0] = this.command;
    packageBuffer[1] = packageLength;
    packageBuffer.set(clientIdArray, STANDARD_HEADER_LENGTH);
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
    cursor,
  }: {
    command: MessageCommand;
    topic?: string;
    data?: Uint8Array;
    payload?: string;
    clientId?: string;
    cursor?: number;
  }) {
    this.command = command;
    this.topic = topic;
    this.clientId = clientId;
    this.cursor = cursor;
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
      case MessageCommand.INFORM: {
        const headerSize = 2 + 2 + 8;
        const topicLength = byteArrayToInt(input.slice(2, 4));
        const cursor = byteArrayToInt(input.slice(4, 12));
        const topic = new TextDecoder('utf-8').decode(
          input.slice(headerSize, headerSize + topicLength)
        );
        return new Message({
          command,
          topic,
          cursor,
          data: input.slice(headerSize + topicLength),
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
