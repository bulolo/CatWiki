#!/bin/sh
# frontend/admin/entrypoint.sh

echo "Injecting runtime environment variables..."

# Define the list of variables to replace based on src/lib/env.ts
VARS="NEXT_PUBLIC_API_URL NEXT_PUBLIC_CLIENT_URL NEXT_PUBLIC_CATWIKI_EDITION NEXT_PUBLIC_DOCS_URL NEXT_PUBLIC_DEBUG NEXT_PUBLIC_SENTRY_DSN"

for varname in $VARS; do
    # Get the value from the environment
    eval varvalue=\$$varname
    
    # Only replace if the value is provided at runtime
    if [ -n "$varvalue" ]; then
        echo "Replacing __${varname}_PLACEHOLDER__ with $varvalue"
        # Corrected: removed typo _PLACE_HOLDER__ -> _PLACEHOLDER__
        find /app/.next -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) -exec sed -i "s|__${varname}_PLACEHOLDER__|${varvalue}|g" {} +
        find /app -maxdepth 2 -type f \( -name '*.js' -o -name '*.html' -o -name '*.json' \) -exec sed -i "s|__${varname}_PLACEHOLDER__|${varvalue}|g" {} +
    fi
done

echo "Injection completed."
echo "Starting Next.js..."

# Execute the CMD passed as arguments
exec "$@"
