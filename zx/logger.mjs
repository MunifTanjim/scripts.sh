export class Logger {
  #typeMap = {
    "": "     ",
    error: chalk.red("error"),
    info: chalk.blue(" info"),
    input: chalk.magenta("input"),
    warn: chalk.yellow(" warn"),
  };

  constructor(service) {
    this.service = service;
  }

  fmt = (type, message) => {
    const string = [this.service, this.#typeMap[type], message]
      .filter(Boolean)
      .join(" ");
    return string;
  };

  #log = (type, message, ...args) => {
    console.log(this.fmt(type, message), ...args);
  };

  error = (message, ...args) => this.#log("error", message, ...args);
  info = (message, ...args) => this.#log("info", message, ...args);
  log = (message, ...args) => this.#log("", message, ...args);
  warn = (message, ...args) => this.#log("warn", message, ...args);
}
