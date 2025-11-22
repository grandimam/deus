#!/usr/bin/env node

import { CLI } from "../src/index.js";

const cli = new CLI();
cli.run(process.argv.slice(2));
