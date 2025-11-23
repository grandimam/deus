import { Command } from "commander";
import chalk from "chalk";
import { SkillManager } from "./core/skillManager.js";
import MemoryCommands from "./memory/commands.js";
import { WorkflowManager } from "./workflows/index.js";
import { Config } from "./core/config.js";
import { InteractiveMode } from "./core/interactive.js";
import { AIHelper } from "./core/aiHelper.js";

export class CLI {
  constructor() {
    this.program = new Command();
    this.skillManager = new SkillManager();
    this.memoryCommands = new MemoryCommands();
    this.workflowManager = new WorkflowManager();
    this.config = new Config();
    this.aiHelper = new AIHelper(this.config);
    this.setupCommands();
  }

  async ensureInitialized() {
    if (this.skillManager.initialized) {
      await this.skillManager.initialized;
    }
  }

  setupCommands() {
    this.program
      .name("qalam")
      .description(
        "The pen that never forgets - Your intelligent CLI assistant"
      )
      .version("1.0.0")
      .configureHelp({
        formatHelp: (cmd, helper) => this.formatCustomHelp(cmd, helper),
      });

    // Hidden low-level command - not shown in help
    this.program
      .command("run <skill> [args...]", { hidden: true })
      .description("Run a skill with optional arguments")
      .action(async (skill, args) => {
        await this.runSkill(skill, args);
      });

    this.program
      .command("memory [action] [args...]")
      .description("Save and recall commands/snippets")
      .action(async (action, args) => {
        const allArgs = action ? [action, ...args] : [];
        const result = await this.memoryCommands.execute(allArgs);

        if (result.success) {
          console.log(chalk.green("✓"), result.message);
          if (result.output && !result.execute) {
            console.log(result.output);
          }

          // If there's a command to execute, run it
          if (result.execute) {
            console.log(chalk.yellow("\nExecuting command..."));
            try {
              const { execa } = await import("execa");
              await execa(result.execute, [], {
                shell: true,
                stdio: "inherit",
              });
            } catch (error) {
              console.log(chalk.red(`\nExecution failed: ${error.message}`));
            }
          }
        } else {
          console.log(chalk.red("✗"), result.message);
        }
      });

    this.program
      .command("service [action] [args...]")
      .description("Manage development services")
      .action(async (action, args) => {
        const allArgs = action ? [action, ...args] : [];
        await this.runSkill("service", allArgs);
      });

    this.program
      .command("http [action] [args...]")
      .description("HTTP client with Postman import")
      .action(async (action, args) => {
        const allArgs = action ? [action, ...args] : [];
        await this.runSkill("http", allArgs);
      });

    this.program
      .command("tasks [action] [args...]")
      .description("Simple priority task management")
      .action(async (action, args) => {
        const allArgs = action ? [action, ...args] : [];
        await this.runSkill("tasks", allArgs);
      });

    this.program
      .command("login [profile]")
      .description("Start your day - authenticate and setup cluster")
      .action(async (profile) => {
        const args = profile ? [profile] : [];
        await this.runSkill("login", args);
      });

    this.program
      .command("logout")
      .description("End your day - cleanup and logout")
      .action(async () => {
        await this.runSkill("logout", []);
      });

    this.program
      .command("cluster [name] [namespace]")
      .description("Switch between clusters and namespaces")
      .action(async (name, namespace) => {
        const args = [];
        if (name) args.push(name);
        if (namespace) args.push(namespace);
        await this.runSkill("cluster", args);
      });

    this.program
      .command("shell <service> [options...]")
      .description("Kubernetes shell access")
      .action(async (service, options) => {
        await this.runSkill("shell", [service, ...options]);
      });

    this.program
      .command("interactive")
      .alias("i")
      .description("Start interactive mode")
      .action(async () => {
        const interactive = new InteractiveMode(this);
        await interactive.start();
      });

    this.program
      .command("skills")
      .description("List available skills")
      .action(async () => {
        await this.listSkills();
      });

    this.program
      .command("config <action> [key] [value]")
      .description("Manage configuration (get/set/list)")
      .action((action, key, value) => {
        this.manageConfig(action, key, value);
      });

    this.program
      .command("ask <question...>")
      .description("Ask AI for suggestions and commands")
      .action(async (question) => {
        await this.askAI(question.join(" "));
      });

    this.program
      .command("workflow <action> [args...]")
      .description("Manage and execute workflows")
      .option("-p, --parallel", "Run commands in parallel")
      .option("-c, --continue", "Continue on error")
      .option("-d, --description <desc>", "Workflow description")
      .option("-v, --vars <vars...>", "Variables as key=value pairs")
      .action(async (action, args, options) => {
        await this.manageWorkflow(action, args, options);
      });
  }

  async runSkill(skillName, args) {
    try {
      await this.ensureInitialized();
      const skill = this.skillManager.getSkill(skillName);
      if (!skill) {
        console.log(chalk.red(`Skill "${skillName}" not found`));
        console.log(chalk.yellow("Available skills:"));
        this.listSkills();
        return;
      }

      const result = await skill.execute(args);

      if (result.success) {
        if (result.message) {
          console.log(chalk.green("✓"), result.message);
        }
        if (result.output) {
          console.log(result.output);
        }
      } else {
        if (result.message) {
          console.log(chalk.red("✗"), result.message);
        }
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
    }
  }

  async listSkills() {
    await this.ensureInitialized();
    const skills = this.skillManager.getAllSkills();
    if (skills.length === 0) {
      console.log(chalk.yellow("No skills registered"));
      return;
    }

    console.log(chalk.blue("Available Skills:"));
    skills.forEach((skill) => {
      console.log(
        chalk.green(`  ${skill.name}`),
        chalk.gray(`- ${skill.description}`)
      );
    });
  }

  manageConfig(action, key, value) {
    switch (action) {
      case "get":
        if (!key) {
          console.log(chalk.red("Key is required for get action"));
          return;
        }
        const val = this.config.get(key);
        console.log(chalk.blue(`${key}:`), val || chalk.gray("(not set)"));
        break;

      case "set":
        if (!key || !value) {
          console.log(chalk.red("Key and value are required for set action"));
          return;
        }
        this.config.set(key, value);
        console.log(chalk.green("✓"), `${key} set to ${value}`);
        break;

      case "list":
        const all = this.config.getAll();
        if (Object.keys(all).length === 0) {
          console.log(chalk.yellow("No configuration found"));
          return;
        }
        console.log(chalk.blue("Configuration:"));
        Object.entries(all).forEach(([k, v]) => {
          console.log(chalk.gray(`  ${k}:`), v);
        });
        break;

      default:
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.yellow("Available actions: get, set, list"));
    }
  }

  async askAI(question) {
    try {
      const result = await this.aiHelper.planAndExecute(question);
      console.log(result.plan);
    } catch (error) {
      console.error(chalk.red("AI Error:"), error.message);
    }
  }

  async manageWorkflow(action, args, options) {
    switch (action) {
      case "create":
      case "save": {
        const [name, ...commands] = args;

        // If no name provided or no commands, enter interactive mode
        if (!name || commands.length === 0) {
          const interactive = new InteractiveMode(this);
          await interactive.handleWorkflow(["create", name].filter(Boolean));
          return;
        }

        const workflowOptions = {
          description: options.description || "",
          parallel: options.parallel || false,
          continueOnError: options.continue || false,
          variables: {},
        };

        if (options.vars) {
          options.vars.forEach((v) => {
            const [key, value] = v.split("=");
            if (key && value) {
              workflowOptions.variables[key] = value;
            }
          });
        }

        const result = this.workflowManager.save(
          name,
          commands,
          workflowOptions
        );
        console.log(
          result.success ? chalk.green("✓") : chalk.red("✗"),
          result.message
        );
        break;
      }

      case "run":
      case "execute": {
        const [name] = args;
        if (!name) {
          console.log(chalk.red("Workflow name is required"));
          return;
        }

        const variables = {};
        if (options.vars) {
          options.vars.forEach((v) => {
            const [key, value] = v.split("=");
            if (key && value) {
              variables[key] = value;
            }
          });
        }

        const result = await this.workflowManager.execute(name, variables);
        if (!result.success) {
          console.log(chalk.red("✗"), result.message);
        }
        break;
      }

      case "list": {
        const result = await this.workflowManager.interactiveList();
        if (!result.success) {
          console.log(chalk.yellow(result.message));
          return;
        }

        console.log(chalk.blue("Available Workflows:"));
        result.workflows.forEach((w) => {
          const desc = w.description ? chalk.gray(` - ${w.description}`) : "";
          const stats = chalk.gray(
            ` (${w.commands} commands, executed ${w.executionCount || 0} times)`
          );
          console.log(chalk.green(`  ${w.name}`) + desc + stats);
        });
        break;
      }

      case "show":
      case "get": {
        const [name] = args;
        if (!name) {
          console.log(chalk.red("Workflow name is required"));
          return;
        }

        const result = this.workflowManager.show(name);
        if (result.success) {
          console.log(result.output);
        } else {
          console.log(chalk.red("✗"), result.message);
        }
        break;
      }

      case "remove":
      case "delete": {
        const [name] = args;
        if (!name) {
          console.log(chalk.red("Workflow name is required"));
          return;
        }

        const result = this.workflowManager.remove(name);
        console.log(
          result.success ? chalk.green("✓") : chalk.red("✗"),
          result.message
        );
        break;
      }

      case "search": {
        const query = args.join(" ");
        if (!query) {
          console.log(chalk.red("Search query is required"));
          return;
        }

        const result = this.workflowManager.search(query);
        if (!result.success) {
          console.log(chalk.yellow(result.message));
          return;
        }

        console.log(chalk.blue(`Workflows matching '${query}':`));
        result.workflows.forEach((w) => {
          const desc = w.description ? chalk.gray(` - ${w.description}`) : "";
          console.log(chalk.green(`  ${w.name}`) + desc);
        });
        break;
      }

      case "duplicate":
      case "copy": {
        const [source, target] = args;
        if (!source || !target) {
          console.log(
            chalk.red("Source and target workflow names are required")
          );
          console.log(
            chalk.yellow("Usage: qalam workflow duplicate <source> <target>")
          );
          return;
        }

        const result = this.workflowManager.duplicate(source, target);
        console.log(
          result.success ? chalk.green("✓") : chalk.red("✗"),
          result.message
        );
        break;
      }

      default:
        if (!action) {
          // No action provided, show interactive menu
          const result = await this.workflowManager.interactiveMenu();
          if (!result.success && result.message) {
            console.log(chalk.red("✗"), result.message);
          }
        } else {
          console.log(chalk.red(`Unknown workflow action: ${action}`));
          console.log(
            chalk.yellow(
              "Available actions: create, run, list, show, remove, search, duplicate"
            )
          );
        }
    }
  }

  formatCustomHelp(cmd, helper) {
    const terminalWidth = process.stdout.columns || 80;
    const indent = "  ";

    let helpText = "";

    // Title
    helpText += chalk.bold.blue(
      "\n Qalam is a tool for automating daily development tasks\n\n"
    );
    helpText += chalk.yellow("Usage:\n");
    helpText += `${indent}qalam [command] [options]\n\n`;

    helpText += chalk.yellow("Core\n");
    const coreCommands = [
      { name: "tasks", desc: "Priority task management" },
      { name: "memory", desc: "Save and recall commands/snippets" },
      { name: "workflow", desc: "Manage and execute workflows" },
      { name: "ask", desc: "Ask AI for help and suggestions" },
      { name: "skills", desc: "List all available skills" },
    ];

    coreCommands.forEach((cmd) => {
      const command = cmd.name.padEnd(15);
      helpText += `${indent}${chalk.cyan(command)} ${chalk.gray(cmd.desc)}\n`;
    });

    // Custom Commands
    helpText += chalk.yellow("\nSkills\n");
    const infraCommands = [
      { name: "login", desc: "Authenticate and setup cluster" },
      { name: "logout", desc: "End session - cleanup and logout" },
      { name: "cluster", desc: "Switch between clusters/namespaces" },
      { name: "shell", desc: "Kubernetes shell access" },
      { name: "service", desc: "Manage development services" },
      { name: "http", desc: "HTTP client with Postman import" },
      { name: "config", desc: "Manage configuration" },
    ];

    infraCommands.forEach((cmd) => {
      const command = cmd.name.padEnd(15);
      helpText += `${indent}${chalk.cyan(command)} ${chalk.gray(cmd.desc)}\n`;
    });

    helpText += "\n";

    // Footer
    helpText += chalk.gray("─".repeat(Math.min(60, terminalWidth - 2)) + "\n");
    helpText += chalk.gray(`Version ${cmd.version()} • `);
    helpText += chalk.gray("Use ");
    helpText += chalk.cyan("qalam [command] --help");
    helpText += chalk.gray(" for command details\n\n");

    return helpText;
  }

  run(args) {
    if (args.length === 0) {
      const interactive = new InteractiveMode(this);
      interactive.start();
    } else {
      this.program.parse(["node", "qalam", ...args]);
    }
  }
}
