#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

POLICY="auto_publish"
GENERATOR_SCRIPT="${AI_BUILDERS_WORKBUDDY_GENERATOR_SCRIPT:-$ROOT_DIR/.workbuddy/local/formal-generator.sh}"

if [[ -x "$GENERATOR_SCRIPT" ]]; then
  GENERATOR_CMD="bash \"$GENERATOR_SCRIPT\""
elif [[ -n "${AI_BUILDERS_FORMAL_GENERATOR_CMD:-}" ]]; then
  GENERATOR_CMD="$AI_BUILDERS_FORMAL_GENERATOR_CMD"
else
  echo "执行失败：run-production"
  echo "原因：Missing .workbuddy/local/formal-generator.sh"
  echo "状态：未自动修复，未继续后续步骤"
  exit 1
fi

command=(
  npm run --silent workflow:run-production --
  --generator-cmd "$GENERATOR_CMD"
  --publish-policy "$POLICY"
)
command+=("$@")

if ! output="$("${command[@]}" 2>&1)"; then
  reason="$(printf '%s\n' "$output" | awk 'NF { print; exit }')"
  echo "执行失败：run-production"
  echo "原因：${reason:-Unknown error}"
  echo "状态：未自动修复，未继续后续步骤"
  exit 1
fi

printf '%s' "$output" | WORKBUDDY_POLICY="$POLICY" node -e '
const fs = require("fs");
const result = JSON.parse(fs.readFileSync(0, "utf8"));

if (result.status === "published" && result.finalPolicy === "auto_publish") {
  console.log("执行成功：published");
  console.log(`日期：${result.date ?? ""}`);
  console.log("请求策略：auto_publish");
  console.log("最终策略：auto_publish");
  console.log("结果：已完成发布，HTML/Git/推送已执行");
  process.exit(0);
}

console.log("执行成功：review_required");
console.log(`日期：${result.date ?? ""}`);
console.log("请求策略：auto_publish");
console.log(`最终策略：${result.finalPolicy ?? "manual_review"}`);
console.log("结果：已降级为人工审核，未继续自动发布");
'
