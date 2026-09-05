#!/bin/bash
# End-to-end RBAC smoke test against the running API.
API=http://localhost:3000/api
pass=0; fail=0

tok() {
  curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"demo1234\"}" \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('token',''))"
}

check() { # label expected method path token [body]
  local label="$1" want="$2" method="$3" path="$4" t="$5" body="$6"
  local code
  if [ -n "$body" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$API$path" \
      -H "Authorization: Bearer $t" -H 'Content-Type: application/json' -d "$body")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$API$path" -H "Authorization: Bearer $t")
  fi
  if [ "$code" = "$want" ]; then
    printf 'PASS  %-56s %s\n' "$label" "$code"; pass=$((pass+1))
  else
    printf 'FAIL  %-56s got %s want %s\n' "$label" "$code" "$want"; fail=$((fail+1))
  fi
}

ADMIN=$(tok admin@demo.com)
TRAINER=$(tok trainer@demo.com)
DIET=$(tok dietician@demo.com)

echo "=== notifications: audience isolation ==="
check "admin reads notifications"            200 GET /notifications "$ADMIN"
check "dietician reads notifications"        200 GET /notifications "$DIET"
check "mark-read on a foreign id is 404"     404 POST /notifications/mark-read/999999 "$DIET"

echo
echo "=== previously ungated routes ==="
check "admin reads facility subscription"    200 GET /facility/subscription "$ADMIN"
check "dietician reads facility subscription" 200 GET /facility/subscription "$DIET"
check "dietician reads food database"        200 GET /nutrition/foods "$DIET"

echo
echo "=== dietician: read-only, own members only ==="
check "reads assigned member health"         200 GET /clients/29/health-profile "$DIET"
check "cannot write health profile"          403 PUT /clients/29/health-profile "$DIET" '{}'
check "cannot create workout schedule"       403 POST /clients/29/workout-schedules "$DIET" '{"name":"x","days":[{"dayNumber":1,"focus":"a","exercises":[]}]}'
check "cannot log a workout day"             403 POST /clients/29/workout-schedules/ws_demo/day-log "$DIET" '{"status":"done"}'
check "cannot list all members"              403 GET /clients "$DIET"
check "cannot reach PT module"               403 GET /pt/sessions "$DIET"
check "cannot manage staff"                  403 GET /staff "$DIET"

echo
echo "=== trainer (staff): programme yes, chart deletion no ==="
check "reads member health"                  200 GET /clients/29/health-profile "$TRAINER"
check "reads trainer roster"                 200 GET /pt/trainers "$TRAINER"
check "cannot delete a diet chart"           403 DELETE /nutrition/charts/18 "$TRAINER"
check "cannot manage dieticians"             403 GET /nutrition/dieticians "$TRAINER"

echo
echo "=== admin: full facility authority ==="
check "reads trainer roster"                 200 GET /pt/trainers "$ADMIN"
check "reads PT sessions"                    200 GET /pt/sessions "$ADMIN"
check "manages dieticians"                   200 GET /nutrition/dieticians "$ADMIN"
check "reads all members"                    200 GET /clients "$ADMIN"

echo
echo "=== trainer validation ==="
DIET_ID=$(curl -s "$API/nutrition/dieticians" -H "Authorization: Bearer $ADMIN" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d[0]['id'] if d else 0)")
check "session with a DIETICIAN as trainer rejected" 400 POST /pt/sessions "$ADMIN" \
  "{\"clientId\":29,\"sessionDate\":\"2026-09-05T10:00:00Z\",\"trainerId\":$DIET_ID}"
check "session with a bogus trainer id rejected"     400 POST /pt/sessions "$ADMIN" \
  '{"clientId":29,"sessionDate":"2026-09-05T10:00:00Z","trainerId":99999}'

echo
echo "----------------------------------------------------"
echo "  $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
