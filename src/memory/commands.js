import { Skill } from '../core/skillManager.js';
import chalk from 'chalk';
import { getDatabase } from '../core/database.js';
import inquirer from 'inquirer';

export default class MemoryCommands extends Skill {
  constructor() {
    super('memory', 'Save and recall commands/snippets');
    this.db = null;
  }

  async init() {
    if (!this.db) {
      this.db = await getDatabase();
    }
  }

  async execute(args) {
    await this.init();
    
    const [action, ...params] = args;

    switch (action) {
      case 'save':
      case 'add':
        return await this.saveCommand(params);
      
      case 'get':
      case 'recall':
        return await this.getCommand(params[0]);
      
      case 'list':
      case 'ls':
        return await this.interactiveList();
      
      case 'search':
      case 'find':
        return await this.searchCommands(params.join(' '));
      
      case 'delete':
      case 'remove':
      case 'rm':
        return await this.deleteCommand(params[0]);
      
      case 'edit':
      case 'update':
        return await this.editCommand(params);
      
      case 'stats':
        return await this.showStats();
      
      case 'export':
        return await this.exportCommands(params[0]);
      
      case 'import':
        return await this.importCommands(params[0]);
      
      default:
        if (!action) {
          return await this.interactiveMenu();
        }
        // If no action, treat first arg as name to get
        return await this.getCommand(action);
    }
  }

  async saveCommand(params) {
    const [name, ...rest] = params;
    
    if (!name || rest.length === 0) {
      return {
        success: false,
        message: 'Usage: qalam memory save <name> "<command>" [description]'
      };
    }

    // Parse command and description
    let command, description = '', tags = '';
    
    // If the command is wrapped in quotes, it's the entire first param after name
    if (rest[0] && (rest[0].startsWith('"') || rest[0].startsWith("'"))) {
      command = rest[0];
      description = rest.slice(1).join(' ');
    } else {
      // Find where description might start (after the command)
      const joinedRest = rest.join(' ');
      const match = joinedRest.match(/^(.+?)(?:\s+"([^"]*)")?$/);
      if (match) {
        command = match[1];
        description = match[2] || '';
      } else {
        command = joinedRest;
      }
    }

    // Remove quotes from command if present
    command = command.replace(/^["']|["']$/g, '');

    // Extract tags from description if present (e.g., #docker #build)
    const tagMatch = description.match(/#\w+/g);
    if (tagMatch) {
      tags = tagMatch.join(' ');
      description = description.replace(/#\w+/g, '').trim();
    }

    try {
      await this.db.saveCommand(name, command, description, tags);
      
      console.log(chalk.green('✓'), `Command saved as '${name}'`);
      console.log(chalk.gray('  Command:'), command);
      if (description) {
        console.log(chalk.gray('  Description:'), description);
      }
      if (tags) {
        console.log(chalk.gray('  Tags:'), tags);
      }
      
      return {
        success: true,
        message: `Command '${name}' saved successfully`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save command: ${error.message}`
      };
    }
  }

  async getCommand(name) {
    if (!name) {
      return {
        success: false,
        message: 'Command name required'
      };
    }

    try {
      const command = await this.db.getCommand(name);
      
      if (!command) {
        // Try searching if exact match not found
        const results = await this.db.searchCommands(name);
        if (results.length > 0) {
          console.log(chalk.yellow(`Command '${name}' not found. Did you mean:`));
          results.slice(0, 3).forEach(cmd => {
            console.log(chalk.cyan(`  ${cmd.name}`), chalk.gray(`- ${cmd.command.substring(0, 50)}...`));
          });
        } else {
          console.log(chalk.red(`Command '${name}' not found`));
        }
        return {
          success: false,
          message: `Command '${name}' not found`
        };
      }

      // Display the command
      console.log(chalk.blue(command.command));
      
      // Show metadata
      if (command.description) {
        console.log(chalk.gray(`# ${command.description}`));
      }
      console.log(chalk.gray(`# Used ${command.usage_count} times`));
      
      return {
        success: true,
        message: command.command,
        output: command.command
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get command: ${error.message}`
      };
    }
  }

  async listCommands(limitStr) {
    const limit = limitStr ? parseInt(limitStr) : 20;
    
    try {
      const commands = await this.db.listCommands(limit);
      
      if (commands.length === 0) {
        console.log(chalk.yellow('No saved commands yet'));
        console.log(chalk.gray('Save your first command with:'), chalk.cyan('qalam memory save <name> "<command>"'));
        return {
          success: true,
          message: 'No saved commands'
        };
      }

      console.log(chalk.blue(`Saved Commands (${commands.length}):\n`));
      
      commands.forEach(cmd => {
        const desc = cmd.description ? chalk.gray(` - ${cmd.description}`) : '';
        const usage = chalk.gray(` (used ${cmd.usage_count}x)`);
        const cmdPreview = cmd.command.length > 50 
          ? cmd.command.substring(0, 50) + '...' 
          : cmd.command;
        
        console.log(chalk.green(`  ${cmd.name.padEnd(20)}`), chalk.white(cmdPreview) + desc + usage);
      });
      
      console.log(chalk.gray('\nUse'), chalk.cyan('qalam memory get <name>'), chalk.gray('to recall a command'));
      
      return {
        success: true,
        message: `Listed ${commands.length} commands`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list commands: ${error.message}`
      };
    }
  }

  async searchCommands(query) {
    if (!query) {
      return {
        success: false,
        message: 'Search query required'
      };
    }

    try {
      const results = await this.db.searchCommands(query);
      
      if (results.length === 0) {
        console.log(chalk.yellow(`No commands found matching '${query}'`));
        return {
          success: true,
          message: 'No matching commands'
        };
      }

      console.log(chalk.blue(`Commands matching '${query}':\n`));
      
      results.forEach(cmd => {
        const desc = cmd.description ? chalk.gray(` - ${cmd.description}`) : '';
        const tags = cmd.tags ? chalk.cyan(` ${cmd.tags}`) : '';
        console.log(chalk.green(`  ${cmd.name}`), chalk.gray(`(used ${cmd.usage_count}x)`));
        console.log(chalk.white(`    ${cmd.command}`) + desc + tags);
      });
      
      return {
        success: true,
        message: `Found ${results.length} matching commands`
      };
    } catch (error) {
      return {
        success: false,
        message: `Search failed: ${error.message}`
      };
    }
  }

  async deleteCommand(name) {
    if (!name) {
      return {
        success: false,
        message: 'Command name required'
      };
    }

    try {
      const deleted = await this.db.deleteCommand(name);
      
      if (deleted) {
        console.log(chalk.green('✓'), `Command '${name}' deleted`);
        return {
          success: true,
          message: `Command '${name}' deleted`
        };
      } else {
        console.log(chalk.red(`Command '${name}' not found`));
        return {
          success: false,
          message: `Command '${name}' not found`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete command: ${error.message}`
      };
    }
  }

  async editCommand(params) {
    const [name, ...rest] = params;
    
    if (!name || rest.length === 0) {
      return {
        success: false,
        message: 'Usage: qalam memory edit <name> "<new-command>"'
      };
    }

    try {
      // First check if command exists
      const existing = await this.db.getCommand(name);
      if (!existing) {
        return {
          success: false,
          message: `Command '${name}' not found`
        };
      }

      const newCommand = rest.join(' ').replace(/^["']|["']$/g, '');
      
      // Update the command (keeping description and tags)
      await this.db.saveCommand(name, newCommand, existing.description, existing.tags);
      
      console.log(chalk.green('✓'), `Command '${name}' updated`);
      console.log(chalk.gray('  Old:'), existing.command);
      console.log(chalk.gray('  New:'), newCommand);
      
      return {
        success: true,
        message: `Command '${name}' updated`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to edit command: ${error.message}`
      };
    }
  }

  async showStats() {
    try {
      const stats = await this.db.getStats();
      
      console.log(chalk.blue('Memory Statistics:\n'));
      console.log(chalk.gray('  Total saved commands:'), stats.totalCommands);
      console.log(chalk.gray('  Total workflows:'), stats.totalWorkflows);
      
      if (stats.mostUsedCommand) {
        console.log(chalk.gray('  Most used command:'), 
          chalk.cyan(stats.mostUsedCommand.name), 
          chalk.gray(`(${stats.mostUsedCommand.usage_count} uses)`));
      }
      
      if (stats.mostExecutedWorkflow) {
        console.log(chalk.gray('  Most executed workflow:'), 
          chalk.cyan(stats.mostExecutedWorkflow.name), 
          chalk.gray(`(${stats.mostExecutedWorkflow.execution_count} runs)`));
      }
      
      return {
        success: true,
        message: 'Statistics displayed'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get statistics: ${error.message}`
      };
    }
  }

  async exportCommands(filename) {
    if (!filename) {
      filename = `qalam-commands-${new Date().toISOString().split('T')[0]}.json`;
    }

    try {
      const commands = await this.db.listCommands(1000);
      const data = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        commands: commands
      };

      const fs = await import('fs/promises');
      await fs.writeFile(filename, JSON.stringify(data, null, 2));
      
      console.log(chalk.green('✓'), `Exported ${commands.length} commands to ${filename}`);
      
      return {
        success: true,
        message: `Exported to ${filename}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Export failed: ${error.message}`
      };
    }
  }

  async importCommands(filename) {
    if (!filename) {
      return {
        success: false,
        message: 'Filename required for import'
      };
    }

    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filename, 'utf-8');
      const data = JSON.parse(content);
      
      if (!data.commands || !Array.isArray(data.commands)) {
        throw new Error('Invalid import file format');
      }

      let imported = 0;
      let skipped = 0;
      
      for (const cmd of data.commands) {
        try {
          await this.db.saveCommand(cmd.name, cmd.command, cmd.description || '', cmd.tags || '');
          imported++;
        } catch (e) {
          // Probably duplicate, skip it
          skipped++;
        }
      }
      
      console.log(chalk.green('✓'), `Imported ${imported} commands`);
      if (skipped > 0) {
        console.log(chalk.yellow(`  Skipped ${skipped} duplicates`));
      }
      
      return {
        success: true,
        message: `Imported ${imported} commands`
      };
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error.message}`
      };
    }
  }

  async interactiveList() {
    try {
      const commands = await this.db.listCommands(100);
      
      if (commands.length === 0) {
        console.log(chalk.yellow('No saved commands yet'));
        console.log(chalk.gray('Save your first command with:'), chalk.cyan('qalam memory save <name> "<command>"'));
        return {
          success: true,
          message: 'No saved commands'
        };
      }

      // Build choices for inquirer
      const choices = commands.map(cmd => {
        const usage = chalk.gray(`(${cmd.usage_count}x)`);
        const desc = cmd.description ? chalk.gray(` - ${cmd.description}`) : '';
        const preview = cmd.command.length > 40 
          ? cmd.command.substring(0, 40) + '...' 
          : cmd.command;
        
        return {
          name: `${chalk.green(cmd.name.padEnd(20))} ${chalk.white(preview)}${desc} ${usage}`,
          value: cmd.name,
          short: cmd.name
        };
      });

      choices.push(new inquirer.Separator());
      choices.push({ name: chalk.gray('Exit'), value: '__exit__' });

      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Select a command to run:',
          choices: choices,
          pageSize: 20
        }
      ]);

      if (selected === '__exit__') {
        return { success: true };
      }

      // Get and execute the selected command
      const command = await this.db.getCommand(selected);
      console.log(chalk.blue(command.command));
      
      const { execute } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'execute',
          message: 'Execute this command?',
          default: true
        }
      ]);

      if (execute) {
        console.log(chalk.yellow('\nExecuting command...'));
        try {
          const { execa } = await import('execa');
          await execa(command.command, [], {
            shell: true,
            stdio: 'inherit'
          });
        } catch (error) {
          console.log(chalk.red(`\nExecution failed: ${error.message}`));
        }
      }
      
      return {
        success: true,
        message: command.command
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list commands: ${error.message}`
      };
    }
  }

  async interactiveMenu() {
    const choices = [
      { name: 'List and run saved commands', value: 'list' },
      { name: 'Save a new command', value: 'save' },
      { name: 'Search commands', value: 'search' },
      { name: 'View statistics', value: 'stats' },
      { name: 'Export commands', value: 'export' },
      { name: 'Exit', value: '__exit__' }
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Memory Commands:',
        choices: choices
      }
    ]);

    switch (action) {
      case 'list':
        return await this.interactiveList();
      
      case 'save':
        const { name, command, description } = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Command name:',
            validate: input => input.length > 0 || 'Name is required'
          },
          {
            type: 'input',
            name: 'command',
            message: 'Command to save:',
            validate: input => input.length > 0 || 'Command is required'
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):'
          }
        ]);
        return await this.saveCommand([name, command, description]);
      
      case 'search':
        const { query } = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'Search query:'
          }
        ]);
        return await this.searchCommands(query);
      
      case 'stats':
        return await this.showStats();
      
      case 'export':
        const { filename } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filename',
            message: 'Export filename (optional):',
            default: `qalam-commands-${new Date().toISOString().split('T')[0]}.json`
          }
        ]);
        return await this.exportCommands(filename);
      
      case '__exit__':
        return { success: true };
    }
  }

  help() {
    const helpText = `
${chalk.blue('Memory Commands - Save and recall command snippets')}

${chalk.yellow('Interactive Mode:')}
  ${chalk.cyan('qalam memory')}                  Interactive menu
  ${chalk.cyan('qalam memory list')}             Select and run from list

${chalk.yellow('Usage:')}
  ${chalk.cyan('qalam memory save build "npm run build && npm test" "Build and test"')}
  ${chalk.cyan('qalam memory save deploy "git push origin main && npm deploy"')}
  ${chalk.cyan('qalam memory build')}            Get the 'build' command
  ${chalk.cyan('qalam memory list')}             Show all saved commands
  ${chalk.cyan('qalam memory search git')}       Find git-related commands`;

    console.log(helpText);
    
    return {
      success: true,
      message: 'Help displayed'
    };
  }
}