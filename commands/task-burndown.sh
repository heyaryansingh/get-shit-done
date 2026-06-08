#!/bin/bash
# GSD Task Burndown - Generate ASCII burndown chart and track progress over time
# Shows task completion trends and forecasts remaining work

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Find GSD directory
GSD_DIR="${GSD_DIR:-.gsd}"

show_usage() {
    cat << EOF
Usage: gsd task-burndown [OPTIONS]

Generate ASCII burndown chart tracking task completion over time.

OPTIONS:
    -d, --days <number>    Number of days to display (default: 14)
    -s, --snapshot         Record today's task counts to history
    -r, --report           Show detailed burndown report
    -f, --forecast         Show completion forecast
    -h, --help             Show this help message

EXAMPLES:
    gsd task-burndown                  Show burndown chart (14 days)
    gsd task-burndown -d 30            Show 30-day burndown
    gsd task-burndown --snapshot       Record today's progress
    gsd task-burndown --forecast       Forecast completion date

EOF
}

# Initialize burndown history file
init_history() {
    local history_file="$GSD_DIR/burndown_history.csv"
    if [ ! -f "$history_file" ]; then
        echo "date,total,completed,pending,added" > "$history_file"
    fi
    echo "$history_file"
}

# Count tasks from the tasks file
count_tasks() {
    local tasks_file="$GSD_DIR/tasks.md"
    if [ ! -f "$tasks_file" ]; then
        echo "0,0,0"
        return
    fi

    local done=$(grep -c "\[x\]" "$tasks_file" 2>/dev/null || echo "0")
    local pending=$(grep -c "\[ \]" "$tasks_file" 2>/dev/null || echo "0")
    local total=$((done + pending))
    echo "$total,$done,$pending"
}

# Record a daily snapshot
record_snapshot() {
    local history_file=$(init_history)
    local today=$(date +%Y-%m-%d)
    local counts=$(count_tasks)

    IFS=',' read -r total done pending <<< "$counts"

    # Check if today's snapshot already exists
    if grep -q "^$today," "$history_file" 2>/dev/null; then
        # Update today's entry
        local tmp_file=$(mktemp)
        grep -v "^$today," "$history_file" > "$tmp_file"
        mv "$tmp_file" "$history_file"
    fi

    # Calculate tasks added since last snapshot
    local last_total=$(tail -n 1 "$history_file" 2>/dev/null | cut -d',' -f2)
    local added=0
    if [ -n "$last_total" ] && [ "$last_total" != "total" ]; then
        added=$((total - last_total + (done - $(tail -n 1 "$history_file" | cut -d',' -f3))))
        if [ "$added" -lt 0 ]; then
            added=0
        fi
    fi

    echo "$today,$total,$done,$pending,$added" >> "$history_file"
    echo -e "${GREEN}Snapshot recorded for $today${NC}"
    echo -e "  Total: $total | Completed: $done | Pending: $pending | New: $added"
}

# Generate ASCII burndown chart
generate_chart() {
    local days="${1:-14}"
    local history_file=$(init_history)

    if [ ! -f "$history_file" ] || [ "$(wc -l < "$history_file")" -le 1 ]; then
        echo -e "${YELLOW}No burndown history yet. Run 'gsd task-burndown --snapshot' to start tracking.${NC}"
        return
    fi

    echo -e "${BLUE}=== Task Burndown Chart (last $days days) ===${NC}\n"

    # Read last N entries (skip header)
    local entries=$(tail -n +"2" "$history_file" | tail -n "$days")

    if [ -z "$entries" ]; then
        echo -e "${YELLOW}No data available for the requested period.${NC}"
        return
    fi

    # Find max pending for scaling
    local max_pending=0
    while IFS=',' read -r date total done pending added; do
        if [ "$pending" -gt "$max_pending" ]; then
            max_pending=$pending
        fi
    done <<< "$entries"

    if [ "$max_pending" -eq 0 ]; then
        max_pending=1
    fi

    # Chart dimensions
    local chart_width=50
    local chart_height=15

    # Print chart header
    printf "  %${chart_width}s\n" "" | tr ' ' '-'

    # Print each row (from top to bottom represents high to low pending count)
    for row in $(seq "$chart_height" -1 1); do
        local threshold=$((max_pending * row / chart_height))
        printf "%4d |" "$threshold"

        local col=0
        while IFS=',' read -r date total done pending added; do
            col=$((col + 1))
            local bar_height=$((pending * chart_height / max_pending))
            if [ "$bar_height" -ge "$row" ]; then
                if [ "$pending" -gt "$((max_pending * 3 / 4))" ]; then
                    printf "${RED}#${NC}"
                elif [ "$pending" -gt "$((max_pending / 2))" ]; then
                    printf "${YELLOW}#${NC}"
                else
                    printf "${GREEN}#${NC}"
                fi
            else
                printf " "
            fi
        done <<< "$entries"

        echo ""
    done

    # Print X axis
    printf "     +"
    while IFS=',' read -r date total done pending added; do
        printf "-"
    done <<< "$entries"
    echo ""

    # Print date labels (abbreviated)
    printf "      "
    local col=0
    while IFS=',' read -r date total done pending added; do
        col=$((col + 1))
        if [ $((col % 3)) -eq 1 ]; then
            printf "%-3s" "$(echo "$date" | cut -d'-' -f3)"
        else
            printf "   "
        fi
    done <<< "$entries"
    echo -e "\n"

    # Print legend
    echo -e "  Legend: ${RED}# High pending${NC}  ${YELLOW}# Medium${NC}  ${GREEN}# Low${NC}"
    echo -e "  Y-axis: Pending task count | X-axis: Date (day of month)"
}

# Show completion forecast
show_forecast() {
    local history_file=$(init_history)

    if [ ! -f "$history_file" ] || [ "$(wc -l < "$history_file")" -le 2 ]; then
        echo -e "${YELLOW}Need at least 2 snapshots for forecasting. Run 'gsd task-burndown --snapshot' daily.${NC}"
        return
    fi

    echo -e "${BLUE}=== Completion Forecast ===${NC}\n"

    # Get current counts
    local counts=$(count_tasks)
    IFS=',' read -r total done pending <<< "$counts"

    echo -e "  Current Status:"
    echo -e "    Total tasks:     $total"
    echo -e "    Completed:       ${GREEN}$done${NC}"
    echo -e "    Remaining:       ${YELLOW}$pending${NC}"

    if [ "$pending" -eq 0 ]; then
        echo -e "\n  ${GREEN}All tasks completed!${NC}"
        return
    fi

    # Calculate velocity from last 7 snapshots
    local recent=$(tail -n +"2" "$history_file" | tail -n 7)
    local first_pending=$(echo "$recent" | head -n 1 | cut -d',' -f4)
    local last_pending=$(echo "$recent" | tail -n 1 | cut -d',' -f4)
    local num_days=$(echo "$recent" | wc -l)

    if [ "$num_days" -le 1 ]; then
        echo -e "\n  ${YELLOW}Not enough data points for velocity calculation.${NC}"
        return
    fi

    local tasks_done=$((first_pending - last_pending))
    local velocity_per_day=0

    if [ "$num_days" -gt 1 ]; then
        velocity_per_day=$(echo "scale=2; $tasks_done / ($num_days - 1)" | bc 2>/dev/null || echo "0")
    fi

    echo -e "\n  Velocity Metrics:"
    echo -e "    Tasks completed in last $num_days snapshots: ${GREEN}$tasks_done${NC}"
    echo -e "    Average velocity: ${CYAN}$velocity_per_day tasks/day${NC}"

    # Forecast completion
    if [ "$(echo "$velocity_per_day > 0" | bc 2>/dev/null || echo "0")" -eq 1 ]; then
        local days_remaining=$(echo "scale=0; $pending / $velocity_per_day" | bc 2>/dev/null || echo "?")
        local forecast_date=$(date -d "+${days_remaining} days" +%Y-%m-%d 2>/dev/null || date -v+${days_remaining}d +%Y-%m-%d 2>/dev/null || echo "N/A")

        echo -e "\n  ${GREEN}Forecast:${NC}"
        echo -e "    Days to completion: ~${CYAN}$days_remaining${NC}"
        echo -e "    Estimated date:     ${CYAN}$forecast_date${NC}"
    elif [ "$(echo "$velocity_per_day == 0" | bc 2>/dev/null || echo "0")" -eq 1 ]; then
        echo -e "\n  ${YELLOW}Forecast: No progress detected. Velocity is 0 tasks/day.${NC}"
    else
        echo -e "\n  ${RED}Warning: Task count is increasing! More tasks added than completed.${NC}"
        echo -e "  ${RED}Net rate: $velocity_per_day tasks/day (negative = growing backlog)${NC}"
    fi
}

# Show detailed report
show_report() {
    local history_file=$(init_history)

    echo -e "${BLUE}=== Burndown Report ===${NC}\n"

    # Current state
    local counts=$(count_tasks)
    IFS=',' read -r total done pending <<< "$counts"

    echo -e "${GREEN}Current State:${NC}"
    echo -e "  Total: $total | Done: $done | Pending: $pending"

    if [ "$total" -gt 0 ]; then
        local pct=$((done * 100 / total))
        echo -e "  Progress: ${GREEN}$pct%${NC}"

        # Progress bar
        local filled=$((pct / 2))
        local empty=$((50 - filled))
        printf "  ["
        printf "${GREEN}%0.s#${NC}" $(seq 1 "$filled" 2>/dev/null) 2>/dev/null
        printf "%0.s-" $(seq 1 "$empty" 2>/dev/null) 2>/dev/null
        printf "] %d%%\n\n" "$pct"
    fi

    # History summary
    if [ -f "$history_file" ] && [ "$(wc -l < "$history_file")" -gt 1 ]; then
        echo -e "${GREEN}History (recent entries):${NC}"
        echo -e "  Date       | Total | Done | Pending | Added"
        echo -e "  -----------|-------|------|---------|------"
        tail -n +"2" "$history_file" | tail -n 10 | while IFS=',' read -r date total done pending added; do
            printf "  %-10s | %5s | %4s | %7s | %s\n" "$date" "$total" "$done" "$pending" "$added"
        done
        echo ""
    fi

    # Generate chart
    generate_chart 14

    # Forecast
    show_forecast
}

# --- Main ---
if [ ! -d "$GSD_DIR" ]; then
    echo -e "${RED}Error: GSD directory not found. Run 'gsd init' first.${NC}"
    exit 1
fi

DAYS=14
ACTION="chart"

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--days)
            DAYS="$2"
            shift 2
            ;;
        -s|--snapshot)
            ACTION="snapshot"
            shift
            ;;
        -r|--report)
            ACTION="report"
            shift
            ;;
        -f|--forecast)
            ACTION="forecast"
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

case $ACTION in
    snapshot)
        record_snapshot
        ;;
    report)
        show_report
        ;;
    forecast)
        show_forecast
        ;;
    chart)
        generate_chart "$DAYS"
        ;;
esac
