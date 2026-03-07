import { VigilHSMVault } from './VigilHSMVault';
import { VigilHSMPKCS11 } from './VigilHSMPKCS11';
import { IVigilHSM } from './IVigilHSM';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Vault credentials from the vault directory if they exist
dotenv.config({ path: path.resolve(__dirname, '../vault/vault_init.env') });

export function getHSM(type: 'vault' | 'softhsm' = 'vault'): IVigilHSM {
    if (type === 'softhsm') {
        if (!process.env.SOFTHSM2_CONF) {
            process.env.SOFTHSM2_CONF = require('path').resolve(__dirname, '../softhsm2.conf');
        }
        const pkcs11Path = process.platform === 'darwin'
            ? '/opt/homebrew/lib/softhsm/libsofthsm2.so'
            : '/usr/lib/softhsm/libsofthsm2.so';
        return new VigilHSMPKCS11({
            libraryPath: pkcs11Path,
            tokenLabel: 'vigil-token',
            pin: '1234'
        });
    }

    return new VigilHSMVault({
        endpoint: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
        token: process.env.VAULT_TOKEN || process.env.ROOT_TOKEN || 'dev-token'
    });
}
