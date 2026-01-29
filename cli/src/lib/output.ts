export function success(message: string): void {
  console.log(`✓ ${message}`);
}

export function error(message: string): void {
  console.error(`✗ ${message}`);
}

export function info(message: string): void {
  console.log(message);
}

export function warn(message: string): void {
  console.log(`⚠ ${message}`);
}

export function verbose(message: string, isVerbose: boolean): void {
  if (isVerbose) {
    console.log(`[debug] ${message}`);
  }
}
