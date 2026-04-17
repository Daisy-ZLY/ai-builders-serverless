#!/usr/bin/env bash
set -euo pipefail

# 这是一个真实的生成器脚本
# 它会调用 scripts/deepseek-generator.js 来生成合法的 JSON 数据
node scripts/deepseek-generator.js
