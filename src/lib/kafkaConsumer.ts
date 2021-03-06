import { KafkaConsumer as Consumer, ConsumerStreamMessage } from 'node-rdkafka';
import { KafkaConsumerInterface } from './kafkaConsumerInterface';

export class KafkaConsumer implements KafkaConsumerInterface {
  private readonly consumer: Consumer;
  private readonly consumeTimeout: number;

  /**
   * @param config Node-rdkafka configuration object. Minimum: `{ "metadata.broker.list": "0.0.0.0:9094", "group.id": "test.group" }`
   * @param timeoutMs Consume timeout in ms
   */
  constructor(config: object, timeoutMs?: number) {
    this.consumeTimeout = timeoutMs ? timeoutMs : 1000;

    const consumerConfig = {
      ...config,
      ...{
        'enable.auto.commit': false,
        'socket.keepalive.enable': true,
      },
    };

    this.consumer = new Consumer(consumerConfig, {
      'auto.offset.reset': 'earliest',
    });
  }

  connect(topics): Promise<object> {
    // Bus is ready and message(s) can be consumed
    this.consumer.on('ready', () => {
      // Get consume timeout from config (or 5 sec)
      this.consumer.setDefaultConsumeTimeout(this.consumeTimeout);
      this.consumer.subscribe(topics);
    });
    // Connect consumer to kafka
    return new Promise((resolve, reject) => {
      this.consumer.connect(
        null,
        (err, metadata) => {
          if (err) {
            return reject(err);
          } else {
            return resolve(metadata);
          }
        },
      );
    });
  }

  disconnect(): Promise<object> {
    return new Promise((resolve, reject) => {
      this.consumer.disconnect((err, metrics) => {
        if (err) {
          // Should not happen
          reject(err);
        } else {
          resolve(metrics);
        }
      });
    });
  }

  subscribe(topics: string[]) {
    this.consumer.unsubscribe();
    this.consumer.subscribe(topics);
  }

  commit(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.consumer.commit();
      this.consumer.committed(undefined, 5000, (err, topicPartitions) => {
        if (err) {
          reject(err);
        } else {
          resolve(topicPartitions);
        }
      });
    });
  }

  commitMessage(msg: ConsumerStreamMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      this.consumer.commitMessage(msg);
      this.consumer.committed(undefined, 5000, (err, topicPartitions) => {
        if (err) {
          reject(err);
        } else {
          resolve(topicPartitions);
        }
      });
    });
  }

  listen(numberOfMessages: number, autoCommit: boolean): Promise<ConsumerStreamMessage[]> {
    return new Promise((resolve, reject) => {
      this.consumer.consume(numberOfMessages, (err, messages) => {
        if (err) {
          reject(err);
        } else {
          if (autoCommit === true) {
            this.commit()
              .then(() => {
                resolve(messages);
              })
              .catch((error) => {
                reject(error);
              });
          } else {
            resolve(messages);
          }
        }
      });
    });
  }
}
