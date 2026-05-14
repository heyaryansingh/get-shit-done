# Productivity Insights Command

## Purpose
Generate actionable productivity insights from project activity, todo completion rates, milestone velocity, and code change patterns.

## When to use this command
- Weekly/monthly productivity reviews
- Sprint retrospectives
- Team performance analysis
- Identifying bottlenecks and inefficiencies
- Planning capacity for upcoming work

## Command trigger
User says: "productivity insights", "show productivity", "analyze productivity", "performance review"

## Analysis framework

### 1. Todo completion metrics
- **Completion rate**: percentage of todos marked done vs created
- **Time to completion**: average time from creation to done
- **Abandonment rate**: todos deleted without completion
- **Todo velocity**: todos completed per day/week/month

### 2. Milestone execution
- **On-time completion**: percentage of milestones completed by deadline
- **Average delay**: mean days past deadline for late milestones
- **Scope creep**: percentage of milestones with expanded requirements
- **Milestone velocity**: milestones completed per sprint/month

### 3. Code activity patterns
- **Commit frequency**: commits per day/week with trend analysis
- **Commit size**: average LOC changed per commit (smaller = better)
- **Active hours**: peak productivity time windows
- **Focus blocks**: periods of uninterrupted work without context switching

### 4. Bottleneck identification
- **Blocked tasks**: todos waiting on dependencies
- **Long-running todos**: tasks open > 2 weeks
- **High-churn areas**: files with most frequent changes (potential tech debt)
- **Review delays**: PRs waiting > 48 hours

### 5. Quality indicators
- **Test coverage trend**: increasing/decreasing over time
- **Bug escape rate**: bugs found in production vs caught in dev
- **Refactor ratio**: % of commits that are refactors vs new features
- **Documentation debt**: outdated/missing docs flagged

## Output format

```markdown
# Productivity Insights Report
Generated: [timestamp]
Period: [date range]

## Executive Summary
- Overall productivity score: [0-100]
- Trend: [↑ improving / → stable / ↓ declining]
- Key highlight: [most impressive metric]
- Key concern: [biggest bottleneck]

## Completion Metrics
| Metric | This Period | Last Period | Trend |
|--------|-------------|-------------|-------|
| Todo completion rate | X% | Y% | ↑/↓ |
| Avg time to complete | X days | Y days | ↑/↓ |
| Milestone velocity | X/month | Y/month | ↑/↓ |

## Activity Patterns
- Peak productivity hours: [time range]
- Longest focus block: [duration]
- Average focus block: [duration]
- Context switches per day: [count]

## Bottlenecks Identified
1. [Specific bottleneck with impact assessment]
2. [Specific bottleneck with impact assessment]
3. [Specific bottleneck with impact assessment]

## Quality Trends
- Test coverage: X% (↑/↓ Y% from last period)
- Bug escape rate: X% (target: <5%)
- Documentation health: [good/fair/poor]

## Recommendations
1. [Actionable recommendation based on data]
2. [Actionable recommendation based on data]
3. [Actionable recommendation based on data]

## Weekly Comparison
[Sparkline chart showing week-over-week productivity score]
```

## Implementation steps

1. **Data collection**
   - Parse git log for commits (frequency, size, timing)
   - Extract todo lifecycle events from project tracking
   - Load milestone data with deadlines and completion dates
   - Query test coverage reports if available

2. **Metric calculation**
   - Compute completion rates with period-over-period comparison
   - Identify active hour patterns using commit timestamps
   - Detect focus blocks (gaps > 30min = context switch)
   - Flag bottlenecks using heuristics

3. **Trend analysis**
   - Calculate moving averages for smoothing
   - Detect statistically significant changes (> 15% delta)
   - Generate sparklines for visualization

4. **Recommendation engine**
   - If completion rate < 70%: recommend smaller todos
   - If avg time to complete > 5 days: recommend breaking down tasks
   - If context switches > 10/day: recommend focus time blocking
   - If test coverage declining: recommend TDD practice

5. **Report generation**
   - Format as markdown with tables and visual indicators
   - Highlight wins (green) and concerns (red)
   - Include specific file/task references for context

## Example usage

**User**: "Show me productivity insights for the last 2 weeks"

**AI response**:
- Fetches git log, todo history, milestone data for 14-day window
- Computes all metrics with comparison to previous 14 days
- Identifies that commit frequency dropped 25% (concern)
- Notes that test coverage increased 8% (win)
- Flags 3 todos open > 2 weeks as bottlenecks
- Recommends scheduling dedicated focus blocks based on peak hours
- Generates formatted report with all findings

## Data sources
- `.git/` - commit history, timestamps, diff stats
- `gsd-todos.json` - todo creation/completion/deletion events
- `gsd-milestones.json` - milestone tracking
- `coverage/` - test coverage reports (if available)
- `.gsd/activity.log` - command usage patterns

## Privacy considerations
- All analysis is local, no data sent externally
- Focus on patterns, not specific code content
- Anonymize team member names if generating team reports

## Error handling
- If git log unavailable: skip commit analysis, focus on todo/milestone data
- If insufficient data (< 3 days): warn that insights may not be meaningful
- If no todos/milestones tracked: recommend setting up project tracking first
