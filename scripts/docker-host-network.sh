#!/bin/bash
# Wrapper that injects --network=host into docker build calls so RUN commands
# use the host network stack. Required on servers where Docker's bridge network
# has no outbound internet access.
args=("$@")
for i in "${!args[@]}"; do
    if [[ "${args[$i]}" == "build" ]]; then
        args=("${args[@]:0:$((i+1))}" "--network=host" "${args[@]:$((i+1))}")
        break
    fi
done
exec docker "${args[@]}"
