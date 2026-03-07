import { getHSM } from './utils';

async function main() {
    const label = process.argv[2];
    const hsmType = (process.argv[3] || 'vault') as 'vault' | 'softhsm';

    if (!label) {
        console.error('Usage: npx ts-node src/delete-key.ts <label> [vault|softhsm]');
        process.exit(1);
    }

    const hsm = getHSM(hsmType);

    try {
        await hsm.initialize();
        console.log(`Deleting key pair with label: ${label} from ${hsmType}...`);

        await hsm.deleteKeyPair(label);

        console.log(`\n✅ Key Deletion Successful: ${label}`);
    } catch (error: any) {
        console.error('❌ Error deleting key:', error.message);
    } finally {
        await hsm.close();
    }
}

main().catch(console.error);
