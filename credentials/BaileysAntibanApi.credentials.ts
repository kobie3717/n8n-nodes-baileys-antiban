import {
  IAuthenticateGeneric,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class BaileysAntibanApi implements ICredentialType {
  name = 'baileysAntibanApi';
  displayName = 'Baileys Antiban API';
  documentationUrl = 'https://github.com/kobie3717/baileys-antiban';
  properties: INodeProperties[] = [
    {
      displayName: 'Session Path',
      name: 'sessionPath',
      type: 'string',
      default: './baileys-session',
      description: 'Directory where WhatsApp authentication state is stored (multi-file auth)',
      required: true,
    },
    {
      displayName: 'Phone Number',
      name: 'phoneNumber',
      type: 'string',
      default: '',
      placeholder: '27825651069',
      description: 'Phone number for pairing code login (without + or spaces)',
    },
    {
      displayName: 'Use Pairing Code',
      name: 'usePairingCode',
      type: 'boolean',
      default: false,
      description: 'Whether to use pairing code instead of QR code for authentication',
    },
    {
      displayName: 'Print QR in Terminal',
      name: 'printQRInTerminal',
      type: 'boolean',
      default: true,
      description: 'Whether to print QR code in terminal for initial setup (fallback if pairing code disabled)',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {},
  };
}
