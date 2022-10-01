export class Logger {
  #typeMap = {
    '': '     ',
    error: chalk.red('error'),
    info: chalk.blue(' info'),
    input: chalk.magenta('input'),
    warn: chalk.yellow(' warn'),
  };

  constructor(service) {
    this.service = service;
  }

  fmt = (type, message) => {
    const string = [this.service, this.#typeMap[type], message]
      .filter(Boolean)
      .join(' ');

    return string;
  };

  #log = (type, message) => {
    console.log(this.fmt(type, message));
  };

  error = (message) => this.#log('error', message);
  info = (message) => this.#log('info', message);
  log = (message) => this.#log('', message);
  warn = (message) => this.#log('warn', message);
}
