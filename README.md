# VigilHSM

VigilHSM provides a unified TypeScript interface for cryptographic operations (Generate, Sign, Verify) across different Hardware Security Module (HSM) backends. It allows applications to remain infrastructure-agnostic by switching between direct PKCS#11 hardware access and a HashiCorp Vault abstraction.

## Project Architecture

The core of the project is the `IVigilHSM` interface, which defines the standard cryptographic contract.

### 1. HashiCorp Vault Implementation (`src/VigilHSMVault.ts`)
This implementation uses the HashiCorp Vault **Transit Secrets Engine**. Instead of the application handling keys directly, it sends payloads to Vault to be signed or verified.
*   **Benefits**: Centralized key management, automatic rotation, fine-grained access policies, and audit logging.
*   **Cloud Native**: Ideal for environments where Vault is the primary secrets manager.
*   **Abstraction**: Allows swapping the actual hardware behind Vault (Cloud HSM, Physical HSM) without touching the application code.

### 2. PKCS#11 Implementation (`src/VigilHSMPKCS11.ts`)
A low-level implementation that talks directly to any PKCS#11 compliant HSM or library.
*   **Local Testing**: Used with **SoftHSM2** for development without requiring a network-connected Vault.
*   **Performance**: Direct hardware communication without the network overhead of a middleware API.

---

## Getting Started

### 1. Infrastructure Setup
Run the following in the `vault` directory:
```bash
docker compose up -d
./setup-vault.sh
```
This starts a Vault dev instance and enables the `transit` engine.

### 2. Local HSM (SoftHSM2) Setup
Install SoftHSM2 and initialize a test token:
```bash
sudo apt-get install softhsm2
softhsm2-util --init-token --slot 0 --label "vigil-token" --so-pin 1234 --pin 1234
```
*Note: The project uses a local `softhsm2.conf` to avoid permission issues with the system-wide configuration.*

### 3. Run the Demo
```bash
npx ts-node src/demo.ts
```
This script runs a full cryptographic lifecycle (Init -> Gen -> Sign -> Verify -> Delete) on both Vault and SoftHSM2 simultaneously.

---

## CLI Usage

Individual operations can be performed using the provided CLI scripts. Each script accepts a target HSM as its final argument (`vault` or `softhsm`).

### Generate Key Pair
```bash
npx ts-node src/generate-key.ts <label> [vault|softhsm]
```

### Sign Data
Accepts base64 encoded data to sign.
```bash
npx ts-node src/sign.ts <label> <base64-data> [vault|softhsm]
```

### Verify Signature
```bash
npx ts-node src/verify.ts <label> <base64-data> <signature> [vault|softhsm]
```

---

## Common Questions & Troubleshooting (Q&A)

**Q: Why use Vault instead of direct PKCS#11?**
**A**: Vault provides a high-level REST API and handles complexity like key rotation, backup, and enterprise-grade access control. It acts as a "Single Source of Truth" for security, whereas PKCS#11 is a low-level protocol often tied to specific hardware drivers.

**Q: Why does the PKCS#11 implementation use RSA while Vault uses Ed25519?**
**A**: While `IVigilHSM` supports both, the `graphene-pk11` library (used for PKCS#11) has limited native support for EdDSA constants in some environments. RSA provides the most reliable "out-of-the-box" compatibility for local SoftHSM2 testing while still proving the common interface works across different algorithms.

**Q: I get "Signature is INVALID" when verifying Vault signatures manually. Why?**
**A**: Vault Transit signatures are prefixed (e.g., `vault:v1:base64...`). If you copy only the base64 part, the verification will fail because Vault uses that prefix to identify the key version and algorithm used for the signature. Always include the full string.

**Q: How do I handle base64 encoding on the CLI?**
```bash
# Encode
echo -n "My Data" | base64
# Decode
echo "TXkgRGF0YQ==" | base64 --decode
```

**Q: Why is there a `softhsm2.conf` in the project root?**
**A**: By default, SoftHSM2 tries to write to `/var/lib/softhsm/`, which often causes permission denied errors or requires `sudo`. Using a local config file and a `tokens/` directory in the project root keeps the environment isolated and allows the demo to run with standard user permissions.

## Local test

```bash
tj@dragon:~/Code/VigilHSM$ npx ts-node src/generate-key.ts TJ vault
Generating key pair with label: TJ on vault...

✅ Key Generation Successful
Label: TJ
Key ID: 31373731363731303136313230
Public Key (hex): 4d2f47396c4c414458457947686b4f6c684c4738306d6c333865694e6b777843453876364a6f345931456b3d
tj@dragon:~/Code/VigilHSM$ npx ts-node src/sign.ts TJ SGVsbG8K vault
Signing data with key label: TJ on vault...

✅ Signing Successful
Signature: vault:v1:V2NTba6IANa26PNElWwdV0s62wjtOST2qawci8685zAWID4PR67m6daCz9jkTPeGCO6qK+c/Mt73ENJvMyceAg==
tj@dragon:~/Code/VigilHSM$ npx ts-node src/verify.ts TJ SGVsbG8K V2NTba6IANa26PNElWwdV0s62wjtOST2qawci8685zAWID4PR67m6daCz9jkTPeGCO6qK+c/Mt73ENJvMyceAg== vault
Verifying signature for key label: TJ on vault...

❌ Signature is INVALID
tj@dragon:~/Code/VigilHSM$ npx ts-node src/verify.ts TJ SGVsbG8K vault:v1:V2NTba6IANa26PNElWwdV0s62wjtOST2qawci8685zAWID4PR67m6daCz9jkTPeGCO6qK+c/Mt73ENJvMyceAg== vault
Verifying signature for key label: TJ on vault...

✅ Signature is VALID
```