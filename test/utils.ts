import * as chai from "chai";
import { solidity, MockProvider } from "ethereum-waffle";
import { use } from "chai";
import { BigNumber, BigNumberish, parseEther } from "ethers/utils";
import { Wallet } from "ethers";
// TODO: importing gets this error:
// Could not find a declaration file for module '@eth-optimism/rollup-full-node'
// import { createMockProvider } from "@eth-optimism/rollup-full-node";
const { createMockProvider } = require("@eth-optimism/rollup-full-node");

export function mkXpub(prefix: string = "xpub"): string {
  return prefix.padEnd(111, "0");
}

export function mkAddress(prefix: string = "0x"): string {
  return prefix.padEnd(42, "0");
}

export function mkHash(prefix: string = "0x"): string {
  return prefix.padEnd(66, "0");
}

export function mkSig(prefix: string = "0x"): string {
  return prefix.padEnd(132, "0");
}

// ETH helpers
export type OvmProvider = MockProvider & { closeOVM: () => void };
export const createProvider = async (): Promise<OvmProvider> => {
  const provider = await createMockProvider();
  // TODO: doesnt work :(
  // const provider = await fullNode.addHandlerToProvider(new MockProvider());
  return provider;
};
export const mineBlock = async (provider: MockProvider) =>
  await provider.send("evm_mine", []);
export const snapshot = async (provider: MockProvider) =>
  await provider.send("evm_snapshot", []);
export const restore = async (snapshotId: any, provider: MockProvider) =>
  await provider.send("evm_revert", [snapshotId]);

// TODO: Not sure this works correctly/reliably...
export const moveToBlock = async (
  blockNumber: BigNumberish,
  provider: MockProvider
) => {
  const desired: BigNumber = new BigNumber(blockNumber);
  const current: BigNumber = new BigNumber(await provider.getBlockNumber());
  if (current.gt(desired)) {
    throw new Error(
      `Already at block ${current.toNumber()}, cannot rewind to ${blockNumber.toString()}`
    );
  }
  if (current.eq(desired)) {
    return;
  }
  for (const _ of Array(desired.sub(current).toNumber())) {
    await mineBlock(provider);
  }
  const final: BigNumber = new BigNumber(await provider.getBlockNumber());
  expect(final).to.be.eq(desired);
};

use(require("chai-subset"));
use(solidity);
export const expect = chai.use(solidity).expect;

// funds recipient with a given amount of eth from other provider accounts
export const fund = async (
  amount: BigNumber,
  recipient: Wallet,
  provider: MockProvider
) => {
  for (const wallet of await provider.getWallets()) {
    if (wallet.address === recipient.address) {
      continue;
    }
    const current = await provider.getBalance(recipient.address);
    const diff = amount.sub(current);
    if (diff.lte(0)) {
      // account has max int, done
      return;
    }
    const funderBalance = await provider.getBalance(wallet.address);
    // leave 1 eth in account for gas or w.e
    const fundAmount = funderBalance.sub(parseEther("1"));
    if (fundAmount.lte(0)) {
      // funder has insufficient funds, move on
      continue;
    }
    // send transaction
    await wallet.sendTransaction({
      to: recipient.address,
      value: fundAmount.gt(diff) ? diff : fundAmount,
    });
  }
  const final = await provider.getBalance(recipient.address);
  if (final.lt(amount)) {
    throw new Error(
      `Insufficient funds after funding to max. Off by: ${final
        .sub(amount)
        .abs()
        .toString()}`
    );
  }
};

export function sortByAddress(a: string, b: string) {
  return new BigNumber(a).lt(new BigNumber(b)) ? -1 : 1;
}

export function sortAddresses(addrs: string[]) {
  return addrs.sort(sortByAddress);
}
