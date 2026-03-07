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

## Supported Algorithms

VigilHSM standardizes the following algorithms across its backends:

| Algorithm | Key Type | Vault Support | PKCS#11 Support |
| :--- | :--- | :--- | :--- |
| `rsa` | RSA 2048-bit | ✅ | ✅ |
| `ecdsa` | ECDSA (prime256v1) | ✅ | ✅ |
| `ed25519` | Ed25519 | ✅ | ⚠️ (SoftHSM2/Graphene compatibility) |

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
npx ts-node src/generate-key.ts <label> [vault|softhsm] [rsa|ecdsa|ed25519]
```
Example: `npx ts-node src/generate-key.ts my-key vault ecdsa`

### Sign Data
Accepts base64 encoded data to sign.
```bash
npx ts-node src/sign.ts <label> <base64-data> [vault|softhsm] [rsa|ecdsa|ed25519]
```
Example: `npx ts-node src/sign.ts my-key SGVsbG8gVmF1bHQh softhsm rsa`

### Verify Signature
Accepts base64 encoded data and the signature returned from the sign step.
```bash
npx ts-node src/verify.ts <label> <base64-data> <signature> [vault|softhsm] [rsa|ecdsa|ed25519]
```
Example: `npx ts-node src/verify.ts my-key SGVsbG8gVmF1bHQh <signature> vault ecdsa`

---

## Common Questions & Troubleshooting (Q&A)

**Q: Why use Vault instead of direct PKCS#11?**
**A**: Vault provides a high-level REST API and handles complexity like key rotation, backup, and enterprise-grade access control. It acts as a "Single Source of Truth" for security, whereas PKCS#11 is a low-level protocol often tied to specific hardware drivers.

**Q: Why does the PKCS#11 implementation use RSA while Vault uses Ed25519?**
**A**: While `IVigilHSM` supports both, the `graphene-pk11` library (used for PKCS#11) has limited native support for EdDSA constants in some environments. RSA and ECDSA provide the most reliable "out-of-the-box" compatibility for local SoftHSM2 testing while still proving the common interface works across different algorithms.

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
# 1. Generate Key (Now persistent!)
npx ts-node src/generate-key.ts TJ vault rsa

# 2. Sign Data (Auto-loads token from vault/vault_init.env)
npx ts-node src/sign.ts TJ SGVsbG8K vault rsa

# 3. Verify Signature (Ensure full 'vault:v1:...' prefix is included)
npx ts-node src/verify.ts TJ SGVsbG8K <signature> vault rsa
```

> [!TIP]
> Vault signatures are prefixed with `vault:v1:`. If you copy only the base64 part, verification will fail. Always use the full string returned by the sign script.

## Vigil Backend

```bash
npx ts-node src/generate-key.ts VIGIL_BACKEND vault ecdsa

Generating key pair with label: VIGIL_BACKEND on vault using ecdsa...

✅ Key Generation Successful
Label: VIGIL_BACKEND
Key ID: 31373732383639393432393139
Public Key (hex): 2d2d2d2d2d424547494e205055424c4943204b45592d2d2d2d2d0a4d466b77457759484b6f5a497a6a3043415159494b6f5a497a6a30444151634451674145553731376d30763254313237443561547453526f654153475173736b0a6b2b437531596d65302b7655675148505a713436556f49384b42657548484462707736476e513039437a6462685974344e6554315050477652673d3d0a2d2d2d2d2d454e44205055424c4943204b45592d2d2d2d2d0a
```