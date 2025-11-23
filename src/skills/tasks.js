import { Skill } from '../core/skillManager.js';
import chalk from 'chalk';
import { getDatabase } from '../core/database.js';
import inquirer from 'inquirer';

export default class TasksSkill extends Skill {
  constructor() {
    super('tasks', 'Simple priority task management');
    this.db = null;
  }

  async init() {
    if (!this.db) {
      this.db = await getDatabase();
      await this.ensureQueueTable();
    }
  }

  async ensureQueueTable() {
    // Create tasks table if it doesn't exist
    await this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        priority INTEGER NOT NULL,
        project TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        status TEXT DEFAULT 'pending'
      )
    `);

    // Create index for faster queries
    await this.db.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority, created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
  }

  async execute(args) {
    await this.init();
    
    const [action, ...params] = args;

    switch (action) {
      case 'add':
      case '+':
        return await this.addTask(params);
      
      case 'next':
      case '++':
        return await this.nextTask(params);
      
      case 'done':
      case '-':
        return await this.markDone(params);
      
      case 'list':
      case 'ls':
        return await this.listQueue(params);
      
      case 'clear':
        return await this.clearCompleted();
      
      case 'suggest':
        return await this.suggest();
      
      case 'health':
        return await this.healthCheck();
      
      default:
        if (!action) {
          return await this.interactiveMenu();
        }
        // If no recognized action, treat it as adding a task
        return await this.addTask([action, ...params]);
    }
  }

  async addTask(params) {
    let task = '';
    let priority = null;
    
    // Parse params for task and priority
    if (params.length === 0) {
      // Interactive mode
      return await this.interactiveAdd();
    }
    
    // Check if last param is priority
    const lastParam = params[params.length - 1];
    if (['p1', 'p2', 'p3', '1', '2', '3'].includes(lastParam.toLowerCase())) {
      priority = parseInt(lastParam.replace('p', ''));
      task = params.slice(0, -1).join(' ');
    } else {
      task = params.join(' ');
    }

    // If no task provided, go interactive
    if (!task) {
      return await this.interactiveAdd();
    }

    // If no priority, ask for it or detect from keywords
    if (!priority) {
      priority = await this.detectOrAskPriority(task);
    }

    // Get current directory as project context
    const project = process.cwd().split('/').pop();

    // Save to database
    await this.db.db.run(
      `INSERT INTO tasks (task, priority, project) VALUES (?, ?, ?)`,
      [task, priority, project]
    );

    const priorityLabel = this.getPriorityLabel(priority);
    console.log(chalk.green('Added task:'), chalk.white(task), priorityLabel);
    
    // Show tasks status
    const count = await this.getPendingCount();
    console.log(chalk.gray(`You have ${count.total} tasks (${count.p1} urgent)`));
    
    return {
      success: true,
      message: `Task added with priority ${priority}`
    };
  }

  async interactiveAdd() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'task',
        message: 'What needs to be done?',
        validate: input => input.length > 0 || 'Task description is required'
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Priority level:',
        choices: [
          { name: `${chalk.red('P1')} - Urgent (do now)`, value: 1 },
          { name: `${chalk.yellow('P2')} - Important (do soon)`, value: 2 },
          { name: `${chalk.green('P3')} - Normal (when possible)`, value: 3 }
        ],
        default: 2
      }
    ]);

    const project = process.cwd().split('/').pop();

    await this.db.db.run(
      `INSERT INTO tasks (task, priority, project) VALUES (?, ?, ?)`,
      [answers.task, answers.priority, project]
    );

    const priorityLabel = this.getPriorityLabel(answers.priority);
    console.log(chalk.green('Done:'), `Added: ${chalk.white(answers.task)} ${priorityLabel}`);
    
    // Ask if want to add more
    const { addMore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addMore',
        message: 'Add another task?',
        default: false
      }
    ]);

    if (addMore) {
      return await this.interactiveAdd();
    }

    return {
      success: true,
      message: 'Task added'
    };
  }

  async detectOrAskPriority(task) {
    const taskLower = task.toLowerCase();
    
    // Detect urgency from keywords
    const urgentKeywords = ['urgent', 'critical', 'asap', 'emergency', 'broken', 'down', 'fix prod'];
    const importantKeywords = ['important', 'soon', 'today', 'review', 'deploy'];
    const normalKeywords = ['whenever', 'maybe', 'cleanup', 'refactor', 'docs', 'documentation'];

    let suggestedPriority = 3;
    let reason = '';

    if (urgentKeywords.some(kw => taskLower.includes(kw))) {
      suggestedPriority = 1;
      reason = 'Detected urgent keywords';
    } else if (importantKeywords.some(kw => taskLower.includes(kw))) {
      suggestedPriority = 2;
      reason = 'Detected important keywords';
    } else if (normalKeywords.some(kw => taskLower.includes(kw))) {
      suggestedPriority = 3;
      reason = 'Detected low-priority keywords';
    }

    // Ask for confirmation
    const priorityLabel = this.getPriorityLabel(suggestedPriority);
    const { priority } = await inquirer.prompt([
      {
        type: 'list',
        name: 'priority',
        message: `Priority for "${chalk.white(task)}"? ${reason ? chalk.gray(`(${reason})`) : ''}`,
        choices: [
          { name: `${chalk.red('P1')} - Urgent (do now)`, value: 1 },
          { name: `${chalk.yellow('P2')} - Important (do soon)`, value: 2 },
          { name: `${chalk.green('P3')} - Normal (when possible)`, value: 3 }
        ],
        default: suggestedPriority - 1
      }
    ]);

    return priority;
  }

  async nextTask(params) {
    const tasks = await this.db.db.all(
      `SELECT * FROM tasks 
       WHERE status = 'pending'
       ORDER BY priority ASC, created_at ASC
       LIMIT 5`
    );

    if (tasks.length === 0) {
      console.log(chalk.green(' No tasks pending! Great job!'));
      return {
        success: true,
        message: 'No pending tasks'
      };
    }

    const next = tasks[0];
    const priorityLabel = this.getPriorityLabel(next.priority);
    
    console.log(chalk.blue('\n> Do this next:'));
    console.log(`  ${priorityLabel} ${chalk.white.bold(next.task)}`);
    
    if (next.project && next.project !== process.cwd().split('/').pop()) {
      console.log(chalk.gray(`  Project: ${next.project}`));
    }

    // Show why this is next
    if (next.priority === 1) {
      const p1Count = tasks.filter(t => t.priority === 1).length;
      if (p1Count > 1) {
        console.log(chalk.red(`  Warning: You have ${p1Count} urgent items`));
      }
    }

    // Show what's coming up
    if (tasks.length > 1) {
      console.log(chalk.gray('\nComing up:'));
      tasks.slice(1, 4).forEach(task => {
        const pLabel = this.getPriorityLabel(task.priority);
        console.log(chalk.gray(`  ${pLabel} ${task.task}`));
      });
    }

    // Offer quick actions
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Action:',
        choices: [
          { name: 'Start working on this', value: 'start' },
          { name: 'Mark as done', value: 'done' },
          { name: 'Skip (show next)', value: 'skip' },
          { name: 'View all tasks', value: 'list' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'done':
        await this.markDone([next.task]);
        return await this.nextTask([]);
      case 'skip':
        // Show next by temporarily marking this as done, then undoing
        return await this.nextTask(['skip']);
      case 'list':
        return await this.listQueue([]);
      case 'start':
        console.log(chalk.green(' Good luck!'));
        return { success: true };
      default:
        return { success: true };
    }
  }

  async markDone(params) {
    if (params.length === 0) {
      // Mark the highest priority item as done
      const next = await this.db.db.get(
        `SELECT * FROM tasks 
         WHERE status = 'pending'
         ORDER BY priority ASC, created_at ASC
         LIMIT 1`
      );

      if (!next) {
        console.log(chalk.yellow('No pending tasks to mark done'));
        return { success: false, message: 'No pending tasks' };
      }

      await this.db.db.run(
        `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [next.id]
      );

      console.log(chalk.green('Done:'), `Completed: ${chalk.strikethrough(next.task)}`);
      
      // Show what's next
      return await this.nextTask([]);
    }

    // Try to find the task
    const query = params.join(' ');
    
    // Check if it's a priority marker (p1, p2, p3)
    if (['p1', 'p2', 'p3'].includes(query.toLowerCase())) {
      const priority = parseInt(query.replace('p', ''));
      const tasks = await this.db.db.all(
        `SELECT * FROM tasks WHERE status = 'pending' AND priority = ?`,
        [priority]
      );

      if (tasks.length === 0) {
        console.log(chalk.yellow(`No pending P${priority} tasks`));
        return { success: false };
      }

      // If multiple, ask which one
      if (tasks.length > 1) {
        const { selected } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selected',
            message: `Select P${priority} tasks to mark done:`,
            choices: tasks.map(t => ({
              name: t.task,
              value: t.id
            }))
          }
        ]);

        for (const id of selected) {
          await this.db.db.run(
            `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [id]
          );
        }

        console.log(chalk.green('Done:'), `Completed ${selected.length} tasks`);
      } else {
        await this.db.db.run(
          `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [tasks[0].id]
        );
        console.log(chalk.green('Done:'), `Completed: ${chalk.strikethrough(tasks[0].task)}`);
      }

      return { success: true };
    }

    // Try fuzzy match on task description
    const task = await this.db.db.get(
      `SELECT * FROM tasks 
       WHERE status = 'pending' AND task LIKE ?
       ORDER BY priority ASC
       LIMIT 1`,
      [`%${query}%`]
    );

    if (!task) {
      console.log(chalk.yellow(`No task found matching: ${query}`));
      return { success: false };
    }

    await this.db.db.run(
      `UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [task.id]
    );

    console.log(chalk.green('Done:'), `Completed: ${chalk.strikethrough(task.task)}`);
    
    const count = await this.getPendingCount();
    console.log(chalk.gray(`${count.total} tasks remaining`));

    return { success: true };
  }

  async listQueue(params) {
    const showAll = params.includes('--all') || params.includes('-a');
    
    const tasks = await this.db.db.all(
      showAll 
        ? `SELECT * FROM tasks ORDER BY status, priority ASC, created_at DESC`
        : `SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority ASC, created_at ASC`
    );

    if (tasks.length === 0) {
      console.log(chalk.green(' No tasks pending!'));
      return { success: true, message: 'No tasks found' };
    }

    // Group by priority
    const p1 = tasks.filter(t => t.priority === 1 && t.status === 'pending');
    const p2 = tasks.filter(t => t.priority === 2 && t.status === 'pending');
    const p3 = tasks.filter(t => t.priority === 3 && t.status === 'pending');
    const completed = tasks.filter(t => t.status === 'completed');

    console.log(chalk.blue(`\nYour Tasks (${tasks.filter(t => t.status === 'pending').length} items)`));
    console.log(chalk.gray('─'.repeat(40)));

    if (p1.length > 0) {
      console.log(chalk.red('\nP1 - Urgent'));
      p1.forEach((task, i) => {
        const age = this.getAge(task.created_at);
        console.log(`  ${chalk.white(task.task)} ${chalk.gray(age)}`);
      });
    }

    if (p2.length > 0) {
      console.log(chalk.yellow('\nP2 - Important'));
      p2.forEach(task => {
        const age = this.getAge(task.created_at);
        console.log(`  ${chalk.white(task.task)} ${chalk.gray(age)}`);
      });
    }

    if (p3.length > 0) {
      console.log(chalk.green('\nP3 - Normal'));
      p3.forEach(task => {
        const age = this.getAge(task.created_at);
        console.log(`  ${chalk.white(task.task)} ${chalk.gray(age)}`);
      });
    }

    if (showAll && completed.length > 0) {
      console.log(chalk.gray('\nDone: Completed'));
      completed.slice(0, 5).forEach(task => {
        console.log(chalk.gray(`  ${chalk.strikethrough(task.task)}`));
      });
      if (completed.length > 5) {
        console.log(chalk.gray(`  ... and ${completed.length - 5} more`));
      }
    }

    // Show summary
    const count = await this.getPendingCount();
    console.log(chalk.gray(`\nSummary: ${count.p1} urgent, ${count.p2} important, ${count.p3} normal`));

    return { success: true };
  }

  async suggest() {
    const tasks = await this.db.db.all(
      `SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority ASC, created_at ASC`
    );

    if (tasks.length === 0) {
      console.log(chalk.green(' No tasks! Enjoy your free time!'));
      return { success: true };
    }

    const count = await this.getPendingCount();
    const p1Tasks = tasks.filter(t => t.priority === 1);
    const oldestP1 = p1Tasks.length > 0 ? this.getAge(p1Tasks[0].created_at) : null;

    console.log(chalk.blue.bold('\n Task Analysis\n'));

    // Status
    if (count.p1 > 3) {
      console.log(chalk.red(`Warning:  High pressure: ${count.p1} urgent items`));
      console.log(chalk.gray('   Consider if all are truly urgent'));
    } else if (count.p1 > 0) {
      console.log(chalk.yellow(` Focus needed: ${count.p1} urgent items`));
    } else {
      console.log(chalk.green('Done:  No urgent items - good position'));
    }

    // Age analysis
    if (oldestP1 && oldestP1.includes('day')) {
      console.log(chalk.red(` Oldest P1 is ${oldestP1} - needs attention`));
    }

    // Workload estimate
    const totalItems = count.total;
    const estimatedHours = (count.p1 * 1) + (count.p2 * 0.5) + (count.p3 * 0.25);
    console.log(chalk.gray(`\n Estimated workload: ~${estimatedHours.toFixed(1)} hours`));

    // Suggestion
    console.log(chalk.blue('\n Suggestion:'));
    if (count.p1 > 0) {
      console.log('   1. Clear all P1 items first');
      console.log('   2. Block time for uninterrupted work');
      console.log(`   3. Delegate or defer P3 items if possible`);
    } else if (count.p2 > 3) {
      console.log('   1. Batch similar P2 items together');
      console.log('   2. Set aside 2-hour focus blocks');
    } else {
      console.log('   1. Good time for P3 items or learning');
      console.log('   2. Consider preventive work');
    }

    return { success: true };
  }

  async healthCheck() {
    const stats = await this.db.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'completed' AND date(completed_at) = date('now') THEN 1 ELSE 0 END) as completed_today
      FROM tasks
    `);

    const oldestPending = await this.db.db.get(`
      SELECT task, created_at, priority 
      FROM tasks 
      WHERE status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 1
    `);

    const completionRate = stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(1) : 0;

    console.log(chalk.blue.bold('\n Tasks Health Check\n'));
    
    // Overall health score
    let healthScore = 100;
    let issues = [];

    const count = await this.getPendingCount();
    if (count.p1 > 5) {
      healthScore -= 30;
      issues.push('Too many urgent items');
    }
    if (count.total > 20) {
      healthScore -= 20;
      issues.push('Too many tasks pending');
    }
    if (oldestPending && this.getAge(oldestPending.created_at).includes('week')) {
      healthScore -= 20;
      issues.push('Old unfinished tasks');
    }

    // Display health
    const healthColor = healthScore > 70 ? chalk.green : healthScore > 40 ? chalk.yellow : chalk.red;
    console.log(healthColor(`Health Score: ${healthScore}/100`));

    if (issues.length > 0) {
      console.log(chalk.red('\nWarning:  Issues:'));
      issues.forEach(issue => console.log(`   - ${issue}`));
    }

    // Stats
    console.log(chalk.gray('\n Statistics:'));
    console.log(`   Total items: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Completed: ${stats.completed} (${completionRate}%)`);
    console.log(`   Completed today: ${stats.completed_today}`);

    if (oldestPending) {
      console.log(chalk.gray('\n Oldest pending:'));
      console.log(`   ${oldestPending.task} (${this.getAge(oldestPending.created_at)})`);
    }

    return { success: true };
  }

  async clearCompleted() {
    const count = await this.db.db.get(
      `SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'`
    );

    if (count.count === 0) {
      console.log(chalk.yellow('No completed tasks to clear'));
      return { success: true };
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Clear ${count.count} completed tasks?`,
        default: false
      }
    ]);

    if (confirm) {
      await this.db.db.run(`DELETE FROM tasks WHERE status = 'completed'`);
      console.log(chalk.green('Done:'), `Cleared ${count.count} completed tasks`);
    }

    return { success: true };
  }

  async interactiveMenu() {
    const count = await this.getPendingCount();
    const statusText = count.total > 0 
      ? `${count.total} items (${count.p1} urgent)`
      : 'empty';

    const choices = [
      { name: 'Add new task', value: 'add' },
      { name: 'What should I do next?', value: 'next' },
      { name: 'View tasks', value: 'list' },
      { name: 'Mark task done', value: 'done' },
      { name: 'Get suggestions', value: 'suggest' },
      { name: 'Health check', value: 'health' },
      { name: 'Clear completed', value: 'clear' },
      { name: 'Exit', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `Task Management (${statusText}):`,
        choices: choices
      }
    ]);

    if (action === 'exit') {
      return { success: true };
    }

    return await this.execute([action]);
  }

  // Helper methods
  getPriorityLabel(priority) {
    switch(priority) {
      case 1: return chalk.red('[P1]');
      case 2: return chalk.yellow('[P2]');
      case 3: return chalk.green('[P3]');
      default: return chalk.gray('[P?]');
    }
  }

  getAge(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diff = now - created;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} old`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} old`;
    if (minutes > 0) return `${minutes} min old`;
    return 'just now';
  }

  async getPendingCount() {
    const result = await this.db.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN priority = 1 THEN 1 ELSE 0 END) as p1,
        SUM(CASE WHEN priority = 2 THEN 1 ELSE 0 END) as p2,
        SUM(CASE WHEN priority = 3 THEN 1 ELSE 0 END) as p3
      FROM tasks 
      WHERE status = 'pending'
    `);
    
    return {
      total: result.total || 0,
      p1: result.p1 || 0,
      p2: result.p2 || 0,
      p3: result.p3 || 0
    };
  }

  help() {
    const helpText = `
${chalk.blue('Tasks - Simple Priority Management')}

${chalk.yellow('Quick Commands:')}
  ${chalk.cyan('qalam tasks')}                    Interactive menu
  ${chalk.cyan('qalam tasks add "fix bug" p1')}  Add task with priority
  ${chalk.cyan('qalam tasks next')}               What should I do?
  ${chalk.cyan('qalam tasks done')}               Mark highest priority done
  ${chalk.cyan('qalam tasks list')}               View all pending tasks

${chalk.yellow('Priorities:')}
  ${chalk.red('P1')} - Urgent (do now)
  ${chalk.yellow('P2')} - Important (do soon)  
  ${chalk.green('P3')} - Normal (when possible)

${chalk.yellow('Shortcuts:')}
  ${chalk.cyan('qalam + "task"')}                 Quick add (will ask priority)
  ${chalk.cyan('qalam ++')}                       What's next?
  ${chalk.cyan('qalam -')}                        Mark done

${chalk.yellow('Management:')}
  ${chalk.cyan('qalam tasks suggest')}            Get AI suggestions
  ${chalk.cyan('qalam tasks health')}             Queue health check
  ${chalk.cyan('qalam tasks clear')}              Clear completed tasks`;

    console.log(helpText);
    
    return {
      success: true,
      message: 'Help displayed'
    };
  }
}