import {
  ConditionalTransactionCommitmentJSON,
  MultisigOperation,
  NetworkContext,
} from "@connext/types";

import { AddressZero } from "ethers/constants";
import { Interface } from "ethers/utils";

import * as ConditionalTransactionDelegateTarget from "../artifacts/ConditionalTransactionDelegateTarget.json";

import { MultisigCommitment } from "./multisig-commitment";

const iface = new Interface(ConditionalTransactionDelegateTarget.abi as any);

// class to represent an unsigned multisignature wallet transaction
// to the ConditionalTransactionDelegateTarget contract.
export class ConditionalTransactionCommitment extends MultisigCommitment {
  constructor(
    public readonly networkContext: NetworkContext,
    public readonly multisig: string,
    public readonly multisigOwners: string[],
    public readonly appIdentityHash: string,
    public readonly freeBalanceAppIdentityHash: string,
    public readonly interpreterAddr: string,
    public readonly interpreterParams: string,
    initiatorSignature?: string,
    responderSignature?: string
  ) {
    super(multisig, multisigOwners, initiatorSignature, responderSignature);
    if (interpreterAddr === AddressZero) {
      throw Error(
        "The outcome type in this application logic contract is not supported yet."
      );
    }
  }

  toJson(): ConditionalTransactionCommitmentJSON {
    const { provider, ...networkContext } = this.networkContext;
    return {
      appIdentityHash: this.appIdentityHash,
      freeBalanceAppIdentityHash: this.freeBalanceAppIdentityHash,
      interpreterAddr: this.interpreterAddr,
      interpreterParams: this.interpreterParams,
      multisigAddress: this.multisigAddress,
      multisigOwners: this.multisigOwners,
      networkContext: networkContext,
      signatures: this.signatures,
    };
  }

  public static fromJson(json: ConditionalTransactionCommitmentJSON) {
    return new ConditionalTransactionCommitment(
      json.networkContext,
      json.multisigAddress,
      json.multisigOwners,
      json.appIdentityHash,
      json.freeBalanceAppIdentityHash,
      json.interpreterAddr,
      json.interpreterParams,
      json.signatures[0],
      json.signatures[1]
    );
  }

  /**
   * Takes parameters for executeEffectOfInterpretedAppOutcome function call and
   * encodes them into a bytes array for the data field of the transaction.
   *
   * @returns The (to, value, data, op) data required by MultisigCommitment
   * @memberof ConditionalTransactionCommitment
   */
  public getTransactionDetails() {
    return {
      to: this.networkContext.ConditionalTransactionDelegateTarget,
      value: 0,
      data: iface.functions.executeEffectOfInterpretedAppOutcome.encode([
        this.networkContext.ChallengeRegistry,
        this.freeBalanceAppIdentityHash,
        this.appIdentityHash,
        this.interpreterAddr,
        this.interpreterParams,
      ]),
      operation: MultisigOperation.DelegateCall,
    };
  }
}
