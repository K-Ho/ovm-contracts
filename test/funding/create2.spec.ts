/* global before */
import { Contract, Event, Wallet } from "ethers";
import { TransactionResponse } from "ethers/providers";
import {
  getAddress,
  keccak256,
  solidityKeccak256,
  solidityPack,
} from "ethers/utils";
import { MockProvider, deployContract } from "ethereum-waffle";

import Echo from "../../artifacts/Echo.json";
import Proxy from "../../artifacts/Proxy.json";
import ProxyFactory from "../../artifacts/ProxyFactory.json";

import { expect, createProvider } from "../utils";

describe("ProxyFactory with CREATE2", function () {
  // this.timeout(5000);

  let wallet: Wallet;
  let provider: MockProvider;

  let pf: Contract;
  let echo: Contract;

  function create2(
    initcode: string,
    saltNonce: number = 0,
    initializer: string = "0x"
  ) {
    return getAddress(
      solidityKeccak256(
        ["bytes1", "address", "uint256", "bytes32"],
        [
          "0xff",
          pf.address,
          solidityKeccak256(
            ["bytes32", "uint256"],
            [keccak256(initializer), saltNonce]
          ),
          keccak256(initcode),
        ]
      ).slice(-40)
    );
  }

  before(async () => {
    provider = await createProvider();
    wallet = provider.getWallets()[0];
    pf = await deployContract(wallet, ProxyFactory, []);

    echo = await deployContract(wallet, Echo, []);
  });

  describe.only("createProxy", async () => {
    it("can be used to deploy a contract at a predictable address", async () => {
      const masterCopy = echo.address;

      console.log(`PROXY BYTECODE 0x${Proxy.evm.bytecode.object.replace(/^0x/, "")}`)
      const initcode = solidityPack(
        ["bytes", "uint256"],
        [`0x${Proxy.evm.bytecode.object.replace(/^0x/, "")}`, echo.address]
      );

      const saltNonce = 0;

      const tx: TransactionResponse = await pf.createProxyWithNonce(
        masterCopy,
        "0x",
        saltNonce,
        `0x${Proxy.evm.bytecode.object.replace(/^0x/, "")}`
      );

      const receipt = await tx.wait();
      console.log('got receipt', receipt)

      const event: Event = (receipt as any).events.pop();

      expect(event.event).to.eq("ProxyCreation");
      expect(event.eventSignature).to.eq("ProxyCreation(address)");
      expect(event.args![0]).to.eq(create2(initcode, saltNonce));
      console.log(event.args![0], create2(initcode, saltNonce))
      const echoProxy = new Contract(
        create2(initcode),
        Echo.abi as any,
        wallet
      );

      expect(await echoProxy.functions.helloWorld()).to.eq("hello world");
    });
  });
});
