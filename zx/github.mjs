import assert from "assert";
import { CacheFile } from "./cache.mjs";
import { Logger } from "./logger.mjs";

const read_file = async (filename) => {
  return await fs.readFile(filename, { encoding: "utf8" });
};

const generate_ssh_keypair = async (comment = "git-mirror") => {
  const filename = "/tmp/git-mirror-key";

  $`rm -f ${filename} ${filename}.pub`;

  await $`ssh-keygen -t ed25519 -C ${comment} -N '' -f ${filename}`;

  const [privateKey, publicKey] = await Promise.all([
    read_file(filename),
    read_file(`${filename}.pub`),
  ]);

  $`rm -f ${filename} ${filename}.pub`;

  return { privateKey, publicKey };
};

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

  /**
   * @param {string} endpoint
   * @param {object} [options]
   * @param {Record<string, string>} [options.headers]
   * @param {Record<string, string>} [options.fields]
   * @param {Record<string, string>} [options.rawFields]
   * @param {string} [options.jq]
   * @param {boolean} [options.noParse]
   * @param {string[]} [options.params]
   */
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

  ensureDeployKey = async (title) => {
    let res = await this.api("/repos/{owner}/{repo}/keys", {
      jq: `.[] | select(.title=="${title}")`,
    });

    if (!res.ok) {
      throw res;
    }

    if (res.data) {
      res = await this.api(`DELETE /repos/{owner}/{repo}/keys/${res.data.id}`);

      if (!res.ok) {
        this.log.info(`Failed to remove old deploy key (${title})`);
        throw res;
      }

      this.log.info(`Removed old deploy key (${title})`);
    }

    const keypair = await generate_ssh_keypair(title);

    res = await this.api("POST /repos/{owner}/{repo}/keys", {
      fields: {
        title: title,
        key: keypair.publicKey,
        read_only: true,
      },
    });

    if (!res.ok) {
      this.log.error(`Failed to add deploy key (${title})`);
      throw res;
    }

    this.log.info(`Added deploy key (${title})`);

    return keypair;
  };
}
