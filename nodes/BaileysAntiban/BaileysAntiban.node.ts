import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';
import { getOrCreateSocket } from '../shared/connection';
import { generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';

export class BaileysAntiban implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Baileys Antiban',
    name: 'baileysAntiban',
    icon: 'file:baileys.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Send WhatsApp messages via Baileys with anti-ban protection',
    defaults: {
      name: 'Baileys Antiban',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'baileysAntibanApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Send Text',
            value: 'sendText',
            description: 'Send a text message',
            action: 'Send a text message',
          },
          {
            name: 'Send Image',
            value: 'sendImage',
            description: 'Send an image with optional caption',
            action: 'Send an image',
          },
          {
            name: 'Send Document',
            value: 'sendDocument',
            description: 'Send a document file',
            action: 'Send a document',
          },
        ],
        default: 'sendText',
      },
      {
        displayName: 'To (JID)',
        name: 'to',
        type: 'string',
        default: '',
        required: true,
        placeholder: '27825651069@s.whatsapp.net',
        description: 'Recipient JID (phone number@s.whatsapp.net or group@g.us)',
      },
      // Send Text parameters
      {
        displayName: 'Text',
        name: 'text',
        type: 'string',
        typeOptions: {
          rows: 4,
        },
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['sendText'],
          },
        },
        description: 'Message text to send',
      },
      // Send Image parameters
      {
        displayName: 'Image URL',
        name: 'imageUrl',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['sendImage'],
          },
        },
        description: 'URL of the image to send (HTTP/HTTPS)',
      },
      {
        displayName: 'Image Binary',
        name: 'imageBinary',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['sendImage'],
          },
        },
        description: 'Binary field name containing image data (use with n8n binary data)',
      },
      {
        displayName: 'Caption',
        name: 'caption',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['sendImage'],
          },
        },
        description: 'Optional caption for the image',
      },
      // Send Document parameters
      {
        displayName: 'Document URL',
        name: 'documentUrl',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['sendDocument'],
          },
        },
        description: 'URL of the document to send',
      },
      {
        displayName: 'Document Binary',
        name: 'documentBinary',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['sendDocument'],
          },
        },
        description: 'Binary field name containing document data',
      },
      {
        displayName: 'Filename',
        name: 'filename',
        type: 'string',
        default: 'document.pdf',
        displayOptions: {
          show: {
            operation: ['sendDocument'],
          },
        },
        description: 'Filename for the document',
      },
      {
        displayName: 'Mimetype',
        name: 'mimetype',
        type: 'string',
        default: 'application/pdf',
        displayOptions: {
          show: {
            operation: ['sendDocument'],
          },
        },
        description: 'MIME type of the document',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('baileysAntibanApi');
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const sock = await getOrCreateSocket({
          sessionPath: credentials.sessionPath as string,
          phoneNumber: credentials.phoneNumber as string,
          usePairingCode: credentials.usePairingCode as boolean,
          printQRInTerminal: credentials.printQRInTerminal as boolean,
        });

        const to = this.getNodeParameter('to', i) as string;

        let result: any;

        if (operation === 'sendText') {
          const text = this.getNodeParameter('text', i) as string;
          result = await sock.sendMessage(to, { text });
        } else if (operation === 'sendImage') {
          const imageUrl = this.getNodeParameter('imageUrl', i, '') as string;
          const imageBinary = this.getNodeParameter('imageBinary', i, '') as string;
          const caption = this.getNodeParameter('caption', i, '') as string;

          let imageBuffer: Buffer;

          if (imageBinary) {
            const binaryData = items[i].binary?.[imageBinary];
            if (!binaryData) {
              throw new NodeOperationError(this.getNode(), `Binary field '${imageBinary}' not found`);
            }
            imageBuffer = Buffer.from(binaryData.data, 'base64');
          } else if (imageUrl) {
            const response = await fetch(imageUrl);
            imageBuffer = Buffer.from(await response.arrayBuffer());
          } else {
            throw new NodeOperationError(this.getNode(), 'Either Image URL or Image Binary must be provided');
          }

          result = await sock.sendMessage(to, {
            image: imageBuffer,
            caption: caption || undefined,
          });
        } else if (operation === 'sendDocument') {
          const documentUrl = this.getNodeParameter('documentUrl', i, '') as string;
          const documentBinary = this.getNodeParameter('documentBinary', i, '') as string;
          const filename = this.getNodeParameter('filename', i) as string;
          const mimetype = this.getNodeParameter('mimetype', i) as string;

          let docBuffer: Buffer;

          if (documentBinary) {
            const binaryData = items[i].binary?.[documentBinary];
            if (!binaryData) {
              throw new NodeOperationError(this.getNode(), `Binary field '${documentBinary}' not found`);
            }
            docBuffer = Buffer.from(binaryData.data, 'base64');
          } else if (documentUrl) {
            const response = await fetch(documentUrl);
            docBuffer = Buffer.from(await response.arrayBuffer());
          } else {
            throw new NodeOperationError(this.getNode(), 'Either Document URL or Document Binary must be provided');
          }

          result = await sock.sendMessage(to, {
            document: docBuffer,
            fileName: filename,
            mimetype,
          });
        }

        returnData.push({
          json: {
            success: true,
            messageId: result?.key?.id,
            timestamp: result?.messageTimestamp,
            to,
            operation,
          },
          pairedItem: i,
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              success: false,
              error: (error as Error).message,
            },
            pairedItem: i,
          });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  }
}
