#!/bin/bash

# Configuration
export VAULT_ADDR='http://127.0.0.1:8200'
export VAULT_TOKEN='dev-token'

# Wait for Vault to start properly
echo "Waiting for Vault to start..."
sleep 5

# Check if Vault is initialized
INIT_STATUS=$(curl -s $VAULT_ADDR/v1/sys/init | jq -r '.initialized')

if [ "$INIT_STATUS" != "true" ]; then
    echo "Initializing Vault..."
    INIT_RES=$(curl -s -X PUT -d '{"secret_shares":1, "secret_threshold":1}' $VAULT_ADDR/v1/sys/init)
    
    # Try different field names (keys_base64 is what we saw in the output)
    UNSEAL_KEY=$(echo $INIT_RES | jq -r '.keys_base64[0] // .keys[0]')
    ROOT_TOKEN=$(echo $INIT_RES | jq -r '.root_token')
    
    if [ "$UNSEAL_KEY" == "null" ] || [ -z "$UNSEAL_KEY" ]; then
        echo "❌ Initialization failed: $INIT_RES"
        exit 1
    fi

    echo "Unseal Key: $UNSEAL_KEY"
    echo "Root Token: $ROOT_TOKEN"
    
    # Save for convenience
    echo "UNSEAL_KEY=$UNSEAL_KEY" > vault_init.env
    echo "ROOT_TOKEN=$ROOT_TOKEN" >> vault_init.env
    chmod 600 vault_init.env
    
    echo "Unsealing Vault..."
    curl -s -X PUT -d "{\"key\": \"$UNSEAL_KEY\"}" $VAULT_ADDR/v1/sys/unseal > /dev/null
    
    export VAULT_TOKEN=$ROOT_TOKEN
else
    echo "Vault is already initialized."
    # Check if sealed
    HEALTH_RES=$(curl -s $VAULT_ADDR/v1/sys/health)
    SEALED_STATUS=$(echo $HEALTH_RES | jq -r '.sealed')
    if [ "$SEALED_STATUS" == "true" ]; then
        if [ -f vault_init.env ]; then
            source vault_init.env
            echo "Unsealing Vault with saved key..."
            curl -s -X PUT -d "{\"key\": \"$UNSEAL_KEY\"}" $VAULT_ADDR/v1/sys/unseal > /dev/null
            export VAULT_TOKEN=$ROOT_TOKEN
        else
            echo "❌ Vault is sealed and no vault_init.env found. Please unseal manually."
            exit 1
        fi
    else
        echo "Vault is already unsealed."
        if [ -f vault_init.env ]; then
            source vault_init.env
            export VAULT_TOKEN=$ROOT_TOKEN
        fi
    fi
fi

# Enable Transit secrets engine if not enabled
MOUNTS=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" $VAULT_ADDR/v1/sys/mounts)
if ! echo "$MOUNTS" | jq -e '.["transit/"]' > /dev/null; then
    echo "Enabling Transit engine..."
    curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" -d '{"type":"transit"}' $VAULT_ADDR/v1/sys/mounts/transit > /dev/null
fi

echo "HashiCorp Vault is ready!"
echo "ROOT_TOKEN=$VAULT_TOKEN"