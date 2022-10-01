export class CacheFile {
  constructor(name) {
    this.cachePath = `${os.homedir()}/.cache/@muniftanjim/${name}`;
    this.content = null;
    this.exists = false;
  }

  #ensure = async () => {
    if (this.content && this.exists) {
      return;
    }

    const cacheDir = String(await $`dirname ${this.cachePath}`).trim();

    try {
      await fs.access(cacheDir);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }

      await fs.mkdir(cacheDir, { recursive: true });
    }

    try {
      const content = await fs.readFile(this.cachePath, { encoding: 'utf8' });
      this.content = JSON.parse(content);
    } catch (err) {
      this.content = {};
      await fs.writeFile(this.cachePath, JSON.stringify(this.content), {
        encoding: 'utf8',
      });
    }

    this.exists = true;
  };

  read = async () => {
    await this.#ensure();
    return this;
  };

  write = async () => {
    if (!this.content) {
      this.content = {};
    }

    await this.#ensure();
    fs.writeFile(this.cachePath, JSON.stringify(this.content), {
      encoding: 'utf8',
    });

    return this;
  };
}
