import pkg from "../../package.json";

export function version(): void {
  console.log(`ec ${pkg.version}`);
}
