#!/bin/bash

set -euo pipefail

# Configuration
NOTIFICATION_SCRIPT="${NOTIFICATION_SCRIPT:-/Users/adammanuel/.claude/tools/send-notification.sh}"
CLAUDE_COMMAND="${CLAUDE_COMMAND:-claude}"
REVIEW_TIMEOUT="${REVIEW_TIMEOUT:-300}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "🎯 Review Orchestrator Test"
echo "Testing basic functionality..."

# Test git validation
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Git repository validated${NC}"
echo -e "${BLUE}🔄 Review system is ready${NC}"