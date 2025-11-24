# Task Management

Qalam includes a priority-based task management system to help you track and organize your development work.

## Priority Levels

Tasks are organized into three priority levels:

- **P1 (Urgent)** - Critical tasks that need immediate attention
- **P2 (Important)** - Important but not immediately critical
- **P3 (Normal)** - Regular tasks, nice-to-haves

## Adding Tasks

### Basic Addition

```bash
qalam tasks add "Fix production bug"
```

Qalam automatically detects priority based on keywords:
- Words like "critical", "urgent", "production", "fix" → P1
- Words like "important", "review", "update" → P2
- Everything else → P3

### Explicit Priority

```bash
qalam tasks add "Review PR #123" p2
qalam tasks add "Fix critical security issue" p1
qalam tasks add "Update README" p3
```

## Working with Tasks

### View Next Task

Get the highest priority task to work on:

```bash
qalam tasks next
```

This shows:
- The task description
- Priority level
- How long it's been pending
- Options to mark as done or skip

### List All Tasks

```bash
qalam tasks list
```

Tasks are grouped by priority:
```
🔴 P1 - Urgent (2 tasks)
  • Fix production memory leak (2 hours ago)
  • Resolve customer blocking issue (4 hours ago)

🟡 P2 - Important (3 tasks)
  • Review security audit PR (1 day ago)
  • Update API documentation (2 days ago)

🟢 P3 - Normal (5 tasks)
  • Refactor utility functions (3 days ago)
```

### Complete Tasks

```bash
# Mark specific task as done
qalam tasks done "Fix production bug"

# Mark all P1 tasks as done
qalam tasks done p1

# Interactive selection
qalam tasks done
```

## AI-Powered Features

### Task Suggestions

Get AI recommendations for task prioritization:

```bash
qalam tasks suggest
```

The AI analyzes your workload and suggests:
- Which tasks to tackle first
- Time estimates
- Potential task groupings

### Health Score

Check your task management health:

```bash
qalam tasks health
```

Shows:
- Total tasks by priority
- Oldest pending tasks
- Completion rate
- Health score (0-100)

## Maintenance

### Clear Completed Tasks

Remove completed tasks from the database:

```bash
qalam tasks clear
```

### Task Analytics

View task statistics:

```bash
qalam tasks stats
```

Shows:
- Tasks completed today/week/month
- Average time to completion
- Most productive times

## Integration with Workflows

Combine tasks with workflows for automation:

```bash
# Create a workflow that processes the next task
qalam workflow create next-task
# Add: qalam tasks next
# Add: qalam tasks done

# Run it
qalam workflow run next-task
```

## Best Practices

1. **Review daily**: Start each day by checking `qalam tasks next`
2. **Be specific**: "Fix login bug on mobile" not just "Fix bug"
3. **Regular cleanup**: Use `qalam tasks clear` weekly
4. **Trust the AI**: Let `qalam tasks suggest` help prioritize
5. **Keep it current**: Mark tasks done immediately after completion
6. **Batch similar tasks**: Group related P3 tasks for efficiency