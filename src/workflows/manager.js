import chalk from "chalk";
import { execa } from "execa";
import ora from "ora";
import { getDatabase } from "../core/database.js";

export class WorkflowManager {
  constructor() {
    this.db = null;
  }

  async init() {
    if (!this.db) {
      this.db = await getDatabase();
    }
  }

  async save(name, commands, options = {}) {
    await this.init();
    
    if (!name || !commands) {
      return {
        success: false,
        message: "Name and commands are required",
      };
    }
    
    const commandArray = Array.isArray(commands) ? commands : [commands];
    
    try {
      await this.db.saveWorkflow(name, commandArray, options);
      
      return {
        success: true,
        message: `Workflow '${name}' saved with ${commandArray.length} commands`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save workflow: ${error.message}`,
      };
    }
  }

  async get(name) {
    await this.init();
    
    const workflow = await this.db.getWorkflow(name);
    if (!workflow) {
      return {
        success: false,
        message: `Workflow '${name}' not found`,
      };
    }
    
    return {
      success: true,
      workflow: workflow,
    };
  }

  async execute(name, vars = {}) {
    await this.init();
    
    console.log(chalk.blue(`\nExecuting workflow: ${name}`));
    
    const workflow = await this.db.getWorkflow(name);
    if (!workflow) {
      return {
        success: false,
        message: `Workflow '${name}' not found`,
      };
    }

    // Merge variables
    const variables = { ...workflow.variables, ...vars };

    const spinner = ora({
      text: `Running ${workflow.commands.length} commands...`,
      color: "cyan",
    });

    if (workflow.parallel) {
      spinner.text = `Running ${workflow.commands.length} commands in parallel...`;
      spinner.start();
      
      try {
        const promises = workflow.commands.map((cmd) => 
          this.executeCommand(this.replaceVariables(cmd, variables))
        );
        
        const results = await Promise.allSettled(promises);
        spinner.stop();
        
        const failed = results.filter(r => r.status === 'rejected');
        
        if (failed.length > 0) {
          console.log(chalk.yellow(`${failed.length} commands failed`));
          failed.forEach((r, i) => {
            console.log(chalk.red(`  Command ${i + 1}: ${r.reason}`));
          });
          
          return {
            success: false,
            message: `Workflow completed with ${failed.length} failures`,
          };
        }
        
        console.log(chalk.green("✓"), `All ${workflow.commands.length} commands completed successfully`);
        return {
          success: true,
          message: "Workflow completed successfully",
        };
      } catch (error) {
        spinner.stop();
        return {
          success: false,
          message: `Workflow failed: ${error.message}`,
        };
      }
    } else {
      // Sequential execution
      let failed = false;
      
      for (let i = 0; i < workflow.commands.length; i++) {
        const command = this.replaceVariables(workflow.commands[i], variables);
        
        spinner.text = `[${i + 1}/${workflow.commands.length}] ${command}`;
        spinner.start();
        
        try {
          await this.executeCommand(command);
          spinner.succeed(chalk.green(`[${i + 1}/${workflow.commands.length}] ${command}`));
        } catch (error) {
          spinner.fail(chalk.red(`[${i + 1}/${workflow.commands.length}] ${command}`));
          console.log(chalk.red(`  Error: ${error.message}`));
          
          if (!workflow.continue_on_error) {
            return {
              success: false,
              message: `Workflow failed at command ${i + 1}`,
            };
          }
          
          failed = true;
          console.log(chalk.yellow("  Continuing despite error..."));
        }
      }
      
      if (failed && workflow.continue_on_error) {
        console.log(chalk.yellow("⚠"), "Workflow completed with errors");
        return {
          success: true,
          message: "Workflow completed with errors",
        };
      }
      
      console.log(chalk.green("✓"), "Workflow completed successfully");
      return {
        success: true,
        message: "Workflow completed successfully",
      };
    }
  }

  async executeCommand(command) {
    try {
      const result = await execa(command, { shell: true });
      if (result.stdout) {
        console.log(chalk.gray(result.stdout));
      }
      return result;
    } catch (error) {
      throw new Error(error.stderr || error.message);
    }
  }

  replaceVariables(command, variables) {
    let result = command;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), value);
      result = result.replace(new RegExp(`\\$${key}`, "g"), value);
    }
    return result;
  }

  async list() {
    await this.init();
    
    try {
      const workflows = await this.db.listWorkflows();
      
      if (workflows.length === 0) {
        return {
          success: false,
          message: "No workflows found",
        };
      }

      return {
        success: true,
        workflows: workflows.map(w => ({
          name: w.name,
          description: w.description,
          commands: w.commandCount,
          parallel: w.parallel,
          continueOnError: w.continue_on_error,
          executionCount: w.execution_count,
          lastExecuted: w.last_executed,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list workflows: ${error.message}`,
      };
    }
  }

  async show(name) {
    await this.init();
    
    const workflow = await this.db.getWorkflow(name);
    
    if (!workflow) {
      return {
        success: false,
        message: `Workflow '${name}' not found`,
      };
    }

    const output = `
${chalk.blue(`Workflow: ${name}`)}
${workflow.description ? chalk.gray(`Description: ${workflow.description}`) : ""}
${chalk.gray(`Commands: ${workflow.commands.length}`)}
${chalk.gray(`Parallel: ${workflow.parallel ? "Yes" : "No"}`)}
${chalk.gray(`Continue on Error: ${workflow.continue_on_error ? "Yes" : "No"}`)}
${chalk.gray(`Executed: ${workflow.execution_count} times`)}
${workflow.last_executed ? chalk.gray(`Last Run: ${new Date(workflow.last_executed).toLocaleString()}`) : ""}

${chalk.yellow("Commands:")}
${workflow.commands.map((cmd, i) => `  ${i + 1}. ${cmd}`).join("\n")}

${Object.keys(workflow.variables).length > 0 ? 
  `${chalk.yellow("Variables:")}\n${Object.entries(workflow.variables)
    .map(([k, v]) => `  ${k} = ${v}`)
    .join("\n")}` : ""}
`;

    console.log(output);
    
    return {
      success: true,
      output: output,
    };
  }

  async remove(name) {
    await this.init();
    
    try {
      const deleted = await this.db.deleteWorkflow(name);
      
      if (deleted) {
        return {
          success: true,
          message: `Workflow '${name}' removed`,
        };
      } else {
        return {
          success: false,
          message: `Workflow '${name}' not found`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to remove workflow: ${error.message}`,
      };
    }
  }

  async search(query) {
    await this.init();
    
    try {
      const workflows = await this.db.searchWorkflows(query);
      
      if (workflows.length === 0) {
        return {
          success: false,
          message: `No workflows found matching '${query}'`,
        };
      }

      return {
        success: true,
        workflows: workflows.map(w => ({
          name: w.name,
          description: w.description,
          commands: w.commandCount,
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: `Search failed: ${error.message}`,
      };
    }
  }

  async duplicate(source, target, options = {}) {
    await this.init();
    
    const workflow = await this.db.getWorkflow(source);
    
    if (!workflow) {
      return {
        success: false,
        message: `Source workflow '${source}' not found`,
      };
    }

    const newOptions = {
      description: options.description || workflow.description,
      parallel: options.parallel !== undefined ? options.parallel : workflow.parallel,
      continueOnError: options.continueOnError !== undefined 
        ? options.continueOnError 
        : workflow.continue_on_error,
      variables: options.variables || workflow.variables,
    };

    return await this.save(target, workflow.commands, newOptions);
  }

  async export(name) {
    await this.init();
    
    const workflow = await this.db.getWorkflow(name);
    
    if (!workflow) {
      return {
        success: false,
        message: `Workflow '${name}' not found`,
      };
    }

    const exportData = {
      name: workflow.name,
      description: workflow.description,
      commands: workflow.commands,
      parallel: workflow.parallel,
      continueOnError: workflow.continue_on_error,
      variables: workflow.variables,
      version: "1.0",
      exported: new Date().toISOString(),
    };

    const filename = `${name}-workflow.json`;
    const fs = await import("fs/promises");
    await fs.writeFile(filename, JSON.stringify(exportData, null, 2));

    return {
      success: true,
      message: `Workflow exported to ${filename}`,
    };
  }

  async import(filename) {
    const fs = await import("fs/promises");
    
    try {
      const content = await fs.readFile(filename, "utf-8");
      const data = JSON.parse(content);

      if (!data.name || !data.commands) {
        throw new Error("Invalid workflow file format");
      }

      const options = {
        description: data.description || "",
        parallel: data.parallel || false,
        continueOnError: data.continueOnError || false,
        variables: data.variables || {},
      };

      return await this.save(data.name, data.commands, options);
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error.message}`,
      };
    }
  }
}