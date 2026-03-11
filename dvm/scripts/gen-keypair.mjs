#!/usr/bin/env node
import { getPublicKey, utils } from 'nostr-tools';
import { randomBytes } from 'node:crypto';

const privHex = randomBytes(32).toString('hex');
const pub = getPublicKey(utils.hexToBytes(privHex));

console.log('DVM_SECRET_KEY=' + privHex);
console.log('VITE_DVM_PUBKEY=' + pub);
