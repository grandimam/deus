# Creating Custom Skills

Extend Qalam's functionality by creating your own custom skills. Skills are modular plugins that add new commands and features.

## Skill Structure

### Basic Skill Template

```javascript
// ~/.qalam/skills/myskill.js

import Skill from './base-skill.js';
import chalk from 'chalk';

class MySkill extends Skill {
  constructor() {
    super('myskill', 'Description of what my skill does');
  }

  async execute(args) {
    const [action, ...params] = args;
    
    switch (action) {
      case 'hello':
        return this.sayHello(params[0]);
      case 'help':
        return this.help();
      default:
        return chalk.red('Unknown action. Use "myskill help"');
    }
  }

  sayHello(name = 'World') {
    return chalk.green(`Hello, ${name}!`);
  }

  help() {
    return `
${chalk.bold('MySkill - Custom Skill Example')}

${chalk.cyan('Usage:')}
  myskill hello [name]    Say hello to someone
  myskill help           Show this help message

${chalk.cyan('Examples:')}
  myskill hello
  myskill hello Alice
    `;
  }
}

export default MySkill;
```

### Required Methods

Every skill must implement:

1. **constructor()** - Initialize skill with name and description
2. **execute(args)** - Main entry point for skill execution
3. **help()** - Return help text for the skill

## Installation

### 1. Create Skills Directory

```bash
mkdir -p ~/.qalam/skills
```

### 2. Create Your Skill File

```bash
touch ~/.qalam/skills/myskill.js
```

### 3. Enable Auto-loading

```bash
qalam config set skills.autoLoad true
```

### 4. Test Your Skill

```bash
qalam myskill hello
# Output: Hello, World!
```

## Advanced Features

### Using External Packages

```javascript
import axios from 'axios';
import ora from 'ora';

class ApiSkill extends Skill {
  async execute(args) {
    const spinner = ora('Fetching data...').start();
    
    try {
      const response = await axios.get('https://api.example.com/data');
      spinner.succeed('Data fetched successfully');
      return JSON.stringify(response.data, null, 2);
    } catch (error) {
      spinner.fail('Failed to fetch data');
      return chalk.red(error.message);
    }
  }
}
```

### Database Integration

```javascript
import Database from '../../core/database.js';

class DataSkill extends Skill {
  constructor() {
    super('data', 'Manage custom data');
    this.db = new Database();
  }

  async execute(args) {
    const [action, ...params] = args;
    
    switch (action) {
      case 'save':
        return this.saveData(params[0], params[1]);
      case 'get':
        return this.getData(params[0]);
      default:
        return this.help();
    }
  }

  async saveData(key, value) {
    await this.db.run(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      [key, value]
    );
    return chalk.green(`Saved: ${key} = ${value}`);
  }

  async getData(key) {
    const row = await this.db.get(
      'SELECT value FROM config WHERE key = ?',
      [key]
    );
    return row ? row.value : chalk.yellow('Not found');
  }
}
```

### Interactive Prompts

```javascript
import inquirer from 'inquirer';

class InteractiveSkill extends Skill {
  async execute(args) {
    if (args[0] === 'setup') {
      return this.interactiveSetup();
    }
    return this.help();
  }

  async interactiveSetup() {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is your name?',
        default: 'User'
      },
      {
        type: 'list',
        name: 'color',
        message: 'Choose a color:',
        choices: ['red', 'green', 'blue', 'yellow']
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save settings?',
        default: true
      }
    ]);

    if (answers.confirm) {
      // Save settings
      return chalk.green('Settings saved!');
    }
    return chalk.yellow('Cancelled');
  }
}
```

### Subprocess Execution

```javascript
import { execa } from 'execa';

class GitSkill extends Skill {
  async execute(args) {
    const [action, ...params] = args;
    
    switch (action) {
      case 'status':
        return this.gitStatus();
      case 'branch':
        return this.gitBranch(params[0]);
      default:
        return this.help();
    }
  }

  async gitStatus() {
    try {
      const { stdout } = await execa('git', ['status', '--short']);
      return stdout || chalk.green('Working tree clean');
    } catch (error) {
      return chalk.red('Not a git repository');
    }
  }

  async gitBranch(name) {
    if (!name) {
      const { stdout } = await execa('git', ['branch']);
      return stdout;
    }
    
    try {
      await execa('git', ['checkout', '-b', name]);
      return chalk.green(`Created and switched to branch: ${name}`);
    } catch (error) {
      return chalk.red(error.message);
    }
  }
}
```

## Real-World Examples

### Deployment Skill

```javascript
class DeploySkill extends Skill {
  constructor() {
    super('deploy', 'Deployment automation');
  }

  async execute(args) {
    const [environment, ...options] = args;
    
    const validEnvs = ['dev', 'staging', 'prod'];
    if (!validEnvs.includes(environment)) {
      return chalk.red(`Invalid environment. Use: ${validEnvs.join(', ')}`);
    }

    return this.deploy(environment, options);
  }

  async deploy(env, options) {
    const steps = [
      { name: 'Running tests', cmd: ['npm', 'test'] },
      { name: 'Building application', cmd: ['npm', 'run', `build:${env}`] },
      { name: 'Deploying to AWS', cmd: ['aws', 's3', 'sync', 'dist/', `s3://bucket-${env}/`] }
    ];

    for (const step of steps) {
      const spinner = ora(step.name).start();
      try {
        await execa(step.cmd[0], step.cmd.slice(1));
        spinner.succeed();
      } catch (error) {
        spinner.fail();
        return chalk.red(`Deployment failed: ${error.message}`);
      }
    }

    return chalk.green(`✅ Successfully deployed to ${env}`);
  }
}
```

### Database Backup Skill

```javascript
class BackupSkill extends Skill {
  constructor() {
    super('backup', 'Database backup management');
  }

  async execute(args) {
    const [action] = args;
    
    switch (action) {
      case 'create':
        return this.createBackup();
      case 'restore':
        return this.restoreBackup(args[1]);
      case 'list':
        return this.listBackups();
      default:
        return this.help();
    }
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `backup-${timestamp}.sql`;
    
    try {
      await execa('pg_dump', [
        '-h', 'localhost',
        '-U', 'user',
        '-d', 'database',
        '-f', `./backups/${filename}`
      ]);
      
      return chalk.green(`Backup created: ${filename}`);
    } catch (error) {
      return chalk.red(`Backup failed: ${error.message}`);
    }
  }

  async restoreBackup(filename) {
    if (!filename) {
      return chalk.red('Please specify a backup file');
    }

    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'This will replace the current database. Continue?',
      default: false
    }]);

    if (!confirm.proceed) {
      return chalk.yellow('Restore cancelled');
    }

    try {
      await execa('psql', [
        '-h', 'localhost',
        '-U', 'user',
        '-d', 'database',
        '-f', `./backups/${filename}`
      ]);
      
      return chalk.green('Database restored successfully');
    } catch (error) {
      return chalk.red(`Restore failed: ${error.message}`);
    }
  }
}
```

## Best Practices

### Error Handling

```javascript
async execute(args) {
  try {
    // Your skill logic
    return await this.performAction(args);
  } catch (error) {
    // Log error for debugging
    if (process.env.DEBUG) {
      console.error(error);
    }
    
    // Return user-friendly message
    return chalk.red(`Error: ${error.message}`);
  }
}
```

### Input Validation

```javascript
async execute(args) {
  // Validate required arguments
  if (!args[0]) {
    return chalk.red('Missing required argument') + '\n' + this.help();
  }

  // Validate argument format
  const email = args[0];
  if (!email.includes('@')) {
    return chalk.red('Invalid email format');
  }

  return this.processEmail(email);
}
```

### Progress Feedback

```javascript
async longRunningTask() {
  const spinner = ora('Processing...').start();
  
  try {
    // Step 1
    spinner.text = 'Fetching data...';
    await this.fetchData();
    
    // Step 2
    spinner.text = 'Processing data...';
    await this.processData();
    
    // Step 3
    spinner.text = 'Saving results...';
    await this.saveResults();
    
    spinner.succeed('Task completed successfully');
    return chalk.green('Done!');
  } catch (error) {
    spinner.fail('Task failed');
    throw error;
  }
}
```

## Testing Your Skills

### Manual Testing

```bash
# Test basic functionality
qalam myskill hello

# Test with parameters
qalam myskill hello Alice

# Test error handling
qalam myskill invalid-action
```

### Unit Testing

```javascript
// test/myskill.test.js
import MySkill from '../skills/myskill.js';

describe('MySkill', () => {
  const skill = new MySkill();

  test('says hello', async () => {
    const result = await skill.execute(['hello']);
    expect(result).toContain('Hello, World!');
  });

  test('says hello with name', async () => {
    const result = await skill.execute(['hello', 'Alice']);
    expect(result).toContain('Hello, Alice!');
  });
});
```

## Publishing Skills

### Share with Others

1. Create a repository for your skill
2. Add installation instructions
3. Share the repository URL

### Installation from Git

```bash
# Clone skill repository
git clone https://github.com/user/qalam-skill-example.git
cp qalam-skill-example/skill.js ~/.qalam/skills/
```

## Troubleshooting

### Skill Not Loading

1. Check file location: `~/.qalam/skills/`
2. Verify auto-load is enabled: `qalam config get skills.autoLoad`
3. Check for syntax errors: `node -c ~/.qalam/skills/myskill.js`
4. Ensure proper export: `export default MySkill;`

### Import Errors

```javascript
// Use correct import paths
import Skill from '../../src/core/skillManager.js';  // ❌ Wrong
import Skill from './base-skill.js';                 // ✅ Correct
```

### Permission Issues

```bash
# Ensure skills directory has correct permissions
chmod 755 ~/.qalam/skills
chmod 644 ~/.qalam/skills/*.js
```