import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { WorkflowManager } from '../workflows/index.js';

export class InteractiveMode {
  constructor(cli) {
    this.cli = cli;
    this.workflowManager = new WorkflowManager();
    this.running = false;
  }

  async start() {
    this.running = true;
    console.log(chalk.blue('Welcome to Qalam Interactive Mode!'));
    console.log(chalk.gray('Type "help" for available commands, "exit" to quit\n'));

    while (this.running) {
      const { command } = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: chalk.green('>'),
          prefix: '',
          transformer: (input) => {
            const parts = input.split(' ');
            if (parts[0]) {
              if (this.cli.skillManager.hasSkill(parts[0])) {
                return chalk.cyan(parts[0]) + ' ' + parts.slice(1).join(' ');
              }
              if (['help', 'exit', 'skills', 'clear', 'stats', 'workflow', 'memory'].includes(parts[0])) {
                return chalk.yellow(parts[0]) + ' ' + parts.slice(1).join(' ');
              }
            }
            return input;
          }
        }
      ]);

      if (command.trim()) {
        await this.handleCommand(command.trim());
      }
    }
  }

  async handleCommand(command) {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case 'exit':
      case 'quit':
        this.running = false;
        console.log(chalk.blue('Goodbye!'));
        break;
      
      case 'help':
        this.showHelp();
        break;
      
      case 'clear':
        console.clear();
        break;
      
      case 'skills':
        this.cli.listSkills();
        break;
      
      case 'stats':
        this.showStats();
        break;
      
      case 'config':
        this.cli.manageConfig(...args);
        break;
      
      case 'suggest':
        await this.getSuggestions();
        break;
      
      case 'ask':
        await this.askAI(args.join(' '));
        break;
      
      case 'workflow':
        await this.handleWorkflow(args);
        break;

      case 'memory':
        // Delegate to memory command handler
        const memoryCommand = this.cli.memoryCommands || this.cli.skillManager.getSkill('memory');
        if (memoryCommand) {
          await memoryCommand.execute(args);
        } else {
          console.log(chalk.red('Memory commands not available'));
        }
        break;
      
      default:
        if (this.cli.skillManager.hasSkill(cmd)) {
          await this.runSkill(cmd, args);
        } else {
          console.log(chalk.red(`Unknown command: ${cmd}`));
          console.log(chalk.gray('Type "help" for available commands'));
        }
    }
  }

  async runSkill(skillName, args) {
    const spinner = ora({
      text: `Running ${skillName}...`,
      color: 'cyan'
    }).start();
    
    try {
      const skill = this.cli.skillManager.getSkill(skillName);
      const result = await skill.execute(args);
      
      spinner.stop();
      
      if (result.success) {
        console.log(chalk.green('✓'), result.message);
        if (result.output) {
          console.log(result.output);
        }
      } else {
        console.log(chalk.red('✗'), result.message);
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error.message);
    }
  }

  async getSuggestions() {
    const skills = this.cli.skillManager.getAllSkills();
    
    console.log(chalk.blue('\nAvailable skills:'));
    
    // Suggest commonly used skills
    const commonSkills = skills.slice(0, 5);
    console.log(chalk.yellow('\nQuick actions:'));
    commonSkills.forEach(skill => {
      console.log(chalk.cyan(`  ${skill.name}`), chalk.gray(`- ${skill.description}`));
    });

    console.log(chalk.gray('\nTip: Use "memory search <keyword>" to find saved commands'));
  }

  showStats() {
    const skills = this.cli.skillManager.getAllSkills();
    const workflows = this.workflowManager.list();
    
    console.log(chalk.blue('\nSystem Statistics:'));
    console.log(chalk.gray('Available skills:'), skills.length);
    if (workflows.success) {
      console.log(chalk.gray('Saved workflows:'), workflows.workflows.length);
    }
    
    console.log(chalk.gray('\nUse "memory list" to see saved commands'));
    console.log(chalk.gray('Use "workflow list" to see saved workflows'));
  }

  async askAI(question) {
    if (!question) {
      const { aiQuestion } = await inquirer.prompt([
        {
          type: 'input',
          name: 'aiQuestion',
          message: 'What would you like help with?'
        }
      ]);
      question = aiQuestion;
    }
    
    await this.cli.askAI(question);
  }

  async handleWorkflow(args) {
    const [action, ...params] = args;
    
    if (!action) {
      console.log(chalk.blue('Workflow Commands:'));
      console.log(chalk.gray('  workflow create <name> <cmd1> [cmd2...]  - Create a new workflow'));
      console.log(chalk.gray('  workflow run <name> [--vars key=val]     - Run a workflow'));
      console.log(chalk.gray('  workflow list                            - List all workflows'));
      console.log(chalk.gray('  workflow show <name>                     - Show workflow details'));
      console.log(chalk.gray('  workflow remove <name>                   - Delete a workflow'));
      console.log(chalk.gray('  workflow search <query>                  - Search workflows'));
      return;
    }
    
    switch (action) {
      case 'create':
      case 'save': {
        let name;
        if (params.length > 0) {
          name = params[0];
        } else {
          const { workflowName } = await inquirer.prompt([
            {
              type: 'input',
              name: 'workflowName',
              message: 'Enter workflow name:',
              validate: input => input.trim() ? true : 'Workflow name is required'
            }
          ]);
          name = workflowName;
        }
        
        console.log(chalk.blue(`Creating workflow: ${name}`));
        console.log(chalk.gray('Add commands one by one. Press Enter with empty command to finish.'));
        
        const commands = [];
        let addingCommands = true;
        let commandIndex = 1;
        
        while (addingCommands) {
          const { command } = await inquirer.prompt([
            {
              type: 'input',
              name: 'command',
              message: chalk.yellow(`Command ${commandIndex}:`),
              prefix: ''
            }
          ]);
          
          if (command.trim()) {
            commands.push(command.trim());
            console.log(chalk.green(`  ✓ Added: ${command.trim()}`));
            commandIndex++;
          } else {
            addingCommands = false;
          }
        }
        
        if (commands.length === 0) {
          console.log(chalk.red('No commands added. Workflow creation cancelled.'));
          return;
        }
        
        const { description, parallel, continueOnError, addVariables } = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'Workflow description (optional):',
            default: ''
          },
          {
            type: 'confirm',
            name: 'parallel',
            message: 'Run commands in parallel?',
            default: false
          },
          {
            type: 'confirm',
            name: 'continueOnError',
            message: 'Continue on error?',
            default: false
          },
          {
            type: 'confirm',
            name: 'addVariables',
            message: 'Add variables to this workflow?',
            default: false
          }
        ]);
        
        const variables = {};
        if (addVariables) {
          console.log(chalk.gray('Add variables (key=value). Press Enter with empty input to finish.'));
          let addingVars = true;
          
          while (addingVars) {
            const { variable } = await inquirer.prompt([
              {
                type: 'input',
                name: 'variable',
                message: 'Variable (key=value):',
                prefix: ''
              }
            ]);
            
            if (variable.trim()) {
              const [key, ...valueParts] = variable.split('=');
              const value = valueParts.join('=');
              if (key && value) {
                variables[key] = value;
                console.log(chalk.green(`  ✓ Added: ${key}=${value}`));
              } else {
                console.log(chalk.yellow('  Invalid format. Use key=value'));
              }
            } else {
              addingVars = false;
            }
          }
        }
        
        console.log(chalk.blue('\nWorkflow Summary:'));
        console.log(chalk.gray(`  Name: ${name}`));
        console.log(chalk.gray(`  Commands: ${commands.length}`));
        commands.forEach((cmd, i) => {
          console.log(chalk.gray(`    ${i + 1}. ${cmd}`));
        });
        if (description) console.log(chalk.gray(`  Description: ${description}`));
        console.log(chalk.gray(`  Parallel: ${parallel}`));
        console.log(chalk.gray(`  Continue on error: ${continueOnError}`));
        if (Object.keys(variables).length > 0) {
          console.log(chalk.gray(`  Variables:`));
          Object.entries(variables).forEach(([k, v]) => {
            console.log(chalk.gray(`    ${k}=${v}`));
          });
        }
        
        const { confirmSave } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmSave',
            message: 'Save this workflow?',
            default: true
          }
        ]);
        
        if (confirmSave) {
          const result = this.workflowManager.save(name, commands, {
            description,
            parallel,
            continueOnError,
            variables
          });
          
          console.log(result.success ? chalk.green('✓') : chalk.red('✗'), result.message);
        } else {
          console.log(chalk.yellow('Workflow creation cancelled'));
        }
        break;
      }
      
      case 'run':
      case 'execute': {
        const [name] = params;
        if (!name) {
          const workflows = this.workflowManager.list();
          if (!workflows.success || workflows.workflows.length === 0) {
            console.log(chalk.yellow('No workflows available'));
            return;
          }
          
          const { selectedWorkflow } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedWorkflow',
              message: 'Select a workflow to run:',
              choices: workflows.workflows.map(w => ({
                name: `${w.name} - ${w.description || 'No description'}`,
                value: w.name
              }))
            }
          ]);
          
          const result = await this.workflowManager.execute(selectedWorkflow);
          if (!result.success) {
            console.log(chalk.red('✗'), result.message);
          }
        } else {
          const result = await this.workflowManager.execute(name);
          if (!result.success) {
            console.log(chalk.red('✗'), result.message);
          }
        }
        break;
      }
      
      case 'list': {
        const result = this.workflowManager.list();
        if (!result.success) {
          console.log(chalk.yellow(result.message));
          return;
        }
        
        console.log(chalk.blue('Available Workflows:'));
        result.workflows.forEach(w => {
          const desc = w.description ? chalk.gray(` - ${w.description}`) : '';
          const stats = chalk.gray(` (${w.commands} commands, executed ${w.executionCount || 0} times)`);
          console.log(chalk.green(`  ${w.name}`) + desc + stats);
        });
        break;
      }
      
      case 'show':
      case 'get': {
        const [name] = params;
        if (!name) {
          console.log(chalk.red('Workflow name required'));
          return;
        }
        
        const result = this.workflowManager.show(name);
        if (result.success) {
          console.log(result.output);
        } else {
          console.log(chalk.red('✗'), result.message);
        }
        break;
      }
      
      case 'remove':
      case 'delete': {
        const [name] = params;
        if (!name) {
          console.log(chalk.red('Workflow name required'));
          return;
        }
        
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete workflow '${name}'?`,
            default: false
          }
        ]);
        
        if (confirm) {
          const result = this.workflowManager.remove(name);
          console.log(result.success ? chalk.green('✓') : chalk.red('✗'), result.message);
        }
        break;
      }
      
      case 'search': {
        const query = params.join(' ');
        if (!query) {
          console.log(chalk.red('Search query required'));
          return;
        }
        
        const result = this.workflowManager.search(query);
        if (!result.success) {
          console.log(chalk.yellow(result.message));
          return;
        }
        
        console.log(chalk.blue(`Workflows matching '${query}':`));
        result.workflows.forEach(w => {
          const desc = w.description ? chalk.gray(` - ${w.description}`) : '';
          console.log(chalk.green(`  ${w.name}`) + desc);
        });
        break;
      }
      
      default:
        console.log(chalk.red(`Unknown workflow action: ${action}`));
    }
  }

  showHelp() {
    console.log(chalk.blue('\nAvailable Commands:'));
    console.log(chalk.yellow('  help'), chalk.gray('- Show this help message'));
    console.log(chalk.yellow('  skills'), chalk.gray('- List all available skills'));
    console.log(chalk.yellow('  memory <action>'), chalk.gray('- Manage saved commands'));
    console.log(chalk.yellow('  stats'), chalk.gray('- Show system statistics'));
    console.log(chalk.yellow('  suggest'), chalk.gray('- Get command suggestions'));
    console.log(chalk.yellow('  ask <question>'), chalk.gray('- Ask AI for help and suggestions'));
    console.log(chalk.yellow('  workflow <action>'), chalk.gray('- Manage and run workflows'));
    console.log(chalk.yellow('  config <action> [key] [value]'), chalk.gray('- Manage configuration'));
    console.log(chalk.yellow('  clear'), chalk.gray('- Clear the screen'));
    console.log(chalk.yellow('  exit'), chalk.gray('- Exit interactive mode'));
    
    const skills = this.cli.skillManager.getAllSkills();
    if (skills.length > 0) {
      console.log(chalk.blue('\nAvailable Skills:'));
      skills.forEach(skill => {
        console.log(chalk.green(`  ${skill.name}`), chalk.gray(`- ${skill.description}`));
      });
      console.log(chalk.gray('\nRun any skill by typing its name followed by arguments'));
    }

    console.log(chalk.blue('\nMemory Commands:'));
    console.log(chalk.gray('  memory save <name> "<command>" - Save a command'));
    console.log(chalk.gray('  memory get <name>              - Get a saved command'));
    console.log(chalk.gray('  memory list                     - List all saved commands'));
    console.log(chalk.gray('  memory search <query>           - Search saved commands'));
  }
}