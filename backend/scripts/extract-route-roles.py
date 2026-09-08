#!/usr/bin/env python3
"""
Extract every authorize()-gated route as `METHOD /path -> [sorted roles]`.

Purpose: prove a permissions refactor changed only what you intended. Role lists
are spread across server.js and four route registrars, and a capability rename or
a moved middleware can silently widen access. Snapshot before, snapshot after,
diff — every difference should be one you can name.

    cd backend
    python3 scripts/extract-route-roles.py > /tmp/roles_before.json
    # ...make your change...
    python3 scripts/extract-route-roles.py > /tmp/roles_after.json
    diff <(jq -S . /tmp/roles_before.json) <(jq -S . /tmp/roles_after.json)

Capability names (`authorize(P.PT_MANAGE)`) are resolved through
config/permissions.js, so the output is always concrete roles and is comparable
across a literals-to-capabilities refactor.

A value of "OPEN" means the route has `authenticate` but no `authorize` — check
each one is deliberate. `null` means neither, i.e. a public route.
"""
import json
import re
import subprocess
import sys

FILES = [
    'server.js',
    'routes/pt.js',
    'routes/nutrition.js',
    'routes/dietician.js',
    'gamification/routes.js',
]

ROUTE_RE = (
    r"app\.(get|post|put|delete)\(\s*'([^']+)'\s*,(.*?)"
    r"(?=,\s*(?:async\s*)?\(?req|,\s*\w+Controller\.|,\s*\w+\)\s*;)"
)
CHAIN_RE = r"const (\w+) = \[([^\]]*?authorize\([^)]*\))[^\]]*\];"


def load_capabilities():
    out = subprocess.check_output(
        ['node', '-e', 'console.log(JSON.stringify(require("./config/permissions").P))']
    )
    return json.loads(out)


def main():
    try:
        caps = load_capabilities()
    except Exception as exc:  # noqa: BLE001
        sys.exit(f'could not load config/permissions.js — run from backend/ ({exc})')

    def roles_of(expr):
        m = re.search(r"authorize\(P\.(\w+)\)", expr)
        if m:
            if m.group(1) not in caps:
                sys.exit(f'unknown capability P.{m.group(1)}')
            return sorted(caps[m.group(1)])
        m = re.search(r"authorize\(\[([^\]]*)\]", expr)
        if m:
            return sorted(re.findall(r"'(\w+)'", m.group(1)))
        return None

    out = {}
    for path in FILES:
        try:
            src = open(path).read()
        except FileNotFoundError:
            continue

        # Named middleware chains, e.g. `const staffAccess = [authenticate, ...]`
        chains = {}
        for m in re.finditer(CHAIN_RE, src, re.S):
            roles = roles_of(m.group(2))
            if roles is not None:
                chains[m.group(1)] = roles

        for m in re.finditer(ROUTE_RE, src, re.S):
            verb, route, middleware = m.group(1).upper(), m.group(2), m.group(3)
            roles = roles_of(middleware)
            if roles is None:
                for name, chain_roles in chains.items():
                    if re.search(r'\b%s\b' % name, middleware):
                        roles = chain_roles
                        break
            if roles is None:
                roles = 'OPEN' if 'authenticate' in middleware else None
            out['%s %s' % (verb, route)] = roles

    print(json.dumps(out, indent=0, sort_keys=True))


if __name__ == '__main__':
    main()
