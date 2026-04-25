#!/bin/bash
# Task priority calculator based on Eisenhower Matrix
# Helps prioritize tasks by urgency and importance

set -e

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

calculate_priority() {
    local urgency=$1
    local importance=$2

    # Eisenhower Matrix quadrants:
    # Q1 (4): Urgent & Important - DO FIRST
    # Q2 (3): Not Urgent & Important - SCHEDULE
    # Q3 (2): Urgent & Not Important - DELEGATE
    # Q4 (1): Not Urgent & Not Important - ELIMINATE

    if [[ $urgency == "high" && $importance == "high" ]]; then
        echo "4|Q1: DO FIRST|${RED}CRITICAL${NC}"
    elif [[ $urgency == "low" && $importance == "high" ]]; then
        echo "3|Q2: SCHEDULE|${GREEN}IMPORTANT${NC}"
    elif [[ $urgency == "high" && $importance == "low" ]]; then
        echo "2|Q3: DELEGATE|${YELLOW}DELEGATE${NC}"
    else
        echo "1|Q4: ELIMINATE|${BLUE}LOW PRIORITY${NC}"
    fi
}

show_usage() {
    cat << EOF
Usage: gsd task-priority [OPTIONS]

Calculate task priority using Eisenhower Matrix.

OPTIONS:
    -u, --urgency <high|low>      Task urgency level
    -i, --importance <high|low>   Task importance level
    -t, --task <description>      Task description
    -l, --list                    List all tasks with priorities
    -h, --help                    Show this help message

EXAMPLES:
    gsd task-priority -u high -i high -t "Fix production bug"
    gsd task-priority -u low -i high -t "Refactor code"
    gsd task-priority --list

EISENHOWER MATRIX:
    Q1: Urgent & Important     → DO FIRST (Red)
    Q2: Not Urgent & Important → SCHEDULE (Green)
    Q3: Urgent & Not Important → DELEGATE (Yellow)
    Q4: Neither                → ELIMINATE (Blue)
EOF
}

list_tasks() {
    echo -e "${GREEN}=== Task Priorities ===${NC}\n"

    # Check if tasks file exists
    local tasks_file="${GSD_DATA_DIR:-$HOME/.gsd}/tasks.txt"

    if [[ ! -f "$tasks_file" ]]; then
        echo "No tasks found. Add tasks with: gsd task-priority -u <urgency> -i <importance> -t <task>"
        return
    fi

    # Sort by priority (descending)
    sort -t'|' -k1 -r "$tasks_file" | while IFS='|' read -r priority quadrant status task; do
        echo -e "${status} [${quadrant}] ${task}"
    done
}

add_task() {
    local urgency=$1
    local importance=$2
    local task=$3

    # Calculate priority
    local result=$(calculate_priority "$urgency" "$importance")
    IFS='|' read -r priority quadrant status <<< "$result"

    # Create data directory if needed
    local data_dir="${GSD_DATA_DIR:-$HOME/.gsd}"
    mkdir -p "$data_dir"

    # Append to tasks file
    echo "${priority}|${quadrant}|${status}|${task}" >> "${data_dir}/tasks.txt"

    echo -e "${status} Task added: ${task}"
    echo -e "   Priority: ${quadrant}"
}

# Main script
if [[ $# -eq 0 ]]; then
    show_usage
    exit 0
fi

URGENCY=""
IMPORTANCE=""
TASK=""
LIST_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--urgency)
            URGENCY="$2"
            shift 2
            ;;
        -i|--importance)
            IMPORTANCE="$2"
            shift 2
            ;;
        -t|--task)
            TASK="$2"
            shift 2
            ;;
        -l|--list)
            LIST_MODE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

if $LIST_MODE; then
    list_tasks
elif [[ -n "$URGENCY" && -n "$IMPORTANCE" && -n "$TASK" ]]; then
    add_task "$URGENCY" "$IMPORTANCE" "$TASK"
else
    echo "Error: Missing required arguments"
    show_usage
    exit 1
fi
