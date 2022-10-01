import { Logger } from "./logger.mjs";

export class Tailscale {
  log = new Logger(chalk.bgBlackBright.bold.dim("  tailscale "));

  getMachines = async () => {
    this.log.info("Fetching Machines...");

    const machines = [];

    const { BackendState, Self, Peer, MagicDNSSuffix } = JSON.parse(
      await $`tailscale status --json`
    );

    if (BackendState !== "Running") {
      this.log.error(`Backend is ${BackendState}!`);
      this.log.log("Run `tailscale up` to continue.");
      process.exit(1);
    }

    const patternToRemove = new RegExp(`\\.${MagicDNSSuffix}\\.?`);

    machines.push({
      name: Self.DNSName.replace(patternToRemove, ""),
      ip: Self.TailscaleIPs[0],
    });

    for (const { DNSName, TailscaleIPs } of Object.values(Peer)) {
      machines.push({
        name: DNSName.replace(patternToRemove, ""),
        ip: TailscaleIPs[0],
      });
    }

    this.log.info(`${machines.length} Machines found!`);

    return machines;
  };
}
