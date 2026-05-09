#!/bin/bash
# GSD Task Analytics - Analyze task completion patterns and productivity metrics

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Find GSD directory
GSD_DIR="${GSD_DIR:-.gsd}"

if [ ! -d "$GSD_DIR" ]; then
    echo -e "${RED}Error: GSD directory not found. Run 'gsd init' first.${NC}"
    exit 1
fi

# Check if task files exist
TASKS_FILE="$GSD_DIR/tasks.md"
ACTIVE_FILE="$GSD_DIR/active.md"

if [ ! -f "$TASKS_FILE" ]; then
    echo -e "${RED}Error: No tasks file found at $TASKS_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}=== GSD Task Analytics ===${NC}\n"

# Parse command line args
DAYS="${1:-7}"  # Default to last 7 days
VERBOSE="${2:-false}"

# Get current date
CURRENT_DATE=$(date +%Y-%m-%d)

# Function to count tasks by status
count_tasks_by_status() {
    local file="$1"
    local status="$2"

    if [ ! -f "$file" ]; then
        echo "0"
        return
    fi

    # Count checkbox patterns: [x] for done, [ ] for pending
    if [ "$status" = "done" ]; then
        grep -c "\[x\]" "$file" 2>/dev/null || echo "0"
    elif [ "$status" = "pending" ]; then
        grep -c "\[ \]" "$file" 2>/dev/null || echo "0"
    else
        grep -c "\-" "$file" 2>/dev/null || echo "0"
    fi
}

# Function to extract task priorities
analyze_priorities() {
    local file="$1"

    if [ ! -f "$file" ]; then
        echo -e "  ${YELLOW}No tasks found${NC}"
        return
    fi

    echo -e "${GREEN}Priority Distribution:${NC}"

    # Count P0, P1, P2, P3
    local p0=$(grep -c "P0\|Critical\|URGENT" "$file" 2>/dev/null || echo "0")
    local p1=$(grep -c "P1\|High" "$file" 2>/dev/null || echo "0")
    local p2=$(grep -c "P2\|Medium" "$file" 2>/dev/null || echo "0")
    local p3=$(grep -c "P3\|Low" "$file" 2>/dev/null || echo "0")

    echo -e "  P0 (Critical): ${RED}$p0${NC}"
    echo -e "  P1 (High):     ${YELLOW}$p1${NC}"
    echo -e "  P2 (Medium):   ${BLUE}$p2${NC}"
    echo -e "  P3 (Low):      ${GREEN}$p3${NC}"
}

# Function to analyze task categories
analyze_categories() {
    local file="$1"

    if [ ! -f "$file" ]; then
        return
    fi

    echo -e "\n${GREEN}Task Categories:${NC}"

    # Look for common category tags
    local feature=$(grep -c "#feature\|feat:" "$file" 2>/dev/null || echo "0")
    local bug=$(grep -c "#bug\|fix:" "$file" 2>/dev/null || echo "0")
    local refactor=$(grep -c "#refactor\|refactor:" "$file" 2>/dev/null || echo "0")
    local docs=$(grep -c "#docs\|docs:" "$file" 2>/dev/null || echo "0")
    local test=$(grep -c "#test\|test:" "$file" 2>/dev/null || echo "0")

    echo -e "  Features:   $feature"
    echo -e "  Bugs:       $bug"
    echo -e "  Refactors:  $refactor"
    echo -e "  Docs:       $docs"
    echo -e "  Tests:      $test"
}

# Function to calculate completion rate
calculate_completion_rate() {
    local done=$(count_tasks_by_status "$TASKS_FILE" "done")
    local pending=$(count_tasks_by_status "$TASKS_FILE" "pending")
    local total=$((done + pending))

    if [ $total -eq 0 ]; then
        echo "0%"
        return
    fi

    local rate=$((done * 100 / total))
    echo "${rate}%"
}

# Function to estimate velocity
estimate_velocity() {
    local done=$(count_tasks_by_status "$TASKS_FILE" "done")
    local days="$1"

    if [ $days -eq 0 ]; then
        echo "0"
        return
    fi

    echo "scale=2; $done / $days" | bc
}

# Main analytics output
echo -e "${GREEN}Overall Statistics:${NC}"

TOTAL_DONE=$(count_tasks_by_status "$TASKS_FILE" "done")
TOTAL_PENDING=$(count_tasks_by_status "$TASKS_FILE" "pending")
TOTAL_TASKS=$((TOTAL_DONE + TOTAL_PENDING))

echo -e "  Total Tasks:     $TOTAL_TASKS"
echo -e "  Completed:       ${GREEN}$TOTAL_DONE${NC}"
echo -e "  Pending:         ${YELLOW}$TOTAL_PENDING${NC}"

COMPLETION_RATE=$(calculate_completion_rate)
echo -e "  Completion Rate: ${GREEN}$COMPLETION_RATE${NC}"

echo ""

# Active tasks
if [ -f "$ACTIVE_FILE" ]; then
    ACTIVE_COUNT=$(count_tasks_by_status "$ACTIVE_FILE" "pending")
    echo -e "${GREEN}Active Tasks:${NC} $ACTIVE_COUNT"
    echo ""
fi

# Priority analysis
analyze_priorities "$TASKS_FILE"

# Category analysis
analyze_categories "$TASKS_FILE"

# Velocity
echo ""
echo -e "${GREEN}Velocity (last $DAYS days):${NC}"
VELOCITY=$(estimate_velocity "$DAYS")
echo -e "  Tasks/day: ${BLUE}$VELOCITY${NC}"

# Recommendations
echo ""
echo -e "${BLUE}=== Recommendations ===${NC}"

if [ "$TOTAL_PENDING" -gt 20 ]; then
    echo -e "  ${YELLOW}⚠️  High pending task count ($TOTAL_PENDING). Consider prioritizing or archiving old tasks.${NC}"
fi

if [ "$TOTAL_DONE" -lt 5 ] && [ "$TOTAL_TASKS" -gt 10 ]; then
    echo -e "  ${YELLOW}⚠️  Low completion rate. Focus on finishing current tasks before adding new ones.${NC}"
fi

# Check for overdue tasks (if dates are present)
OVERDUE=$(grep -c "due:" "$TASKS_FILE" 2>/dev/null || echo "0")
if [ "$OVERDUE" -gt 0 ]; then
    echo -e "  ${RED}⚠️  $OVERDUE tasks with due dates. Review for overdue items.${NC}"
fi

# Suggest priority focus
P0_COUNT=$(grep -c "P0\|Critical\|URGENT" "$TASKS_FILE" 2>/dev/null || echo "0")
if [ "$P0_COUNT" -gt 0 ]; then
    echo -e "  ${RED}🔥 $P0_COUNT critical tasks require immediate attention!${NC}"
fi

echo ""

# Verbose mode: show recent completed tasks
if [ "$VERBOSE" = "true" ] || [ "$VERBOSE" = "-v" ]; then
    echo -e "${BLUE}=== Recent Completed Tasks ===${NC}"
    grep "\[x\]" "$TASKS_FILE" | tail -n 10 || echo "  No completed tasks found"
    echo ""
fi

echo -e "${GREEN}✓ Analysis complete${NC}"
