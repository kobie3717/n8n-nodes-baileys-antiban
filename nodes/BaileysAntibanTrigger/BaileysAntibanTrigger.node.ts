import {
  ITriggerFunctions,
  INodeType,
  INodeTypeDescription,
  ITriggerResponse,
} from 'n8n-workflow';
import { getOrCreateSocket, subscribe, attachEventListeners } from '../shared/connection';

export class BaileysAntibanTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Baileys Antiban Trigger',
    name: 'baileysAntibanTrigger',
    icon: 'file:baileys.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["events"].join(", ")}}',
    description: 'Triggers on incoming WhatsApp events (messages, presence, etc.)',
    defaults: {
      name: 'Baileys Antiban Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'baileysAntibanApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        options: [
          {
            name: 'Messages Upsert',
            value: 'messages.upsert',
            description: 'New incoming messages',
          },
          {
            name: 'Connection Update',
            value: 'connection.update',
            description: 'Connection status changes',
          },
          {
            name: 'Presence Update',
            value: 'presence.update',
            description: 'Participant presence changes (online/offline/typing)',
          },
          {
            name: 'Message Receipt Update',
            value: 'message-receipt.update',
            description: 'Message read/delivery receipts',
          },
        ],
        default: ['messages.upsert'],
        required: true,
        description: 'Which events to listen for',
      },
      {
        displayName: 'Filter From Me',
        name: 'filterFromMe',
        type: 'boolean',
        default: true,
        description: 'Whether to filter out messages sent by this bot (fromMe=true)',
      },
      {
        displayName: 'Message Types',
        name: 'messageTypes',
        type: 'multiOptions',
        displayOptions: {
          show: {
            events: ['messages.upsert'],
          },
        },
        options: [
          {
            name: 'Text',
            value: 'text',
          },
          {
            name: 'Image',
            value: 'image',
          },
          {
            name: 'Audio',
            value: 'audio',
          },
          {
            name: 'Video',
            value: 'video',
          },
          {
            name: 'Document',
            value: 'document',
          },
          {
            name: 'Sticker',
            value: 'sticker',
          },
          {
            name: 'All',
            value: 'all',
          },
        ],
        default: ['all'],
        description: 'Which message types to trigger on',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const credentials = await this.getCredentials('baileysAntibanApi');
    const events = this.getNodeParameter('events') as string[];
    const filterFromMe = this.getNodeParameter('filterFromMe') as boolean;
    const messageTypes = this.getNodeParameter('messageTypes', ['all']) as string[];

    // Initialize socket and attach event listeners
    await attachEventListeners(
      {
        sessionPath: credentials.sessionPath as string,
        phoneNumber: credentials.phoneNumber as string,
        usePairingCode: credentials.usePairingCode as boolean,
        printQRInTerminal: credentials.printQRInTerminal as boolean,
      },
      events
    );

    const unsubscribeFns: Array<() => void> = [];

    for (const event of events) {
      const unsubscribe = subscribe(
        {
          sessionPath: credentials.sessionPath as string,
          phoneNumber: credentials.phoneNumber as string,
          usePairingCode: credentials.usePairingCode as boolean,
          printQRInTerminal: credentials.printQRInTerminal as boolean,
        },
        event,
        (data: any) => {
          if (event === 'messages.upsert') {
            const { messages, type } = data;

            for (const msg of messages) {
              // Filter fromMe if enabled
              if (filterFromMe && msg.key.fromMe) {
                continue;
              }

              // Filter message types
              if (!messageTypes.includes('all')) {
                const msgType = Object.keys(msg.message || {})[0];
                if (!messageTypes.includes(msgType)) {
                  continue;
                }
              }

              this.emit([[
                {
                  json: {
                    event: 'messages.upsert',
                    type,
                    message: msg,
                    from: msg.key.remoteJid,
                    messageId: msg.key.id,
                    timestamp: msg.messageTimestamp,
                    text: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
                    messageType: Object.keys(msg.message || {})[0],
                  },
                },
              ]]);
            }
          } else if (event === 'connection.update') {
            this.emit([[
              {
                json: {
                  event: 'connection.update',
                  ...data,
                },
              },
            ]]);
          } else if (event === 'presence.update') {
            this.emit([[
              {
                json: {
                  event: 'presence.update',
                  ...data,
                },
              },
            ]]);
          } else if (event === 'message-receipt.update') {
            this.emit([[
              {
                json: {
                  event: 'message-receipt.update',
                  updates: data,
                },
              },
            ]]);
          }
        }
      );

      unsubscribeFns.push(unsubscribe);
    }

    // Cleanup function
    async function closeFunction() {
      unsubscribeFns.forEach(fn => fn());
    }

    return {
      closeFunction,
    };
  }
}
