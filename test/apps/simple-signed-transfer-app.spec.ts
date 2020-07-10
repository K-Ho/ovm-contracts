import {
  CoinTransfer,
  singleAssetTwoPartyCoinTransferEncoding,
  PrivateKey,
  BigNumber,
} from "@connext/types";
import { Contract, constants, utils, Wallet } from "ethers";
import { getRandomBytes32, getAddressFromPrivateKey } from "@connext/utils";
import { MockProvider, deployContract } from "ethereum-waffle";

import SimpleSignedTransferApp from "../../artifacts/SimpleSignedTransferApp.json";

import {
  SimpleSignedTransferAppState,
  SimpleSignedTransferAppStateEncoding,
  SimpleSignedTransferAppAction,
  SimpleSignedTransferAppActionEncoding,
  getTestEIP712Domain,
  signReceiptMessage,
  hashDomainSeparator,
} from "../eip712";
import { expect, createProvider } from "../utils";

const { Zero } = constants;
const { defaultAbiCoder } = utils;

function mkAddress(prefix: string = "0xa"): string {
  return prefix.padEnd(42, "0");
}

const decodeTransfers = (encodedAppState: string): CoinTransfer[] =>
  defaultAbiCoder.decode(
    [singleAssetTwoPartyCoinTransferEncoding],
    encodedAppState
  )[0];

const decodeAppState = (
  encodedAppState: string
): SimpleSignedTransferAppState => {
  return defaultAbiCoder.decode(
    [SimpleSignedTransferAppStateEncoding],
    encodedAppState
  )[0];
};

const encodeAppState = (
  state: SimpleSignedTransferAppState,
  onlyCoinTransfers: boolean = false
): string => {
  if (!onlyCoinTransfers) {
    return defaultAbiCoder.encode(
      [SimpleSignedTransferAppStateEncoding],
      [state]
    );
  }
  return defaultAbiCoder.encode(
    [singleAssetTwoPartyCoinTransferEncoding],
    [state.coinTransfers]
  );
};

function encodeAppAction(state: SimpleSignedTransferAppAction): string {
  return defaultAbiCoder.encode(
    [SimpleSignedTransferAppActionEncoding],
    [state]
  );
}

describe("SimpleSignedTransferApp", () => {
  let privateKey: PrivateKey;
  let signerAddress: string;
  let data: string;
  let goodSig: string;
  let badSig: string;
  let simpleSignedTransferApp: Contract;
  let senderAddr: string;
  let receiverAddr: string;
  let transferAmount: BigNumber;
  let preState: SimpleSignedTransferAppState;
  let paymentId: string;
  let domainSeparator: any; // EIP712Domain;
  let provider: MockProvider;

  async function computeOutcome(
    state: SimpleSignedTransferAppState
  ): Promise<string> {
    return simpleSignedTransferApp.computeOutcome(encodeAppState(state));
  }

  async function applyAction(
    state: SimpleSignedTransferAppState,
    action: SimpleSignedTransferAppAction
  ): Promise<string> {
    return simpleSignedTransferApp.applyAction(
      encodeAppState(state),
      encodeAppAction(action)
    );
  }

  async function validateOutcome(
    encodedTransfers: string,
    postState: SimpleSignedTransferAppState
  ) {
    const decoded = decodeTransfers(encodedTransfers);
    expect(encodedTransfers).to.eq(encodeAppState(postState, true));
    expect(decoded[0].to).eq(postState.coinTransfers[0].to);
    expect(decoded[0].amount.toString()).eq(
      postState.coinTransfers[0].amount.toString()
    );
    expect(decoded[1].to).eq(postState.coinTransfers[1].to);
    expect(decoded[1].amount.toString()).eq(
      postState.coinTransfers[1].amount.toString()
    );
  }

  beforeEach(async () => {
    provider = await createProvider();
    const wallet = provider.getWallets()[0];
    simpleSignedTransferApp = await deployContract(
      wallet,
      SimpleSignedTransferApp,
      []
    );

    privateKey = wallet.privateKey;
    signerAddress = getAddressFromPrivateKey(privateKey);

    paymentId = getRandomBytes32();
    data = getRandomBytes32();
    const receipt = { paymentId, data };

    const network = await provider.getNetwork();
    domainSeparator = getTestEIP712Domain(network.chainId);

    goodSig = await signReceiptMessage(domainSeparator, receipt, privateKey);
    badSig = getRandomBytes32();

    senderAddr = mkAddress("0xa");
    receiverAddr = mkAddress("0xB");
    transferAmount = new BigNumber(10000);
    preState = {
      coinTransfers: [
        {
          amount: transferAmount,
          to: senderAddr,
        },
        {
          amount: Zero,
          to: receiverAddr,
        },
      ],
      signerAddress,
      domainSeparator: hashDomainSeparator(domainSeparator),
      paymentId,
      finalized: false,
      chainId: domainSeparator.chainId,
      verifyingContract: domainSeparator.verifyingContract,
    };
  });

  describe("applyAction", () => {
    it("will redeem a payment with correct signature", async () => {
      const action: SimpleSignedTransferAppAction = {
        data,
        signature: goodSig,
      };
      let ret = await applyAction(preState, action);
      const afterActionState = decodeAppState(ret);

      const expectedPostState: SimpleSignedTransferAppState = {
        ...preState,
        coinTransfers: [
          {
            amount: Zero,
            to: senderAddr,
          },
          {
            amount: transferAmount,
            to: receiverAddr,
          },
        ],
        finalized: true,
      };

      expect(afterActionState.finalized).to.eq(expectedPostState.finalized);
      expect(afterActionState.coinTransfers[0].amount).to.eq(
        expectedPostState.coinTransfers[0].amount
      );
      expect(afterActionState.coinTransfers[1].amount).to.eq(
        expectedPostState.coinTransfers[1].amount
      );

      ret = await computeOutcome(afterActionState);
      validateOutcome(ret, expectedPostState);
    });

    it("will revert action with incorrect signature", async () => {
      const action: SimpleSignedTransferAppAction = {
        data,
        signature: badSig,
      };

      await expect(applyAction(preState, action)).revertedWith(
        "revert ECDSA: invalid signature length"
      );
    });

    it("will revert action if already finalized", async () => {
      const action: SimpleSignedTransferAppAction = {
        data,
        signature: goodSig,
      };
      preState.finalized = true;

      await expect(applyAction(preState, action)).revertedWith(
        "Cannot take action on finalized state"
      );
    });
  });
});
