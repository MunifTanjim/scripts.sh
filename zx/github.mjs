import assert from "assert";
import { CacheFile } from "./cache.mjs";
import { Logger } from "./logger.mjs";

export class GitHub {
  #cache;

  constructor({ id }) {
    this.id = id.trim();
    assert(Boolean(this.id), "missing id");

    this.#cache = new CacheFile(`github/${this.id}`);
  }

  log = new Logger(chalk.bgBlackBright.white(" github "));

  init = async () => {
    return this;
  };

  api = async (endpoint, options = {}) => {
    const params = [];

    const [, method, path] = endpoint.match(/^(?:([A-Z]+) )?(.+)$/);

    if (method) {
      params.push("--method", method);
    }

    for (const [key, value] of Object.entries(options.headers ?? {})) {
      params.push("-H", `${key}:${value}`);
    }

    for (const [key, value] of Object.entries(options.fields ?? {})) {
      params.push("-F", `${key}=${value}`);
    }

    for (const [key, value] of Object.entries(options.rawFields ?? {})) {
      params.push("-f", `${key}=${value}`);
    }

    if (options.jq) {
      params.push("--jq", options.jq);
    }

    params.push(...(options.params ?? []));

    let ret;
    try {
      ret = await $`gh api -i ${path} ${params}`;
    } catch (err) {
      ret = err;
    }

    const [meta, blob] = ret.stdout.split("\r\n\r\n");

    const ok = ret.exitCode === 0;
    const [, status] = meta.split("\n")[0].match(/^HTTP\/.+ (\d+) .+$/);

    const noParse = options.noParse ?? false;

    let data = blob;
    if (noParse) {
      data = data.trim();
    } else {
      data = JSON.parse(blob || "null");
      if (data && Object.keys(data).length == 1 && data.data) {
        data = data.data;
      }
    }

    return {
      ok,
      status: Number(status),
      data,
      error: ret.stderr ? { message: ret.stderr.trim() } : null,
    };
  };
}
