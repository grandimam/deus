import { spawn } from "child_process";
import ora from "ora";

export class AIHelper {
  constructor(config) {
    this.config = config;
    this.provider = "claude-code";
  }

  async askClaudeCode(question) {
    return new Promise((resolve, reject) => {
      const claude = spawn("claude", ["-p"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let output = "";
      let errorOutput = "";

      claude.stdout.on("data", (data) => {
        output += data.toString();
      });

      claude.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      claude.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Claude CLI error: ${
                errorOutput || `Process exited with code ${code}`
              }. Make sure claude is installed and configured.`
            )
          );
        } else {
          resolve(output.trim());
        }
      });

      claude.on("error", (error) => {
        reject(
          new Error(
            `Failed to spawn claude process: ${error.message}. Make sure claude is installed and configured.`
          )
        );
      });

      // Send the question through stdin and close it
      claude.stdin.write(question);
      claude.stdin.end();
    });
  }

  async planAndExecute(description) {
    const spinner = ora({
      text: "Analyzing your request...",
      color: "cyan",
    }).start();

    try {
      spinner.text = "Getting AI recommendations...";
      const response = await this.askClaudeCode(description);
      spinner.stop();

      return {
        success: true,
        plan: response,
      };
    } catch (error) {
      spinner.stop();
      throw error;
    }
  }
}
